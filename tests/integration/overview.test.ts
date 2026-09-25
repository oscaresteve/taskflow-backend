import { describe, expect, it } from "vitest";
import request from "supertest";
import {
  addActiveMember,
  addActiveProjectMember,
  app,
  createProject,
  createTask,
  createWorkspace,
  signUp,
} from "../helpers/api.ts";

async function setupOwnerProject() {
  const owner = await signUp();
  const workspace = await createWorkspace(owner.accessToken);
  const project = await createProject(owner.accessToken, workspace.slug);
  return { owner, workspace, project };
}

// El endpoint de creación no acepta dueDate, así que lo fijamos con un PATCH aparte.
async function setDueDate({
  actorAccessToken,
  workspaceSlug,
  projectSlug,
  taskNumber,
  dueDate,
}: {
  actorAccessToken: string;
  workspaceSlug: string;
  projectSlug: string;
  taskNumber: number;
  dueDate: string;
}) {
  const res = await request(app)
    .patch(`/api/workspaces/${workspaceSlug}/projects/${projectSlug}/tasks/${taskNumber}`)
    .set("Cookie", `accessToken=${actorAccessToken}`)
    .send({ dueDate });

  if (res.status !== 200) {
    throw new Error(`setDueDate failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

// Igual que setDueDate: llevar una tarea a DONE fija completedAt, que es lo que alimenta
// completedLast7Days/completionRate.
async function setStatus({
  actorAccessToken,
  workspaceSlug,
  projectSlug,
  taskNumber,
  status,
}: {
  actorAccessToken: string;
  workspaceSlug: string;
  projectSlug: string;
  taskNumber: number;
  status: string;
}) {
  const res = await request(app)
    .patch(`/api/workspaces/${workspaceSlug}/projects/${projectSlug}/tasks/${taskNumber}`)
    .set("Cookie", `accessToken=${actorAccessToken}`)
    .send({ status });

  if (res.status !== 200) {
    throw new Error(`setStatus failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

describe("GET /me/overview", () => {
  it("401s without authentication", async () => {
    const res = await request(app).get("/api/me/overview");

    expect(res.status).toBe(401);
  });

  it("returns the caller's open work split by urgency, as an action queue", async () => {
    const { owner, workspace, project } = await setupOwnerProject();

    const pastDueTask = await createTask(owner.accessToken, workspace.slug, project.slug, {
      title: "Overdue task",
      assigneeId: owner.user.id,
    });
    await setDueDate({
      actorAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      taskNumber: pastDueTask.taskNumber,
      dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });

    await createTask(owner.accessToken, workspace.slug, project.slug, {
      title: "Unassigned task",
    });

    const doneTask = await createTask(owner.accessToken, workspace.slug, project.slug, {
      title: "Done task",
      assigneeId: owner.user.id,
    });
    await setStatus({
      actorAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      taskNumber: doneTask.taskNumber,
      status: "DONE",
    });

    const res = await request(app).get("/api/me/overview").set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks.open).toBe(1);
    expect(res.body.tasks.completedLast7Days).toBe(1);
    // Las cuatro cubetas de fecha limite suman siempre las tareas abiertas.
    expect(res.body.tasks.byDueDate).toEqual({ overdue: 1, dueSoon: 0, scheduled: 0, noDueDate: 0 });

    // La cola solo trae trabajo vivo: la tarea DONE del propio usuario no aparece.
    expect(res.body.myTasks).toHaveLength(1);
    expect(res.body.myTasks[0]).toEqual(
      expect.objectContaining({
        id: pastDueTask.id,
        project: expect.objectContaining({ key: project.key, slug: project.slug, workspaceSlug: workspace.slug }),
        assignee: expect.objectContaining({ id: owner.user.id }),
      }),
    );
  });

  it("orders the queue by due date, leaving tasks without a due date last", async () => {
    const { owner, workspace, project } = await setupOwnerProject();

    const undated = await createTask(owner.accessToken, workspace.slug, project.slug, {
      title: "No due date",
      assigneeId: owner.user.id,
    });
    const later = await createTask(owner.accessToken, workspace.slug, project.slug, {
      title: "Due later",
      assigneeId: owner.user.id,
    });
    const soonest = await createTask(owner.accessToken, workspace.slug, project.slug, {
      title: "Due soonest",
      assigneeId: owner.user.id,
    });

    await setDueDate({
      actorAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      taskNumber: later.taskNumber,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    await setDueDate({
      actorAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      taskNumber: soonest.taskNumber,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    const res = await request(app).get("/api/me/overview").set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.myTasks.map((task: { id: string }) => task.id)).toEqual([soonest.id, later.id, undated.id]);
    expect(res.body.tasks.byDueDate).toEqual({ overdue: 0, dueSoon: 1, scheduled: 1, noDueDate: 1 });
  });
});

describe("GET /workspaces/:workspaceSlug/overview", () => {
  it("403s when the user is not a member of the workspace", async () => {
    const { workspace } = await setupOwnerProject();
    const outsider = await signUp();

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/overview`)
      .set("Cookie", `accessToken=${outsider.accessToken}`);

    expect(res.status).toBe(403);
  });

  it("aggregates project count, task status breakdown and due date split for a member", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    await createProject(owner.accessToken, workspace.slug); // sin tareas, solo cuenta como proyecto

    await createTask(owner.accessToken, workspace.slug, project.slug, { title: "Task 1" });
    const doneTask = await createTask(owner.accessToken, workspace.slug, project.slug, { title: "Task 2" });
    await setStatus({
      actorAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      taskNumber: doneTask.taskNumber,
      status: "DONE",
    });

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/overview`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.projectsCount).toBe(2);
    expect(res.body.tasks.byStatus).toEqual({ TODO: 1, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 1 });
    expect(res.body.tasks.open).toBe(1);
    expect(res.body.tasks.completedLast7Days).toBe(1);
    expect(res.body.tasks.completionRate).toBe(50);
    // La unica tarea abierta no tiene fecha limite; la tarea DONE no entra en ninguna cubeta.
    expect(res.body.tasks.byDueDate).toEqual({ overdue: 0, dueSoon: 0, scheduled: 0, noDueDate: 1 });
    expect(res.body.recentTasks).toHaveLength(2);
    // Cada fila trae ya la key del proyecto, que es lo que la UI pinta como "PRJ-1".
    expect(res.body.recentTasks[0].project.key).toBe(project.key);
  });
});

describe("GET /workspaces/:workspaceSlug/projects/:projectSlug/overview", () => {
  it("403s when the user is not a member of the project", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const outsider = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: outsider.user.id,
      role: "MEMBER",
    });

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/overview`)
      .set("Cookie", `accessToken=${outsider.accessToken}`);

    expect(res.status).toBe(403);
  });

  it("aggregates status/priority breakdown, due date split and unassigned count", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const memberUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: memberUser.user.id,
      role: "MEMBER",
    });
    await addActiveProjectMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      targetUserId: memberUser.user.id,
      role: "MEMBER",
    });

    const assigned = await createTask(owner.accessToken, workspace.slug, project.slug, {
      title: "Assigned high priority",
      priority: "HIGH",
      assigneeId: memberUser.user.id,
    });
    await createTask(owner.accessToken, workspace.slug, project.slug, { title: "Unassigned task" });

    const ownerDoneTask = await createTask(owner.accessToken, workspace.slug, project.slug, {
      title: "Owner done task",
      assigneeId: owner.user.id,
    });
    await setStatus({
      actorAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      taskNumber: ownerDoneTask.taskNumber,
      status: "DONE",
    });

    await setDueDate({
      actorAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      taskNumber: assigned.taskNumber,
      dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/overview`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks.byStatus).toEqual({ TODO: 2, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 1 });
    expect(res.body.tasks.byPriority).toEqual({ LOW: 0, MEDIUM: 2, HIGH: 1, URGENT: 0 });
    expect(res.body.tasks.open).toBe(2);
    expect(res.body.tasks.unassigned).toBe(1);
    expect(res.body.tasks.completedLast7Days).toBe(1);
    expect(res.body.tasks.completionRate).toBe(33); // 1 DONE de 3 tareas
    // De las 2 abiertas, una vencio ayer y la otra no tiene fecha.
    expect(res.body.tasks.byDueDate).toEqual({ overdue: 1, dueSoon: 0, scheduled: 0, noDueDate: 1 });
    expect(res.body.recentTasks).toHaveLength(3);
  });
});

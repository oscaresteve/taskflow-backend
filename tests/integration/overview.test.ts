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

async function setupOwnerProject(projectOverrides: Partial<{ name: string; key: string }> = {}) {
  const owner = await signUp();
  const workspace = await createWorkspace(owner.accessToken);
  const project = await createProject(owner.accessToken, workspace.slug, projectOverrides);
  return { owner, workspace, project };
}

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

// Llevar una tarea a DONE fija completedAt, que es lo que alimenta completedLast7Days y
// completionRate.
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

describe("GET /me/overview (alcance)", () => {
  it("leaves out my tasks in archived projects, which no screen can open", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const archived = await createProject(owner.accessToken, workspace.slug, { key: "OLD" });

    await createTask(owner.accessToken, workspace.slug, project.slug, { title: "Live", assigneeId: owner.user.id });
    await createTask(owner.accessToken, workspace.slug, archived.slug, { title: "Parked", assigneeId: owner.user.id });

    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${archived.slug}/archive`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app).get("/api/me/overview").set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks.open).toBe(1);
    expect(res.body.myTasks).toHaveLength(1);
  });
});

describe("GET /me/overview/workspaces", () => {
  it("401s without authentication", async () => {
    const res = await request(app).get("/api/me/overview/workspaces");

    expect(res.status).toBe(401);
  });

  it("lists the caller's workspaces with their own load in each one", async () => {
    const owner = await signUp();
    const busy = await createWorkspace(owner.accessToken, "Alpha");
    await createWorkspace(owner.accessToken, "Beta"); // sin proyectos ni tareas
    const project = await createProject(owner.accessToken, busy.slug);

    const late = await createTask(owner.accessToken, busy.slug, project.slug, {
      title: "Mine, late",
      assigneeId: owner.user.id,
    });
    await setDueDate({
      actorAccessToken: owner.accessToken,
      workspaceSlug: busy.slug,
      projectSlug: project.slug,
      taskNumber: late.taskNumber,
      dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });

    await createTask(owner.accessToken, busy.slug, project.slug, {
      title: "Mine, on time",
      assigneeId: owner.user.id,
    });

    // De otro: no entra en la carga propia de nadie mas que su responsable.
    await createTask(owner.accessToken, busy.slug, project.slug, { title: "Nobody's" });

    const res = await request(app)
      .get("/api/me/overview/workspaces")
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ page: 1, limit: 10, total: 2, pages: 1 });
    expect(res.body.data.map((item: { name: string }) => item.name)).toEqual(["Alpha", "Beta"]);
    expect(res.body.data[0].stats).toEqual({ open: 2, overdue: 1 });
    expect(res.body.data[1].stats).toEqual({ open: 0, overdue: 0 });
  });

  it("searches by name and leaves out workspaces the user does not belong to", async () => {
    const owner = await signUp();
    await createWorkspace(owner.accessToken, "Product design");
    await createWorkspace(owner.accessToken, "Backoffice");

    const outsider = await signUp();

    const found = await request(app)
      .get("/api/me/overview/workspaces")
      .query({ search: "design" })
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(found.body.data.map((item: { name: string }) => item.name)).toEqual(["Product design"]);

    const asOutsider = await request(app)
      .get("/api/me/overview/workspaces")
      .set("Cookie", `accessToken=${outsider.accessToken}`);

    expect(asOutsider.body.data).toEqual([]);
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

  it("counts the workspace headline numbers for a member", async () => {
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
    // La unica abierta no tiene fecha ni responsable; la tarea DONE ya no cuenta como abierta.
    expect(res.body.tasks).toEqual({ open: 1, overdue: 0, unassigned: 1, completedLast7Days: 1 });
  });

  it("counts only what the caller can reach: projects they belong to", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    await createTask(owner.accessToken, workspace.slug, project.slug, { title: "Out of reach" });

    // Miembro del espacio, pero de ninguno de sus proyectos: los contadores y la rejilla tienen que
    // decir lo mismo, y la rejilla no le ensena nada.
    const member = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: member.user.id,
      role: "MEMBER",
    });

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/overview`)
      .set("Cookie", `accessToken=${member.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.projectsCount).toBe(0);
    expect(res.body.tasks).toEqual({ open: 0, overdue: 0, unassigned: 0, completedLast7Days: 0 });
  });

  it("leaves out archived projects and their work", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const archived = await createProject(owner.accessToken, workspace.slug, { key: "OLD" });

    await createTask(owner.accessToken, workspace.slug, project.slug, { title: "Live" });
    await createTask(owner.accessToken, workspace.slug, archived.slug, { title: "Parked" });

    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${archived.slug}/archive`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/overview`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.projectsCount).toBe(1);
    expect(res.body.tasks.open).toBe(1);
  });

  it("returns the caller's own queue for this workspace, not everyone's", async () => {
    const { owner, workspace, project } = await setupOwnerProject();

    const mine = await createTask(owner.accessToken, workspace.slug, project.slug, {
      title: "Mine",
      assigneeId: owner.user.id,
    });
    await createTask(owner.accessToken, workspace.slug, project.slug, { title: "Nobody's" });

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/overview`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.myTasks).toHaveLength(1);
    expect(res.body.myTasks[0].id).toBe(mine.id);
  });
});

describe("GET /workspaces/:workspaceSlug/overview/projects", () => {
  it("403s when the user is not a member of the workspace", async () => {
    const { workspace } = await setupOwnerProject();
    const outsider = await signUp();

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/overview/projects`)
      .set("Cookie", `accessToken=${outsider.accessToken}`);

    expect(res.status).toBe(403);
  });

  it("carries the numbers each project card needs", async () => {
    const { owner, workspace, project } = await setupOwnerProject({ name: "Alpha" });
    await createProject(owner.accessToken, workspace.slug, { name: "Beta", key: "BETA" });

    const doneTask = await createTask(owner.accessToken, workspace.slug, project.slug, { title: "Done" });
    await setStatus({
      actorAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      taskNumber: doneTask.taskNumber,
      status: "DONE",
    });

    const lateTask = await createTask(owner.accessToken, workspace.slug, project.slug, { title: "Late" });
    await setDueDate({
      actorAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      taskNumber: lateTask.taskNumber,
      dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });

    await createTask(owner.accessToken, workspace.slug, project.slug, { title: "Open" });

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/overview/projects`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ page: 1, limit: 10, total: 2, pages: 1 });
    // Orden fijo por nombre.
    expect(res.body.data.map((item: { name: string }) => item.name)).toEqual(["Alpha", "Beta"]);

    // Una de tres hecha, y de las dos abiertas una ya se paso de fecha.
    expect(res.body.data[0].stats).toEqual({
      open: 2,
      overdue: 1,
      completionRate: 33,
      lastActivityAt: expect.any(String),
    });

    // Sin tareas no hay nada que dividir ni ninguna actividad que datar.
    expect(res.body.data[1].stats).toEqual({ open: 0, overdue: 0, completionRate: 0, lastActivityAt: null });
  });

  it("searches by name and only lists projects the user belongs to", async () => {
    const { owner, workspace } = await setupOwnerProject({ name: "Website redesign" });
    await createProject(owner.accessToken, workspace.slug, { name: "Mobile app", key: "MOB" });

    const member = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: member.user.id,
      role: "MEMBER",
    });

    const found = await request(app)
      .get(`/api/workspaces/${workspace.slug}/overview/projects`)
      .query({ search: "mobile" })
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(found.body.data.map((item: { name: string }) => item.name)).toEqual(["Mobile app"]);
    expect(found.body.pagination.total).toBe(1);

    // El miembro del espacio no pertenece a ninguno de los dos proyectos.
    const asMember = await request(app)
      .get(`/api/workspaces/${workspace.slug}/overview/projects`)
      .set("Cookie", `accessToken=${member.accessToken}`);

    expect(asMember.body.data).toEqual([]);
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
  });
});

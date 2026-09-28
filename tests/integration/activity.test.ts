import { describe, expect, it } from "vitest";
import request from "supertest";
import {
  addActiveMember,
  addActiveProjectMember,
  app,
  createComment,
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

type ActivityEntry = {
  action: string;
  taskId: string | null;
  actor: { id: string };
  payload: Record<string, unknown>;
};

async function getProjectActivity(accessToken: string, workspaceSlug: string, projectSlug: string) {
  const res = await request(app)
    .get(`/api/workspaces/${workspaceSlug}/projects/${projectSlug}/activity`)
    .set("Cookie", `accessToken=${accessToken}`);

  return res;
}

describe("GET /workspaces/:workspaceSlug/projects/:projectSlug/activity", () => {
  it("records the creation of a task", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug, { title: "Ship the feed" });

    const res = await getProjectActivity(owner.accessToken, workspace.slug, project.slug);

    expect(res.status).toBe(200);

    const created = (res.body.data as ActivityEntry[]).find((entry) => entry.action === "TASK_CREATED");

    expect(created).toBeDefined();
    expect(created!.taskId).toBe(task.id);
    expect(created!.actor.id).toBe(owner.user.id);
    expect(created!.payload).toMatchObject({ taskNumber: task.taskNumber, taskTitle: "Ship the feed" });
  });

  it("splits one update into an event per field that actually changed", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);

    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ status: "IN_PROGRESS", priority: "HIGH" });

    const res = await getProjectActivity(owner.accessToken, workspace.slug, project.slug);
    const entries = res.body.data as ActivityEntry[];

    const status = entries.find((entry) => entry.action === "TASK_STATUS_CHANGED");
    const priority = entries.find((entry) => entry.action === "TASK_PRIORITY_CHANGED");

    expect(status!.payload).toMatchObject({ from: "TODO", to: "IN_PROGRESS" });
    expect(priority!.payload).toMatchObject({ from: "MEDIUM", to: "HIGH" });
  });

  it("records nothing when an update resends the values the task already had", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug, { title: "Same title" });

    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ title: "Same title", priority: "MEDIUM" });

    const res = await getProjectActivity(owner.accessToken, workspace.slug, project.slug);
    const entries = res.body.data as ActivityEntry[];

    expect(entries.map((entry) => entry.action)).toEqual(["TASK_CREATED"]);
  });

  it("records a column change on move, but not a reorder inside the same column", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const first = await createTask(owner.accessToken, workspace.slug, project.slug);
    const second = await createTask(owner.accessToken, workspace.slug, project.slug);

    // Reordenar dentro de TODO: cambia el rank, no la columna.
    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${second.taskNumber}/move`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ status: "TODO", afterTaskId: null });

    let res = await getProjectActivity(owner.accessToken, workspace.slug, project.slug);
    let entries = res.body.data as ActivityEntry[];

    expect(entries.filter((entry) => entry.action === "TASK_STATUS_CHANGED")).toHaveLength(0);

    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${first.taskNumber}/move`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ status: "DONE", afterTaskId: null });

    res = await getProjectActivity(owner.accessToken, workspace.slug, project.slug);
    entries = res.body.data as ActivityEntry[];

    const moved = entries.find((entry) => entry.action === "TASK_STATUS_CHANGED");

    expect(moved!.taskId).toBe(first.id);
    expect(moved!.payload).toMatchObject({ from: "TODO", to: "DONE" });
  });

  it("records a comment and the member that was added to the project", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);
    const comment = await createComment(owner.accessToken, workspace.slug, project.slug, task.taskNumber);

    const member = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: member.user.id,
      role: "MEMBER",
    });
    await addActiveProjectMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      targetUserId: member.user.id,
      role: "MEMBER",
    });

    const res = await getProjectActivity(owner.accessToken, workspace.slug, project.slug);
    const entries = res.body.data as ActivityEntry[];

    const commented = entries.find((entry) => entry.action === "COMMENT_CREATED");
    const added = entries.find((entry) => entry.action === "PROJECT_MEMBER_ADDED");

    expect(commented!.payload).toMatchObject({ commentId: comment.id, taskNumber: task.taskNumber });
    expect(added!.taskId).toBeNull();
    expect(added!.payload).toMatchObject({ targetUserId: member.user.id, role: "MEMBER" });
  });

  it("returns the newest event first", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);

    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ status: "IN_REVIEW" });

    const res = await getProjectActivity(owner.accessToken, workspace.slug, project.slug);
    const entries = res.body.data as ActivityEntry[];

    expect(entries[0].action).toBe("TASK_STATUS_CHANGED");
    expect(entries[entries.length - 1].action).toBe("TASK_CREATED");
  });

  it("403s when the user is a workspace member but not a project member", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const outsider = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: outsider.user.id,
      role: "MEMBER",
    });

    const res = await getProjectActivity(outsider.accessToken, workspace.slug, project.slug);

    expect(res.status).toBe(403);
  });

  it("401s without an access token", async () => {
    const { workspace, project } = await setupOwnerProject();

    const res = await request(app).get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/activity`);

    expect(res.status).toBe(401);
  });
});

describe("GET /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/activity", () => {
  it("only returns the events of that task", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);
    const other = await createTask(owner.accessToken, workspace.slug, project.slug);

    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${other.taskNumber}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ status: "DONE" });

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/activity`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(200);

    const entries = res.body.data as ActivityEntry[];

    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("TASK_CREATED");
    expect(entries[0].taskId).toBe(task.id);
  });

  it("404s for a task number that does not exist", async () => {
    const { owner, workspace, project } = await setupOwnerProject();

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/9999/activity`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(404);
  });
});

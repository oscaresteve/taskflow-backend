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

    expect(entries.map((entry) => entry.action)).toEqual(["TASK_CREATED", "PROJECT_CREATED"]);
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
    // Lo mas viejo del feed de un proyecto es siempre su propia creacion.
    expect(entries[entries.length - 1].action).toBe("PROJECT_CREATED");
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

describe("GET /workspaces/:workspaceSlug/activity", () => {
  async function getWorkspaceActivity(accessToken: string, workspaceSlug: string) {
    return request(app)
      .get(`/api/workspaces/${workspaceSlug}/activity`)
      .set("Cookie", `accessToken=${accessToken}`);
  }

  it("records the workspace and project lifecycle", async () => {
    const owner = await signUp();
    const workspace = await createWorkspace(owner.accessToken);
    const project = await createProject(owner.accessToken, workspace.slug);

    const renamed = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ name: "Renamed project" });

    // Cambiar el nombre regenera el slug, asi que el de antes ya no resuelve.
    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${renamed.body.slug}/archive`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await getWorkspaceActivity(owner.accessToken, workspace.slug);

    expect(res.status).toBe(200);

    const entries = res.body.data as ActivityEntry[];
    const actions = entries.map((entry) => entry.action);

    expect(actions).toContain("WORKSPACE_CREATED");
    expect(actions).toContain("PROJECT_CREATED");
    expect(actions).toContain("PROJECT_ARCHIVED");

    const updated = entries.find((entry) => entry.action === "PROJECT_UPDATED");

    expect(updated!.payload).toMatchObject({ projectName: "Renamed project", fields: ["name"] });
  });

  it("records workspace member events with no project attached", async () => {
    const owner = await signUp();
    const workspace = await createWorkspace(owner.accessToken);
    const invited = await signUp();

    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: invited.user.id,
      role: "MEMBER",
    });

    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/members/${invited.user.id}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ role: "ADMIN" });

    const res = await getWorkspaceActivity(owner.accessToken, workspace.slug);
    const entries = res.body.data as ActivityEntry[];

    const invitedEntry = entries.find((entry) => entry.action === "WORKSPACE_MEMBER_INVITED");
    const activatedEntry = entries.find((entry) => entry.action === "WORKSPACE_MEMBER_ACTIVATED");
    const roleEntry = entries.find((entry) => entry.action === "WORKSPACE_MEMBER_ROLE_CHANGED");

    expect(invitedEntry!.taskId).toBeNull();
    expect(invitedEntry!.payload).toMatchObject({ targetUserId: invited.user.id, role: "MEMBER" });
    expect(activatedEntry).toBeDefined();
    expect(roleEntry!.payload).toMatchObject({ from: "MEMBER", to: "ADMIN" });
  });

  it("hides events of projects the member does not belong to", async () => {
    const owner = await signUp();
    const workspace = await createWorkspace(owner.accessToken);
    const mine = await createProject(owner.accessToken, workspace.slug, { name: "Mine" });
    const theirs = await createProject(owner.accessToken, workspace.slug, { name: "Theirs" });

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
      projectSlug: mine.slug,
      targetUserId: member.user.id,
      role: "MEMBER",
    });

    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${theirs.slug}/archive`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await getWorkspaceActivity(member.accessToken, workspace.slug);
    const entries = res.body.data as ActivityEntry[];

    const projectNames = entries
      .filter((entry) => entry.action === "PROJECT_CREATED" || entry.action === "PROJECT_ARCHIVED")
      .map((entry) => entry.payload.projectName);

    expect(projectNames).toContain("Mine");
    expect(projectNames).not.toContain("Theirs");

    // Los eventos del propio espacio no cuelgan de ningun proyecto, asi que los ve igual.
    expect(entries.map((entry) => entry.action)).toContain("WORKSPACE_MEMBER_INVITED");
  });

  it("leaves the task detail to the project feed", async () => {
    const owner = await signUp();
    const workspace = await createWorkspace(owner.accessToken);
    const project = await createProject(owner.accessToken, workspace.slug);
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);

    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ status: "IN_PROGRESS" });

    const workspaceRes = await getWorkspaceActivity(owner.accessToken, workspace.slug);
    const workspaceEntries = workspaceRes.body.data as ActivityEntry[];

    // Ninguna entrada del feed de espacio cuelga de una tarea: ese nivel es dos por debajo.
    expect(workspaceEntries.every((entry) => entry.taskId === null)).toBe(true);
    expect(workspaceEntries.map((entry) => entry.action)).toEqual(["PROJECT_CREATED", "WORKSPACE_CREATED"]);

    const projectRes = await getProjectActivity(owner.accessToken, workspace.slug, project.slug);
    const projectActions = (projectRes.body.data as ActivityEntry[]).map((entry) => entry.action);

    expect(projectActions).toContain("TASK_CREATED");
    expect(projectActions).toContain("TASK_STATUS_CHANGED");
  });

  it("records editing and deleting a comment", async () => {
    const owner = await signUp();
    const workspace = await createWorkspace(owner.accessToken);
    const project = await createProject(owner.accessToken, workspace.slug);
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);
    const comment = await createComment(owner.accessToken, workspace.slug, project.slug, task.taskNumber);

    const base = `/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/comments/${comment.id}`;

    await request(app).patch(base).set("Cookie", `accessToken=${owner.accessToken}`).send({ content: "Edited" });
    await request(app).patch(`${base}/delete`).set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/activity`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const entries = res.body.data as ActivityEntry[];
    const actions = entries.map((entry) => entry.action);

    expect(actions).toContain("COMMENT_EDITED");
    expect(actions).toContain("COMMENT_DELETED");
    expect(entries.find((entry) => entry.action === "COMMENT_DELETED")!.payload).toMatchObject({
      commentId: comment.id,
    });
  });

  it("403s when the user is not a member of the workspace", async () => {
    const owner = await signUp();
    const workspace = await createWorkspace(owner.accessToken);
    const outsider = await signUp();

    const res = await getWorkspaceActivity(outsider.accessToken, workspace.slug);

    expect(res.status).toBe(403);
  });
});

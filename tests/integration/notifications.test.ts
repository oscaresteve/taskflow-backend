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

type Notification = {
  id: string;
  readAt: string | null;
  workspaceSlug: string;
  event: { action: string; actor: { id: string }; payload: Record<string, unknown> };
};

async function setupProjectWithMember() {
  const owner = await signUp();
  const workspace = await createWorkspace(owner.accessToken);
  const project = await createProject(owner.accessToken, workspace.slug);

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

  return { owner, workspace, project, member };
}

function listNotifications(accessToken: string) {
  return request(app).get("/api/notifications").set("Cookie", `accessToken=${accessToken}`);
}

function unreadCount(accessToken: string) {
  return request(app).get("/api/notifications/unread-count").set("Cookie", `accessToken=${accessToken}`);
}

describe("GET /notifications", () => {
  it("notifies the new assignee and nobody else", async () => {
    const { owner, workspace, project, member } = await setupProjectWithMember();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);

    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ assigneeId: member.user.id });

    const res = await listNotifications(member.accessToken);

    expect(res.status).toBe(200);

    const notifications = res.body.data as Notification[];

    // La invitacion al espacio, el alta en el proyecto y la asignacion.
    expect(notifications).toHaveLength(3);
    expect(notifications[0].event.action).toBe("TASK_ASSIGNEE_CHANGED");
    expect(notifications[0].workspaceSlug).toBe(workspace.slug);

    // El actor no se notifica a si mismo.
    const ownerRes = await listNotifications(owner.accessToken);
    expect(ownerRes.body.data).toEqual([]);
  });

  it("notifies the people a comment mentions", async () => {
    const { owner, workspace, project, member } = await setupProjectWithMember();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);

    await request(app)
      .post(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/comments`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ content: `Esto te toca @[Someone](${member.user.id})` });

    const res = await listNotifications(member.accessToken);
    const notifications = res.body.data as Notification[];

    expect(notifications[0].event.action).toBe("COMMENT_CREATED");
    expect(notifications[0].event.payload.mentions).toEqual([member.user.id]);
  });

  it("drops mentions of users who are not members of the project", async () => {
    const { owner, workspace, project } = await setupProjectWithMember();
    const outsider = await signUp();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);

    await request(app)
      .post(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/comments`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ content: `Hola @[Outsider](${outsider.user.id})` });

    const res = await listNotifications(outsider.accessToken);

    expect(res.body.data).toEqual([]);
  });

  it("notifies a mentioned user once, even if they are also the assignee", async () => {
    const { owner, workspace, project, member } = await setupProjectWithMember();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug, {
      assigneeId: member.user.id,
    });

    await request(app)
      .post(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/comments`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ content: `@[Someone](${member.user.id}) mira esto` });

    const res = await listNotifications(member.accessToken);
    const comments = (res.body.data as Notification[]).filter(
      (notification) => notification.event.action === "COMMENT_CREATED",
    );

    expect(comments).toHaveLength(1);
  });

  it("leaves the noisy actions out of the bell", async () => {
    const { owner, workspace, project, member } = await setupProjectWithMember();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug, {
      assigneeId: member.user.id,
    });

    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ priority: "URGENT", title: "Renamed" });

    const res = await listNotifications(member.accessToken);
    const actions = (res.body.data as Notification[]).map((notification) => notification.event.action);

    expect(actions).not.toContain("TASK_PRIORITY_CHANGED");
    expect(actions).not.toContain("TASK_EDITED");
  });

  it("401s without an access token", async () => {
    const res = await request(app).get("/api/notifications");

    expect(res.status).toBe(401);
  });
});

describe("PATCH /notifications", () => {
  it("counts unread, marks one as read and then marks the rest", async () => {
    const { owner, workspace, project, member } = await setupProjectWithMember();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);

    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ assigneeId: member.user.id });

    expect((await unreadCount(member.accessToken)).body).toEqual({ unread: 3 });

    const first = (await listNotifications(member.accessToken)).body.data[0] as Notification;

    const readRes = await request(app)
      .patch(`/api/notifications/${first.id}/read`)
      .set("Cookie", `accessToken=${member.accessToken}`);

    expect(readRes.status).toBe(204);
    expect((await unreadCount(member.accessToken)).body).toEqual({ unread: 2 });

    // Marcarla otra vez es un conflicto, no un no-op silencioso.
    const againRes = await request(app)
      .patch(`/api/notifications/${first.id}/read`)
      .set("Cookie", `accessToken=${member.accessToken}`);

    expect(againRes.status).toBe(409);

    const allRes = await request(app)
      .patch("/api/notifications/read-all")
      .set("Cookie", `accessToken=${member.accessToken}`);

    expect(allRes.status).toBe(204);
    expect((await unreadCount(member.accessToken)).body).toEqual({ unread: 0 });
  });

  it("404s when marking someone else's notification", async () => {
    const { owner, workspace, project, member } = await setupProjectWithMember();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);

    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ assigneeId: member.user.id });

    const theirs = (await listNotifications(member.accessToken)).body.data[0] as Notification;

    const res = await request(app)
      .patch(`/api/notifications/${theirs.id}/read`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(404);
  });
});

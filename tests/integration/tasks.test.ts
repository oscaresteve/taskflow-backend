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

describe("POST /workspaces/:workspaceSlug/projects/:projectSlug/tasks", () => {
  it("lets any project member (not just a manager) create tasks, numbered sequentially", async () => {
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

    const first = await createTask(memberUser.accessToken, workspace.slug, project.slug, { title: "First task" });
    const second = await createTask(memberUser.accessToken, workspace.slug, project.slug, { title: "Second task" });

    expect(first.taskNumber).toBe(1);
    expect(second.taskNumber).toBe(2);
  });

  it("404s when assigning the task to someone who is not a project member", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const outsider = await signUp();

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ title: "Task", priority: "MEDIUM", assigneeId: outsider.user.id });

    expect(res.status).toBe(404);
  });
});

describe("GET /workspaces/:workspaceSlug/projects/:projectSlug/tasks", () => {
  it("excludes archived tasks by default", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);
    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/archive`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.body.data).toHaveLength(0);
  });
});

describe("GET /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber", () => {
  it("403s when the user is a workspace member but not a project member", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);
    const outsider = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: outsider.user.id,
      role: "MEMBER",
    });

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${outsider.accessToken}`);

    expect(res.status).toBe(403);
  });

  it("404s when the task number does not exist", async () => {
    const { owner, workspace, project } = await setupOwnerProject();

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/999`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(404);
  });

  it("403s when the user's project membership was deactivated", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);
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
    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members/${memberUser.user.id}/deactivate`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${memberUser.accessToken}`);

    expect(res.status).toBe(403);
  });
});

describe("PATCH /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber", () => {
  it("lets any project member (not just a manager) update a task", async () => {
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
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${memberUser.accessToken}`)
      .send({ title: "Updated title" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated title");
  });

  it("sets completedAt when moved to DONE and clears it when moved away from DONE", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);

    const done = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ status: "DONE" });
    expect(done.body.completedAt).not.toBeNull();

    const reopened = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ status: "IN_PROGRESS" });
    expect(reopened.body.completedAt).toBeNull();
  });

  it("400s when the task is archived", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);
    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/archive`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ title: "Should not work" });

    expect(res.status).toBe(400);
  });

  it("404s when reassigning to someone who is not a project member", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);
    const outsider = await signUp();

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ assigneeId: outsider.user.id });

    expect(res.status).toBe(404);
  });
});

describe("PATCH /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/archive", () => {
  it("forbids a plain project MEMBER from archiving a task", async () => {
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
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/archive`)
      .set("Cookie", `accessToken=${memberUser.accessToken}`);

    expect(res.status).toBe(403);
  });

  it("lets a project manager archive a task", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/archive`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(204);
  });

  it("400s when the task is already archived", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);
    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/archive`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/archive`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(400);
  });
});

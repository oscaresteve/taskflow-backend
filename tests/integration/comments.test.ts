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

async function setupOwnerProjectTask() {
  const owner = await signUp();
  const workspace = await createWorkspace(owner.accessToken);
  const project = await createProject(owner.accessToken, workspace.slug);
  const task = await createTask(owner.accessToken, workspace.slug, project.slug);
  return { owner, workspace, project, task };
}

describe("POST /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/comments", () => {
  it("lets a project member create a comment", async () => {
    const { owner, workspace, project, task } = await setupOwnerProjectTask();

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/comments`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ content: "First comment" });

    expect(res.status).toBe(201);
    expect(res.body.content).toBe("First comment");
    expect(res.body.authorId).toBe(owner.user.id);
  });

  it("403s when the user is a workspace member but not a project member", async () => {
    const { owner, workspace, project, task } = await setupOwnerProjectTask();
    const outsider = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: outsider.user.id,
      role: "MEMBER",
    });

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/comments`)
      .set("Authorization", `Bearer ${outsider.accessToken}`)
      .send({ content: "Should not work" });

    expect(res.status).toBe(403);
  });
});

describe("GET /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/comments", () => {
  it("returns paginated comments for a task", async () => {
    const { owner, workspace, project, task } = await setupOwnerProjectTask();
    await createComment(owner.accessToken, workspace.slug, project.slug, task.taskNumber, { content: "First" });
    await createComment(owner.accessToken, workspace.slug, project.slug, task.taskNumber, { content: "Second" });

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/comments`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);
  });

  it("excludes deleted comments", async () => {
    const { owner, workspace, project, task } = await setupOwnerProjectTask();
    const comment = await createComment(owner.accessToken, workspace.slug, project.slug, task.taskNumber);
    await createComment(owner.accessToken, workspace.slug, project.slug, task.taskNumber);
    await request(app)
      .patch(
        `/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/comments/${comment.id}/delete`,
      )
      .set("Authorization", `Bearer ${owner.accessToken}`);

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/comments`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(res.body.data).toHaveLength(1);
  });
});

describe("PATCH /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/comments/:commentId", () => {
  it("lets the author update their own comment and sets editedAt", async () => {
    const { owner, workspace, project, task } = await setupOwnerProjectTask();
    const comment = await createComment(owner.accessToken, workspace.slug, project.slug, task.taskNumber);

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/comments/${comment.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ content: "Updated content" });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe("Updated content");
    expect(res.body.editedAt).not.toBeNull();
  });

  it("403s when a non-author project member (even the owner) tries to update someone else's comment", async () => {
    const { owner, workspace, project, task } = await setupOwnerProjectTask();
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
    const comment = await createComment(memberUser.accessToken, workspace.slug, project.slug, task.taskNumber);

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/comments/${comment.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ content: "Owner trying to edit" });

    expect(res.status).toBe(403);
  });

  it("404s when the commentId does not belong to the task in the URL", async () => {
    const { owner, workspace, project, task } = await setupOwnerProjectTask();
    const comment = await createComment(owner.accessToken, workspace.slug, project.slug, task.taskNumber);
    const otherTask = await createTask(owner.accessToken, workspace.slug, project.slug);

    const res = await request(app)
      .patch(
        `/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${otherTask.taskNumber}/comments/${comment.id}`,
      )
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ content: "Should not resolve" });

    expect(res.status).toBe(404);
  });
});

describe("PATCH /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/comments/:commentId/delete", () => {
  it("lets the author delete their own comment", async () => {
    const { owner, workspace, project, task } = await setupOwnerProjectTask();
    const comment = await createComment(owner.accessToken, workspace.slug, project.slug, task.taskNumber);

    const res = await request(app)
      .patch(
        `/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/comments/${comment.id}/delete`,
      )
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(204);
  });

  it("lets a project manager delete someone else's comment", async () => {
    const { owner, workspace, project, task } = await setupOwnerProjectTask();
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
    const comment = await createComment(memberUser.accessToken, workspace.slug, project.slug, task.taskNumber);

    const res = await request(app)
      .patch(
        `/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/comments/${comment.id}/delete`,
      )
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(204);
  });

  it("403s when a plain member who is neither the author nor a manager tries to delete", async () => {
    const { owner, workspace, project, task } = await setupOwnerProjectTask();
    const authorUser = await signUp();
    const outsiderMember = await signUp();
    for (const targetUserId of [authorUser.user.id, outsiderMember.user.id]) {
      await addActiveMember({ managerAccessToken: owner.accessToken, workspaceSlug: workspace.slug, targetUserId, role: "MEMBER" });
      await addActiveProjectMember({
        managerAccessToken: owner.accessToken,
        workspaceSlug: workspace.slug,
        projectSlug: project.slug,
        targetUserId,
        role: "MEMBER",
      });
    }
    const comment = await createComment(authorUser.accessToken, workspace.slug, project.slug, task.taskNumber);

    const res = await request(app)
      .patch(
        `/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/comments/${comment.id}/delete`,
      )
      .set("Authorization", `Bearer ${outsiderMember.accessToken}`);

    expect(res.status).toBe(403);
  });

  it("409s when the comment is already deleted", async () => {
    const { owner, workspace, project, task } = await setupOwnerProjectTask();
    const comment = await createComment(owner.accessToken, workspace.slug, project.slug, task.taskNumber);
    await request(app)
      .patch(
        `/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/comments/${comment.id}/delete`,
      )
      .set("Authorization", `Bearer ${owner.accessToken}`);

    const res = await request(app)
      .patch(
        `/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/comments/${comment.id}/delete`,
      )
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(409);
  });
});

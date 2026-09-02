import { describe, expect, it } from "vitest";
import request from "supertest";
import {
  addActiveMember,
  addActiveProjectMember,
  app,
  createProject,
  createWorkspace,
  signUp,
} from "../helpers/api.ts";

async function setupOwnerProject() {
  const owner = await signUp();
  const workspace = await createWorkspace(owner.accessToken);
  const project = await createProject(owner.accessToken, workspace.slug);
  return { owner, workspace, project };
}

describe("POST /workspaces/:workspaceSlug/projects/:projectSlug/members", () => {
  it("lets the project OWNER add an active workspace member", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const invitee = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: invitee.user.id,
      role: "MEMBER",
    });

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ userId: invitee.user.id, role: "MEMBER" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ userId: invitee.user.id, role: "MEMBER", isActive: true });
    expect(res.body.joinedAt).not.toBeNull();
  });

  it("400s when the target is not yet an active workspace member (still PENDING)", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const invitee = await signUp();
    await request(app)
      .post(`/api/workspaces/${workspace.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ userId: invitee.user.id, role: "MEMBER" }); // se queda en PENDING, sin activar

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ userId: invitee.user.id, role: "MEMBER" });

    expect(res.status).toBe(400);
  });

  it("404s when the target is not a workspace member at all", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const outsider = await signUp();

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ userId: outsider.user.id, role: "MEMBER" });

    expect(res.status).toBe(404);
  });

  it("400s when the target is already a project member", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const invitee = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: invitee.user.id,
      role: "MEMBER",
    });
    await addActiveProjectMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      targetUserId: invitee.user.id,
      role: "MEMBER",
    });

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ userId: invitee.user.id, role: "MEMBER" });

    expect(res.status).toBe(400);
  });

  it("forbids a plain project MEMBER from adding members", async () => {
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
    const invitee = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: invitee.user.id,
      role: "MEMBER",
    });

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members`)
      .set("Cookie", `accessToken=${memberUser.accessToken}`)
      .send({ userId: invitee.user.id, role: "MEMBER" });

    expect(res.status).toBe(403);
  });

  it("forbids an ADMIN from assigning the OWNER role", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const adminUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: adminUser.user.id,
      role: "MEMBER",
    });
    await addActiveProjectMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      targetUserId: adminUser.user.id,
      role: "ADMIN",
    });
    const invitee = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: invitee.user.id,
      role: "MEMBER",
    });

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members`)
      .set("Cookie", `accessToken=${adminUser.accessToken}`)
      .send({ userId: invitee.user.id, role: "OWNER" });

    expect(res.status).toBe(403);
  });
});

describe("GET /workspaces/:workspaceSlug/projects/:projectSlug/members", () => {
  it("only lists active members by default", async () => {
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
    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members/${memberUser.user.id}/deactivate`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const userIds = res.body.data.map((m: { userId: string }) => m.userId);
    expect(userIds).toContain(owner.user.id);
    expect(userIds).not.toContain(memberUser.user.id);
  });

  it("lists both active and inactive members when isActive is passed twice", async () => {
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
    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members/${memberUser.user.id}/deactivate`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members`)
      .query({ isActive: ["true", "false"] })
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const userIds = res.body.data.map((m: { userId: string }) => m.userId);
    expect(userIds).toContain(owner.user.id);
    expect(userIds).toContain(memberUser.user.id);
  });

  it("filters members by the user's name via search", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const memberUser = await signUp({ name: "Zendaya Ocampo" });
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

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members`)
      .query({ search: "zendaya" })
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const userIds = res.body.data.map((m: { userId: string }) => m.userId);
    expect(userIds).toEqual([memberUser.user.id]);
  });
});

describe("PATCH /workspaces/:workspaceSlug/projects/:projectSlug/members/:userId", () => {
  it("lets the project OWNER change a member's role", async () => {
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

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members/${memberUser.user.id}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ role: "ADMIN" });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe("ADMIN");
  });

  it("400s when the actor tries to change their own role", async () => {
    const { owner, workspace, project } = await setupOwnerProject();

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members/${owner.user.id}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ role: "ADMIN" });

    expect(res.status).toBe(400);
  });

  it("400s when the target member is inactive", async () => {
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
    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members/${memberUser.user.id}/deactivate`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members/${memberUser.user.id}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ role: "ADMIN" });

    expect(res.status).toBe(400);
  });

  it("forbids an ADMIN from changing an OWNER's role", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const adminUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: adminUser.user.id,
      role: "MEMBER",
    });
    await addActiveProjectMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      targetUserId: adminUser.user.id,
      role: "ADMIN",
    });

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members/${owner.user.id}`)
      .set("Cookie", `accessToken=${adminUser.accessToken}`)
      .send({ role: "MEMBER" });

    expect(res.status).toBe(403);
  });

  it("400s when the new role matches the current role", async () => {
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

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members/${memberUser.user.id}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ role: "MEMBER" });

    expect(res.status).toBe(400);
  });
});

describe("PATCH /workspaces/:workspaceSlug/projects/:projectSlug/members/:userId/deactivate", () => {
  it("lets the project OWNER deactivate a member", async () => {
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
      role: "ADMIN",
    });

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members/${memberUser.user.id}/deactivate`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(204);

    const list = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members`)
      .query({ isActive: "false" })
      .set("Cookie", `accessToken=${owner.accessToken}`);
    const deactivated = list.body.data.find((m: { userId: string }) => m.userId === memberUser.user.id);
    expect(deactivated).toMatchObject({ role: "MEMBER", isActive: false });
    expect(deactivated.joinedAt).toBeNull();
  });

  it("400s when the actor tries to deactivate themselves", async () => {
    const { owner, workspace, project } = await setupOwnerProject();

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members/${owner.user.id}/deactivate`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(400);
  });

  it("forbids an ADMIN from deactivating an OWNER", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const adminUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: adminUser.user.id,
      role: "MEMBER",
    });
    await addActiveProjectMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      targetUserId: adminUser.user.id,
      role: "ADMIN",
    });

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members/${owner.user.id}/deactivate`)
      .set("Cookie", `accessToken=${adminUser.accessToken}`);

    expect(res.status).toBe(403);
  });

  it("400s when the member is already inactive", async () => {
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
    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members/${memberUser.user.id}/deactivate`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members/${memberUser.user.id}/deactivate`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(400);
  });
});

import { describe, expect, it } from "vitest";
import request from "supertest";
import { app, addActiveMember, createWorkspace, deactivateUser, signUp } from "../helpers/api.ts";

async function setupOwnerWorkspace() {
  const owner = await signUp();
  const workspace = await createWorkspace(owner.accessToken);
  return { owner, workspace };
}

describe("POST /workspaces/:workspaceSlug/members", () => {
  it("lets the OWNER add a member, starting as PENDING", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const invitee = await signUp();

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ userId: invitee.user.id, role: "MEMBER" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      userId: invitee.user.id,
      role: "MEMBER",
      status: "PENDING",
    });
  });

  it("lets the OWNER assign the OWNER role", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const invitee = await signUp();

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ userId: invitee.user.id, role: "OWNER" });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe("OWNER");
  });

  it("lets an ADMIN add a member", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const adminUser = await signUp();
    const admin = await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: adminUser.user.id,
      role: "ADMIN",
    });
    const invitee = await signUp();

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/members`)
      .set("Cookie", `accessToken=${adminUser.accessToken}`)
      .send({ userId: invitee.user.id, role: "MEMBER" });

    expect(res.status).toBe(201);
    expect(admin.role).toBe("ADMIN");
  });

  it("forbids an ADMIN from assigning the OWNER role", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const adminUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: adminUser.user.id,
      role: "ADMIN",
    });
    const invitee = await signUp();

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/members`)
      .set("Cookie", `accessToken=${adminUser.accessToken}`)
      .send({ userId: invitee.user.id, role: "OWNER" });

    expect(res.status).toBe(403);
  });

  it("forbids a plain MEMBER from adding members", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const memberUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: memberUser.user.id,
      role: "MEMBER",
    });
    const invitee = await signUp();

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/members`)
      .set("Cookie", `accessToken=${memberUser.accessToken}`)
      .send({ userId: invitee.user.id, role: "MEMBER" });

    expect(res.status).toBe(403);
  });

  it("404s when the target user does not exist", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ userId: "cmimr0j5x0000ttbjqf03ymab", role: "MEMBER" });

    expect(res.status).toBe(404);
  });

  it("400s when the target user is inactive", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const invitee = await signUp();
    await deactivateUser(invitee.user.id);

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ userId: invitee.user.id, role: "MEMBER" });

    expect(res.status).toBe(400);
  });

  it("400s when the target user is already a member", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const invitee = await signUp();
    await request(app)
      .post(`/api/workspaces/${workspace.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ userId: invitee.user.id, role: "MEMBER" });

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ userId: invitee.user.id, role: "MEMBER" });

    expect(res.status).toBe(400);
  });
});

describe("GET /workspaces/:workspaceSlug/members", () => {
  it("only lists ACTIVE members by default", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const invitee = await signUp();
    await request(app)
      .post(`/api/workspaces/${workspace.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ userId: invitee.user.id, role: "MEMBER" }); // stays PENDING

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(200);
    const userIds = res.body.data.map((m: { userId: string }) => m.userId);
    expect(userIds).toContain(owner.user.id);
    expect(userIds).not.toContain(invitee.user.id);
  });

  it("returns PENDING members when explicitly filtered", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const invitee = await signUp();
    await request(app)
      .post(`/api/workspaces/${workspace.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ userId: invitee.user.id, role: "MEMBER" });

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/members`)
      .query({ status: "PENDING" })
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(200);
    const userIds = res.body.data.map((m: { userId: string }) => m.userId);
    expect(userIds).toEqual([invitee.user.id]);
  });

  it("includes the user data for each member", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(200);
    const ownerEntry = res.body.data.find((m: { userId: string }) => m.userId === owner.user.id);
    expect(ownerEntry.user).toMatchObject({
      id: owner.user.id,
      name: owner.user.name,
      email: owner.user.email,
    });
  });
});

describe("PATCH /workspaces/:workspaceSlug/members/:userId/activate", () => {
  it("activates a PENDING member", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const invitee = await signUp();
    await request(app)
      .post(`/api/workspaces/${workspace.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ userId: invitee.user.id, role: "MEMBER" });

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/members/${invitee.user.id}/activate`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(204);

    const list = await request(app)
      .get(`/api/workspaces/${workspace.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`);
    const activated = list.body.data.find((m: { userId: string }) => m.userId === invitee.user.id);
    expect(activated).toMatchObject({ status: "ACTIVE" });
    expect(activated.joinedAt).not.toBeNull();
  });

  it("400s when the member is already ACTIVE", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const invitee = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: invitee.user.id,
      role: "MEMBER",
    });

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/members/${invitee.user.id}/activate`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(400);
  });

  it("400s when the member was REMOVED", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const invitee = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: invitee.user.id,
      role: "MEMBER",
    });
    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/members/${invitee.user.id}/remove`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/members/${invitee.user.id}/activate`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(400);
  });

  it("forbids a non-manager from activating members", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const memberUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: memberUser.user.id,
      role: "MEMBER",
    });
    const invitee = await signUp();
    await request(app)
      .post(`/api/workspaces/${workspace.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ userId: invitee.user.id, role: "MEMBER" });

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/members/${invitee.user.id}/activate`)
      .set("Cookie", `accessToken=${memberUser.accessToken}`);

    expect(res.status).toBe(403);
  });

  it("forbids an ADMIN from activating an OWNER", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const adminUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: adminUser.user.id,
      role: "ADMIN",
    });
    const coOwner = await signUp();
    await request(app)
      .post(`/api/workspaces/${workspace.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ userId: coOwner.user.id, role: "OWNER" });

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/members/${coOwner.user.id}/activate`)
      .set("Cookie", `accessToken=${adminUser.accessToken}`);

    expect(res.status).toBe(403);
  });

  it("404s when the target is not a member of the workspace", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const outsider = await signUp();

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/members/${outsider.user.id}/activate`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(404);
  });
});

describe("PATCH /workspaces/:workspaceSlug/members/:userId", () => {
  it("lets the OWNER change a member's role", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const memberUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: memberUser.user.id,
      role: "MEMBER",
    });

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/members/${memberUser.user.id}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ role: "ADMIN" });

    expect(res.status).toBe(204);

    const list = await request(app)
      .get(`/api/workspaces/${workspace.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`);
    const updated = list.body.data.find((m: { userId: string }) => m.userId === memberUser.user.id);
    expect(updated.role).toBe("ADMIN");
  });

  it("400s when the actor tries to change their own role", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/members/${owner.user.id}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ role: "ADMIN" });

    expect(res.status).toBe(400);
  });

  it("400s when the target member was REMOVED", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const memberUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: memberUser.user.id,
      role: "MEMBER",
    });
    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/members/${memberUser.user.id}/remove`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/members/${memberUser.user.id}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ role: "ADMIN" });

    expect(res.status).toBe(400);
  });

  it("forbids an ADMIN from changing an OWNER's role", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const adminUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: adminUser.user.id,
      role: "ADMIN",
    });

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/members/${owner.user.id}`)
      .set("Cookie", `accessToken=${adminUser.accessToken}`)
      .send({ role: "MEMBER" });

    expect(res.status).toBe(403);
  });

  it("forbids an ADMIN from assigning the OWNER role", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const adminUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: adminUser.user.id,
      role: "ADMIN",
    });
    const memberUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: memberUser.user.id,
      role: "MEMBER",
    });

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/members/${memberUser.user.id}`)
      .set("Cookie", `accessToken=${adminUser.accessToken}`)
      .send({ role: "OWNER" });

    expect(res.status).toBe(403);
  });

  it("400s when the new role matches the current role", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const memberUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: memberUser.user.id,
      role: "MEMBER",
    });

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/members/${memberUser.user.id}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ role: "MEMBER" });

    expect(res.status).toBe(400);
  });
});

describe("PATCH /workspaces/:workspaceSlug/members/:userId/remove", () => {
  it("lets the OWNER remove a member", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const memberUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: memberUser.user.id,
      role: "ADMIN",
    });

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/members/${memberUser.user.id}/remove`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(204);

    const list = await request(app)
      .get(`/api/workspaces/${workspace.slug}/members`)
      .query({ status: "REMOVED" })
      .set("Cookie", `accessToken=${owner.accessToken}`);
    const removed = list.body.data.find((m: { userId: string }) => m.userId === memberUser.user.id);
    expect(removed).toMatchObject({ status: "REMOVED", role: "MEMBER" });
    expect(removed.joinedAt).toBeNull();
  });

  it("400s when the member is already REMOVED", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const memberUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: memberUser.user.id,
      role: "MEMBER",
    });
    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/members/${memberUser.user.id}/remove`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/members/${memberUser.user.id}/remove`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(400);
  });

  it("forbids an ADMIN from removing an OWNER", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const adminUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: adminUser.user.id,
      role: "ADMIN",
    });

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/members/${owner.user.id}/remove`)
      .set("Cookie", `accessToken=${adminUser.accessToken}`);

    expect(res.status).toBe(403);
  });

  it("400s when the actor tries to remove themselves", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/members/${owner.user.id}/remove`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(400);
  });
});

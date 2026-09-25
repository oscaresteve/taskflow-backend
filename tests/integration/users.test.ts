import { describe, expect, it } from "vitest";
import request from "supertest";
import { addActiveMember, app, createWorkspace, deactivateUser, signUp } from "../helpers/api.ts";

describe("GET /users", () => {
  it("401s without a token", async () => {
    const res = await request(app).get("/api/users");

    expect(res.status).toBe(401);
  });

  it("lists other active users but excludes the requester", async () => {
    const self = await signUp({ name: "Self User" });
    const other = await signUp({ name: "Other User" });

    const res = await request(app).get("/api/users").set("Cookie", `accessToken=${self.accessToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.map((u: { id: string }) => u.id);
    expect(ids).toContain(other.user.id);
    expect(ids).not.toContain(self.user.id);
  });

  it("excludes deactivated users", async () => {
    const self = await signUp();
    const other = await signUp({ name: "Inactive User" });
    await deactivateUser(other.user.id);

    const res = await request(app).get("/api/users").set("Cookie", `accessToken=${self.accessToken}`);

    const ids = res.body.data.map((u: { id: string }) => u.id);
    expect(ids).not.toContain(other.user.id);
  });

  it("filters by search matching name, case-insensitively", async () => {
    const self = await signUp();
    const match = await signUp({ name: "Ada Lovelace" });
    await signUp({ name: "Someone Else" });

    const res = await request(app)
      .get("/api/users")
      .query({ search: "ada" })
      .set("Cookie", `accessToken=${self.accessToken}`);

    const ids = res.body.data.map((u: { id: string }) => u.id);
    expect(ids).toEqual([match.user.id]);
  });

  it("filters by search matching email, case-insensitively", async () => {
    const self = await signUp();
    const match = await signUp({ name: "Grace Hopper", email: "grace.hopper@example.com" });
    await signUp({ name: "Someone Else" });

    const res = await request(app)
      .get("/api/users")
      .query({ search: "GRACE.HOPPER" })
      .set("Cookie", `accessToken=${self.accessToken}`);

    const ids = res.body.data.map((u: { id: string }) => u.id);
    expect(ids).toEqual([match.user.id]);
  });

  it("paginates the results", async () => {
    const self = await signUp();
    for (let i = 0; i < 3; i += 1) {
      await signUp();
    }

    const res = await request(app)
      .get("/api/users")
      .query({ page: 1, limit: 2 })
      .set("Cookie", `accessToken=${self.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination).toEqual(expect.objectContaining({ page: 1, limit: 2, total: 3 }));
  });

  describe("workspaceSlug filter", () => {
    it("excludes an ACTIVE member of the workspace", async () => {
      const owner = await signUp();
      const activeMember = await signUp({ name: "Active Member" });
      const outsider = await signUp({ name: "Outsider" });
      const workspace = await createWorkspace(owner.accessToken);
      await addActiveMember({
        managerAccessToken: owner.accessToken,
        workspaceSlug: workspace.slug,
        targetUserId: activeMember.user.id,
        role: "MEMBER",
      });

      const res = await request(app)
        .get("/api/users")
        .query({ workspaceSlug: workspace.slug })
        .set("Cookie", `accessToken=${owner.accessToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((u: { id: string }) => u.id);
      expect(ids).not.toContain(activeMember.user.id);
      expect(ids).toContain(outsider.user.id);
    });

    it("excludes a PENDING (not yet activated) member of the workspace", async () => {
      const owner = await signUp();
      const invitee = await signUp({ name: "Pending Invitee" });
      const workspace = await createWorkspace(owner.accessToken);
      await request(app)
        .post(`/api/workspaces/${workspace.slug}/members`)
        .set("Cookie", `accessToken=${owner.accessToken}`)
        .send({ userId: invitee.user.id, role: "MEMBER" }); // se queda en PENDING, sin activar

      const res = await request(app)
        .get("/api/users")
        .query({ workspaceSlug: workspace.slug })
        .set("Cookie", `accessToken=${owner.accessToken}`);

      const ids = res.body.data.map((u: { id: string }) => u.id);
      expect(ids).not.toContain(invitee.user.id);
    });

    it("excludes a REMOVED member of the workspace (re-invite is blocked at the unique constraint)", async () => {
      const owner = await signUp();
      const removedMember = await signUp({ name: "Removed Member" });
      const workspace = await createWorkspace(owner.accessToken);
      await addActiveMember({
        managerAccessToken: owner.accessToken,
        workspaceSlug: workspace.slug,
        targetUserId: removedMember.user.id,
        role: "MEMBER",
      });
      await request(app)
        .patch(`/api/workspaces/${workspace.slug}/members/${removedMember.user.id}/remove`)
        .set("Cookie", `accessToken=${owner.accessToken}`);

      const res = await request(app)
        .get("/api/users")
        .query({ workspaceSlug: workspace.slug })
        .set("Cookie", `accessToken=${owner.accessToken}`);

      const ids = res.body.data.map((u: { id: string }) => u.id);
      expect(ids).not.toContain(removedMember.user.id);
    });

    it("does not exclude members of a different workspace", async () => {
      const owner = await signUp();
      const otherWorkspaceMember = await signUp({ name: "Member Elsewhere" });
      const workspace = await createWorkspace(owner.accessToken, "Target Workspace");
      const otherWorkspace = await createWorkspace(otherWorkspaceMember.accessToken, "Other Workspace");
      await addActiveMember({
        managerAccessToken: otherWorkspaceMember.accessToken,
        workspaceSlug: otherWorkspace.slug,
        targetUserId: owner.user.id,
        role: "MEMBER",
      });

      const res = await request(app)
        .get("/api/users")
        .query({ workspaceSlug: workspace.slug })
        .set("Cookie", `accessToken=${owner.accessToken}`);

      const ids = res.body.data.map((u: { id: string }) => u.id);
      expect(ids).toContain(otherWorkspaceMember.user.id);
    });

    it("403s when the requester is not an active member of the given workspace", async () => {
      const owner = await signUp();
      const outsider = await signUp();
      const workspace = await createWorkspace(owner.accessToken);

      const res = await request(app)
        .get("/api/users")
        .query({ workspaceSlug: workspace.slug })
        .set("Cookie", `accessToken=${outsider.accessToken}`);

      expect(res.status).toBe(403);
    });

    it("404s when the workspace does not exist", async () => {
      const owner = await signUp();

      const res = await request(app)
        .get("/api/users")
        .query({ workspaceSlug: "does-not-exist" })
        .set("Cookie", `accessToken=${owner.accessToken}`);

      expect(res.status).toBe(404);
    });
  });
});

describe("GET /users/:userId", () => {
  it("401s without a token", async () => {
    const self = await signUp();

    const res = await request(app).get(`/api/users/${self.user.id}`);

    expect(res.status).toBe(401);
  });

  it("returns your own profile without exposing the password hash", async () => {
    const self = await signUp({ name: "Ada Lovelace", email: "ada@example.com" });

    const res = await request(app).get(`/api/users/${self.user.id}`).set("Cookie", `accessToken=${self.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: self.user.id,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      isActive: true,
    });
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("returns a user you share a workspace with", async () => {
    const owner = await signUp();
    const member = await signUp({ name: "Grace Hopper" });
    const workspace = await createWorkspace(owner.accessToken);
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: member.user.id,
      role: "MEMBER",
    });

    const res = await request(app)
      .get(`/api/users/${owner.user.id}`)
      .set("Cookie", `accessToken=${member.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(owner.user.id);
  });

  it("returns a user you share no workspace with", async () => {
    const self = await signUp();
    const stranger = await signUp();

    const res = await request(app)
      .get(`/api/users/${stranger.user.id}`)
      .set("Cookie", `accessToken=${self.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(stranger.user.id);
  });

  it("404s when the user does not exist", async () => {
    const self = await signUp();

    const res = await request(app).get("/api/users/cnonexistentuser000000000").set("Cookie", `accessToken=${self.accessToken}`);

    expect(res.status).toBe(404);
  });

  // A diferencia de GET /users, que oculta las cuentas desactivadas porque sirve para invitar, la
  // ficha tiene que seguir resolviendose: quien fue eliminado del espacio sigue siendo el asignado
  // de tareas y el autor de comentarios que los demas ven, y es aqui donde se muestra que ya no
  // esta activo.
  it("still returns a removed member whose account was deactivated", async () => {
    const owner = await signUp();
    const removedMember = await signUp({ name: "Removed Member" });
    const workspace = await createWorkspace(owner.accessToken);
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: removedMember.user.id,
      role: "MEMBER",
    });
    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/members/${removedMember.user.id}/remove`)
      .set("Cookie", `accessToken=${owner.accessToken}`);
    await deactivateUser(removedMember.user.id);

    const res = await request(app)
      .get(`/api/users/${removedMember.user.id}`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: removedMember.user.id, isActive: false });
  });
});

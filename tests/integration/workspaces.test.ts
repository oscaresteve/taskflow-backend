import { describe, expect, it } from "vitest";
import request from "supertest";
import { addActiveMember, app, createWorkspace, signUp } from "../helpers/api.ts";

describe("POST /workspaces", () => {
  it("creates the workspace and makes the creator an active OWNER", async () => {
    const owner = await signUp();
    const workspace = await createWorkspace(owner.accessToken, "Acme Inc");

    expect(workspace.slug).toBe("acme-inc");

    const members = await request(app)
      .get(`/api/workspaces/${workspace.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(members.body.data).toContainEqual(
      expect.objectContaining({ userId: owner.user.id, role: "OWNER", status: "ACTIVE" }),
    );
  });
});

describe("GET /workspaces", () => {
  it("only lists workspaces the user belongs to", async () => {
    const owner = await signUp();
    const other = await signUp();
    await createWorkspace(owner.accessToken, "Mine");
    await createWorkspace(other.accessToken, "Not Mine");

    const res = await request(app).get("/api/workspaces").set("Cookie", `accessToken=${owner.accessToken}`);

    const names = res.body.data.map((w: { name: string }) => w.name);
    expect(names).toEqual(["Mine"]);
  });
});

describe("GET /workspaces/:slug", () => {
  it("403s when the user is not a member", async () => {
    const owner = await signUp();
    const outsider = await signUp();
    const workspace = await createWorkspace(owner.accessToken);

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}`)
      .set("Cookie", `accessToken=${outsider.accessToken}`);

    expect(res.status).toBe(403);
  });

  it("404s when the workspace does not exist", async () => {
    const owner = await signUp();

    const res = await request(app)
      .get("/api/workspaces/does-not-exist")
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(404);
  });
});

describe("PATCH /workspaces/:slug", () => {
  it("forbids a plain MEMBER from updating the workspace", async () => {
    const owner = await signUp();
    const workspace = await createWorkspace(owner.accessToken);
    const memberUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: memberUser.user.id,
      role: "MEMBER",
    });

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}`)
      .set("Cookie", `accessToken=${memberUser.accessToken}`)
      .send({ name: "New Name" });

    expect(res.status).toBe(403);
  });

  it("lets the OWNER update the workspace", async () => {
    const owner = await signUp();
    const workspace = await createWorkspace(owner.accessToken);

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ name: "New Name" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("New Name");
  });
});

describe("PATCH /workspaces/:slug/deactivate", () => {
  it("lets the OWNER deactivate the workspace", async () => {
    const owner = await signUp();
    const workspace = await createWorkspace(owner.accessToken);

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/deactivate`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(204);
  });

  it("404s on a second deactivate (an inactive workspace is no longer reachable by slug)", async () => {
    const owner = await signUp();
    const workspace = await createWorkspace(owner.accessToken);
    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/deactivate`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/deactivate`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(404);
  });
});

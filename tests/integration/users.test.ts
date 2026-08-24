import { describe, expect, it } from "vitest";
import request from "supertest";
import { app, deactivateUser, signUp } from "../helpers/api.ts";

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
});

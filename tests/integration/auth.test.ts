import { describe, expect, it } from "vitest";
import request from "supertest";
import { app, signUp } from "../helpers/api.ts";

describe("POST /auth/sign-up", () => {
  it("creates a user and returns an access token", async () => {
    const res = await request(app)
      .post("/api/auth/sign-up")
      .send({ name: "Alice", email: "alice@example.com", password: "Password123" });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: "Alice", email: "alice@example.com" });
    expect(typeof res.body.accessToken).toBe("string");
  });

  it("409s when the email is already registered", async () => {
    await signUp({ email: "duplicate@example.com" });

    const res = await request(app)
      .post("/api/auth/sign-up")
      .send({ name: "Bob", email: "duplicate@example.com", password: "Password123" });

    expect(res.status).toBe(409);
  });
});

describe("POST /auth/sign-in", () => {
  it("returns an access token with valid credentials", async () => {
    await signUp({ email: "login@example.com", password: "Password123" });

    const res = await request(app)
      .post("/api/auth/sign-in")
      .send({ email: "login@example.com", password: "Password123" });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe("string");
  });

  it("401s with the wrong password", async () => {
    await signUp({ email: "wrongpass@example.com", password: "Password123" });

    const res = await request(app)
      .post("/api/auth/sign-in")
      .send({ email: "wrongpass@example.com", password: "WrongPassword123" });

    expect(res.status).toBe(401);
  });

  it("401s when the email does not exist", async () => {
    const res = await request(app)
      .post("/api/auth/sign-in")
      .send({ email: "unknown@example.com", password: "Password123" });

    expect(res.status).toBe(401);
  });
});

describe("GET /auth/me", () => {
  it("returns the authenticated user", async () => {
    const { user, accessToken } = await signUp();

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
  });

  it("401s without a token", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
  });
});

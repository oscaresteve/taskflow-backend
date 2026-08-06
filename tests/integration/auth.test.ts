import { describe, expect, it } from "vitest";
import request from "supertest";
import { app, signUp } from "../helpers/api.ts";

describe("POST /auth/sign-up", () => {
  it("creates a user and sets httpOnly auth cookies", async () => {
    const res = await request(app)
      .post("/api/auth/sign-up")
      .send({ name: "Alice", email: "alice@example.com", password: "Password123" });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: "Alice", email: "alice@example.com" });
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();

    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((cookie: string) => cookie.startsWith("accessToken=") && cookie.includes("HttpOnly"))).toBe(
      true,
    );
    expect(cookies.some((cookie: string) => cookie.startsWith("refreshToken=") && cookie.includes("HttpOnly"))).toBe(
      true,
    );
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
  it("sets httpOnly auth cookies with valid credentials", async () => {
    await signUp({ email: "login@example.com", password: "Password123" });

    const res = await request(app)
      .post("/api/auth/sign-in")
      .send({ email: "login@example.com", password: "Password123" });

    expect(res.status).toBe(200);
    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((cookie: string) => cookie.startsWith("accessToken="))).toBe(true);
    expect(cookies.some((cookie: string) => cookie.startsWith("refreshToken="))).toBe(true);
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

    const res = await request(app).get("/api/auth/me").set("Cookie", `accessToken=${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
  });

  it("401s without a token", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
  });
});

describe("POST /auth/refresh", () => {
  it("sets a new access token cookie with a valid refresh token", async () => {
    const { refreshToken } = await signUp();

    const res = await request(app).post("/api/auth/refresh").set("Cookie", `refreshToken=${refreshToken}`);

    expect(res.status).toBe(204);
    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((cookie: string) => cookie.startsWith("accessToken="))).toBe(true);
  });

  it("401s without a refresh token", async () => {
    const res = await request(app).post("/api/auth/refresh");

    expect(res.status).toBe(401);
  });

  it("401s with a made-up refresh token", async () => {
    const res = await request(app).post("/api/auth/refresh").set("Cookie", "refreshToken=not-a-real-token");

    expect(res.status).toBe(401);
  });

  it("401s with a refresh token that was already signed out", async () => {
    const { refreshToken } = await signUp();

    await request(app).post("/api/auth/sign-out").set("Cookie", `refreshToken=${refreshToken}`);

    const res = await request(app).post("/api/auth/refresh").set("Cookie", `refreshToken=${refreshToken}`);

    expect(res.status).toBe(401);
  });
});

describe("POST /auth/sign-out", () => {
  it("revokes the refresh token and clears the auth cookies", async () => {
    const { refreshToken } = await signUp();

    const res = await request(app).post("/api/auth/sign-out").set("Cookie", `refreshToken=${refreshToken}`);

    expect(res.status).toBe(204);
    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((cookie: string) => cookie.startsWith("accessToken=;"))).toBe(true);
    expect(cookies.some((cookie: string) => cookie.startsWith("refreshToken=;"))).toBe(true);

    const refreshRes = await request(app).post("/api/auth/refresh").set("Cookie", `refreshToken=${refreshToken}`);
    expect(refreshRes.status).toBe(401);
  });

  it("204s even with an unknown refresh token", async () => {
    const res = await request(app).post("/api/auth/sign-out").set("Cookie", "refreshToken=not-a-real-token");

    expect(res.status).toBe(204);
  });

  it("204s even with no refresh token at all", async () => {
    const res = await request(app).post("/api/auth/sign-out");

    expect(res.status).toBe(204);
  });
});

import { describe, expect, it } from "vitest";
import request from "supertest";
import { app, signUp, uploadTestUserAvatarFile } from "../helpers/api.ts";
import { MAX_AVATAR_SIZE_BYTES } from "../../src/shared/schemas/common.schema.ts";

describe("POST /auth/sign-up", () => {
  it("creates a user and sets httpOnly auth cookies", async () => {
    const res = await request(app).post("/api/auth/sign-up").send({
      firstName: "Alice",
      lastName: "Doe",
      username: "alice",
      email: "alice@example.com",
      password: "Password123",
      confirmPassword: "Password123",
      timezone: "UTC",
      locale: "en",
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      firstName: "Alice",
      lastName: "Doe",
      username: "alice",
      email: "alice@example.com",
    });
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

    const res = await request(app).post("/api/auth/sign-up").send({
      firstName: "Bob",
      lastName: "Doe",
      username: "bob",
      email: "duplicate@example.com",
      password: "Password123",
      confirmPassword: "Password123",
      timezone: "UTC",
      locale: "en",
    });

    expect(res.status).toBe(409);
  });

  it("409s when the username is already taken", async () => {
    await signUp({ username: "taken" });

    const res = await request(app).post("/api/auth/sign-up").send({
      firstName: "Dave",
      lastName: "Doe",
      username: "taken",
      email: "dave@example.com",
      password: "Password123",
      confirmPassword: "Password123",
      timezone: "UTC",
      locale: "en",
    });

    expect(res.status).toBe(409);
  });

  it("400s when the username has characters a mention could not carry", async () => {
    const res = await request(app).post("/api/auth/sign-up").send({
      firstName: "Erin",
      lastName: "Doe",
      username: "erin doe!",
      email: "erin@example.com",
      password: "Password123",
      confirmPassword: "Password123",
      timezone: "UTC",
      locale: "en",
    });

    expect(res.status).toBe(400);
  });

  it("lowercases the username so uniqueness does not depend on how it was typed", async () => {
    const res = await request(app).post("/api/auth/sign-up").send({
      firstName: "Frank",
      lastName: "Doe",
      username: "FRANK",
      email: "frank@example.com",
      password: "Password123",
      confirmPassword: "Password123",
      timezone: "UTC",
      locale: "en",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe("frank");
  });

  it("400s with an unsupported locale", async () => {
    const res = await request(app).post("/api/auth/sign-up").send({
      firstName: "Carol",
      lastName: "Doe",
      username: "carol",
      email: "carol@example.com",
      password: "Password123",
      confirmPassword: "Password123",
      timezone: "UTC",
      locale: "fr",
    });

    expect(res.status).toBe(400);
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

describe("PATCH /auth/me", () => {
  it("updates the authenticated user's locale", async () => {
    const { accessToken } = await signUp();

    const res = await request(app)
      .patch("/api/auth/me")
      .set("Cookie", `accessToken=${accessToken}`)
      .send({ locale: "es" });

    expect(res.status).toBe(200);
    expect(res.body.locale).toBe("es");
  });

  it("updates the authenticated user's timezone", async () => {
    const { accessToken } = await signUp();

    const res = await request(app)
      .patch("/api/auth/me")
      .set("Cookie", `accessToken=${accessToken}`)
      .send({ timezone: "America/New_York" });

    expect(res.status).toBe(200);
    expect(res.body.timezone).toBe("America/New_York");
  });

  it("updates the authenticated user's first and last name", async () => {
    const { accessToken } = await signUp();

    const res = await request(app)
      .patch("/api/auth/me")
      .set("Cookie", `accessToken=${accessToken}`)
      .send({ firstName: "Updated", lastName: "Name" });

    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe("Updated");
    expect(res.body.lastName).toBe("Name");
  });

  it("400s with a first name that is too short", async () => {
    const { accessToken } = await signUp();

    const res = await request(app)
      .patch("/api/auth/me")
      .set("Cookie", `accessToken=${accessToken}`)
      .send({ firstName: "A" });

    expect(res.status).toBe(400);
  });

  it("400s with an empty timezone", async () => {
    const { accessToken } = await signUp();

    const res = await request(app)
      .patch("/api/auth/me")
      .set("Cookie", `accessToken=${accessToken}`)
      .send({ timezone: "" });

    expect(res.status).toBe(400);
  });

  it("400s with an unsupported locale", async () => {
    const { accessToken } = await signUp();

    const res = await request(app)
      .patch("/api/auth/me")
      .set("Cookie", `accessToken=${accessToken}`)
      .send({ locale: "fr" });

    expect(res.status).toBe(400);
  });

  it("400s with an empty body", async () => {
    const { accessToken } = await signUp();

    const res = await request(app).patch("/api/auth/me").set("Cookie", `accessToken=${accessToken}`).send({});

    expect(res.status).toBe(400);
  });

  it("401s without a token", async () => {
    const res = await request(app).patch("/api/auth/me").send({ locale: "es" });

    expect(res.status).toBe(401);
  });
});

describe("POST /auth/me/avatar/upload-url", () => {
  it("signs an upload URL for an allowed content type and size", async () => {
    const { accessToken } = await signUp();

    const res = await request(app)
      .post("/api/auth/me/avatar/upload-url")
      .set("Cookie", `accessToken=${accessToken}`)
      .send({ contentType: "image/png", fileSize: 1024 });

    expect(res.status).toBe(200);
    expect(res.body.uploadUrl).toBeTypeOf("string");
    expect(res.body.key).toBeTypeOf("string");
  });

  it("400s when fileSize exceeds the max allowed size", async () => {
    const { accessToken } = await signUp();

    const res = await request(app)
      .post("/api/auth/me/avatar/upload-url")
      .set("Cookie", `accessToken=${accessToken}`)
      .send({ contentType: "image/png", fileSize: MAX_AVATAR_SIZE_BYTES + 1 });

    expect(res.status).toBe(400);
  });

  it("401s without a token", async () => {
    const res = await request(app)
      .post("/api/auth/me/avatar/upload-url")
      .send({ contentType: "image/png", fileSize: 1024 });

    expect(res.status).toBe(401);
  });
});

describe("PUT /auth/me/avatar", () => {
  it("confirms a real upload and exposes the public avatarUrl afterwards", async () => {
    const { accessToken } = await signUp();
    const { key } = await uploadTestUserAvatarFile({ actorAccessToken: accessToken });

    const confirmRes = await request(app)
      .put("/api/auth/me/avatar")
      .set("Cookie", `accessToken=${accessToken}`)
      .send({ key });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.avatarUrl).toEqual(expect.stringContaining(key));

    const getRes = await request(app).get("/api/auth/me").set("Cookie", `accessToken=${accessToken}`);
    expect(getRes.body.avatarUrl).toBe(confirmRes.body.avatarUrl);

    const publicRes = await fetch(confirmRes.body.avatarUrl);
    expect(publicRes.status).toBe(200);
  });

  it("replaces the previous avatar and deletes the old object from the bucket", async () => {
    const { accessToken } = await signUp();
    const first = await uploadTestUserAvatarFile({ actorAccessToken: accessToken });
    const firstConfirmRes = await request(app)
      .put("/api/auth/me/avatar")
      .set("Cookie", `accessToken=${accessToken}`)
      .send({ key: first.key });
    const firstAvatarUrl = firstConfirmRes.body.avatarUrl as string;

    const second = await uploadTestUserAvatarFile({ actorAccessToken: accessToken });
    const secondConfirmRes = await request(app)
      .put("/api/auth/me/avatar")
      .set("Cookie", `accessToken=${accessToken}`)
      .send({ key: second.key });

    expect(secondConfirmRes.body.avatarUrl).not.toBe(firstAvatarUrl);

    const oldObjectRes = await fetch(firstAvatarUrl);
    expect(oldObjectRes.status).toBe(404);
  });

  it("400s when the key was never actually uploaded to the bucket", async () => {
    const { accessToken, user } = await signUp();

    const res = await request(app)
      .put("/api/auth/me/avatar")
      .set("Cookie", `accessToken=${accessToken}`)
      .send({ key: `users/${user.id}/avatar-never-uploaded.png` });

    expect(res.status).toBe(400);
  });

  it("400s when the key belongs to a different user", async () => {
    const userA = await signUp();
    const userB = await signUp();
    const { key } = await uploadTestUserAvatarFile({ actorAccessToken: userA.accessToken });

    const res = await request(app)
      .put("/api/auth/me/avatar")
      .set("Cookie", `accessToken=${userB.accessToken}`)
      .send({ key });

    expect(res.status).toBe(400);
  });

  it("401s without a token", async () => {
    const res = await request(app).put("/api/auth/me/avatar").send({ key: "users/x/avatar-y.png" });

    expect(res.status).toBe(401);
  });
});

describe("DELETE /auth/me/avatar", () => {
  it("clears avatarUrl and removes the object from the bucket", async () => {
    const { accessToken } = await signUp();
    const { key } = await uploadTestUserAvatarFile({ actorAccessToken: accessToken });
    const confirmRes = await request(app)
      .put("/api/auth/me/avatar")
      .set("Cookie", `accessToken=${accessToken}`)
      .send({ key });
    const avatarUrl = confirmRes.body.avatarUrl as string;

    const deleteRes = await request(app).delete("/api/auth/me/avatar").set("Cookie", `accessToken=${accessToken}`);
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app).get("/api/auth/me").set("Cookie", `accessToken=${accessToken}`);
    expect(getRes.body.avatarUrl).toBeNull();

    const objectRes = await fetch(avatarUrl);
    expect(objectRes.status).toBe(404);
  });

  it("404s when the user has no avatar", async () => {
    const { accessToken } = await signUp();

    const res = await request(app).delete("/api/auth/me/avatar").set("Cookie", `accessToken=${accessToken}`);

    expect(res.status).toBe(404);
  });

  it("401s without a token", async () => {
    const res = await request(app).delete("/api/auth/me/avatar");

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

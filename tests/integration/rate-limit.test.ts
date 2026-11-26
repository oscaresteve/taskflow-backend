import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// Los defaults de vitest.config.ts son altos a proposito para que el resto de la suite
// no los alcance. Estos tests reimportan `app.ts` con `vi.stubEnv` para levantar una
// instancia propia con un limite bajo, sin afectar al `app` que usan los demas archivos.

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("rate limiting", () => {
  it("responde 429 al superar el limite de auth en sign-in", async () => {
    vi.stubEnv("AUTH_RATE_LIMIT_MAX", "3");
    vi.resetModules();
    const { default: freshApp } = await import("../../src/app.ts");

    for (let i = 0; i < 3; i++) {
      await request(freshApp)
        .post("/api/auth/sign-in")
        .send({ email: "nobody@example.com", password: "wrong" });
    }

    const res = await request(freshApp)
      .post("/api/auth/sign-in")
      .send({ email: "nobody@example.com", password: "wrong" });

    expect(res.status).toBe(429);
    expect(res.body.message).toBeDefined();
  });

  it("responde 429 al superar el limite global de la API", async () => {
    vi.stubEnv("RATE_LIMIT_MAX", "3");
    vi.resetModules();
    const { default: freshApp } = await import("../../src/app.ts");

    for (let i = 0; i < 3; i++) {
      await request(freshApp).get("/api/auth/me");
    }

    const res = await request(freshApp).get("/api/auth/me");
    expect(res.status).toBe(429);
  });
});

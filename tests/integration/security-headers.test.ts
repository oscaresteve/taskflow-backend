import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app.ts";

describe("security headers", () => {
  it("no expone X-Powered-By", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("aplica las cabeceras de seguridad de helmet", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });
});

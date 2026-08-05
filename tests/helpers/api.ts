import request from "supertest";
import app from "../../src/app.ts";
import { prisma } from "../../src/config/prisma.ts";
import { WorkspaceRole } from "../../src/prisma/generated/prisma/enums.ts";

let userCounter = 0;

export async function signUp(overrides: Partial<{ name: string; email: string; password: string }> = {}) {
  userCounter += 1;

  const payload = {
    name: overrides.name ?? `Test User ${userCounter}`,
    email: overrides.email ?? `user${userCounter}@example.com`,
    password: overrides.password ?? "Password123",
  };

  const res = await request(app).post("/api/auth/sign-up").send(payload);

  if (res.status !== 201) {
    throw new Error(`signUp failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return { user: res.body.user as { id: string; email: string }, accessToken: res.body.accessToken as string };
}

export async function createWorkspace(ownerAccessToken: string, name = "Test Workspace") {
  const res = await request(app)
    .post("/api/workspaces")
    .set("Authorization", `Bearer ${ownerAccessToken}`)
    .send({ name });

  if (res.status !== 201) {
    throw new Error(`createWorkspace failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return res.body as { id: string; slug: string; name: string };
}

// Adds `targetUserId` as a workspace member and activates it in one step, using the
// module's own endpoints (a manager actor is required for both calls).
export async function addActiveMember({
  managerAccessToken,
  workspaceSlug,
  targetUserId,
  role,
}: {
  managerAccessToken: string;
  workspaceSlug: string;
  targetUserId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
}) {
  const createRes = await request(app)
    .post(`/api/workspaces/${workspaceSlug}/members`)
    .set("Authorization", `Bearer ${managerAccessToken}`)
    .send({ userId: targetUserId, role });

  if (createRes.status !== 201) {
    throw new Error(`addActiveMember (create) failed: ${createRes.status} ${JSON.stringify(createRes.body)}`);
  }

  const activateRes = await request(app)
    .patch(`/api/workspaces/${workspaceSlug}/members/${targetUserId}/activate`)
    .set("Authorization", `Bearer ${managerAccessToken}`);

  if (activateRes.status !== 204) {
    throw new Error(`addActiveMember (activate) failed: ${activateRes.status} ${JSON.stringify(activateRes.body)}`);
  }

  return createRes.body as { id: string; userId: string; role: WorkspaceRole };
}

export async function deactivateUser(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
}

export { app };

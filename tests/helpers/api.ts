import request from "supertest";
import app from "../../src/app.ts";
import { prisma } from "../../src/config/prisma.ts";
import type { ProjectRole, WorkspaceRole } from "../../src/prisma/generated/prisma/enums.ts";

let userCounter = 0;
let projectCounter = 0;

// httpOnly solo bloquea document.cookie en el navegador; el header Set-Cookie
// sigue siendo legible por supertest, así que podemos extraer el JWT igual.
function extractCookieValue(setCookieHeader: string[] | undefined, name: string): string {
  const raw = setCookieHeader?.find((cookie) => cookie.startsWith(`${name}=`));

  if (!raw) {
    throw new Error(`Cookie ${name} not found in Set-Cookie header`);
  }

  return raw.split(";")[0].split("=")[1];
}

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

  // supertest tipa este header como string, pero Node siempre lo entrega como string[].
  const setCookie = res.headers["set-cookie"] as unknown as string[];

  return {
    user: res.body.user as { id: string; email: string },
    accessToken: extractCookieValue(setCookie, "accessToken"),
    refreshToken: extractCookieValue(setCookie, "refreshToken"),
  };
}

export async function signIn(overrides: { email: string; password: string }) {
  const res = await request(app).post("/api/auth/sign-in").send(overrides);

  if (res.status !== 200) {
    throw new Error(`signIn failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  const setCookie = res.headers["set-cookie"] as unknown as string[];

  return {
    user: res.body.user as { id: string; email: string },
    accessToken: extractCookieValue(setCookie, "accessToken"),
    refreshToken: extractCookieValue(setCookie, "refreshToken"),
  };
}

export async function createWorkspace(ownerAccessToken: string, name = "Test Workspace") {
  const res = await request(app)
    .post("/api/workspaces")
    .set("Cookie", `accessToken=${ownerAccessToken}`)
    .send({ name });

  if (res.status !== 201) {
    throw new Error(`createWorkspace failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return res.body as { id: string; slug: string; name: string };
}

// Añade a `targetUserId` como miembro del workspace y lo activa en un solo paso,
// usando los propios endpoints del módulo (el actor debe tener permisos de manager).
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
    .set("Cookie", `accessToken=${managerAccessToken}`)
    .send({ userId: targetUserId, role });

  if (createRes.status !== 201) {
    throw new Error(`addActiveMember (create) failed: ${createRes.status} ${JSON.stringify(createRes.body)}`);
  }

  const activateRes = await request(app)
    .patch(`/api/workspaces/${workspaceSlug}/members/${targetUserId}/activate`)
    .set("Cookie", `accessToken=${managerAccessToken}`);

  if (activateRes.status !== 204) {
    throw new Error(`addActiveMember (activate) failed: ${activateRes.status} ${JSON.stringify(activateRes.body)}`);
  }

  return createRes.body as { id: string; userId: string; role: WorkspaceRole };
}

export async function deactivateUser(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
}

export async function createProject(
  managerAccessToken: string,
  workspaceSlug: string,
  overrides: Partial<{ name: string; key: string }> = {},
) {
  projectCounter += 1;

  const payload = {
    name: overrides.name ?? `Test Project ${projectCounter}`,
    key: overrides.key ?? `PRJ${projectCounter}`,
  };

  const res = await request(app)
    .post(`/api/workspaces/${workspaceSlug}/projects`)
    .set("Cookie", `accessToken=${managerAccessToken}`)
    .send(payload);

  if (res.status !== 201) {
    throw new Error(`createProject failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return res.body as { id: string; slug: string; key: string };
}

// El proyecto no tiene estado PENDING como el workspace: el miembro queda activo al crearlo.
export async function addActiveProjectMember({
  managerAccessToken,
  workspaceSlug,
  projectSlug,
  targetUserId,
  role,
}: {
  managerAccessToken: string;
  workspaceSlug: string;
  projectSlug: string;
  targetUserId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
}) {
  const res = await request(app)
    .post(`/api/workspaces/${workspaceSlug}/projects/${projectSlug}/members`)
    .set("Cookie", `accessToken=${managerAccessToken}`)
    .send({ userId: targetUserId, role });

  if (res.status !== 201) {
    throw new Error(`addActiveProjectMember failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return res.body as { id: string; userId: string; role: ProjectRole };
}

export async function createTask(
  actorAccessToken: string,
  workspaceSlug: string,
  projectSlug: string,
  overrides: Partial<{ title: string; priority: string; assigneeId: string }> = {},
) {
  const payload = {
    title: overrides.title ?? "Test Task",
    priority: overrides.priority ?? "MEDIUM",
    assigneeId: overrides.assigneeId,
  };

  const res = await request(app)
    .post(`/api/workspaces/${workspaceSlug}/projects/${projectSlug}/tasks`)
    .set("Cookie", `accessToken=${actorAccessToken}`)
    .send(payload);

  if (res.status !== 201) {
    throw new Error(`createTask failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return res.body as { id: string; taskNumber: number; status: string; assigneeId: string | null };
}

export async function createComment(
  actorAccessToken: string,
  workspaceSlug: string,
  projectSlug: string,
  taskNumber: number,
  overrides: Partial<{ content: string }> = {},
) {
  const payload = {
    content: overrides.content ?? "Test comment",
  };

  const res = await request(app)
    .post(`/api/workspaces/${workspaceSlug}/projects/${projectSlug}/tasks/${taskNumber}/comments`)
    .set("Cookie", `accessToken=${actorAccessToken}`)
    .send(payload);

  if (res.status !== 201) {
    throw new Error(`createComment failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return res.body as {
    id: string;
    taskId: string;
    authorId: string;
    content: string;
    editedAt: string | null;
    deletedAt: string | null;
  };
}

export { app };

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

export async function signUp(
  overrides: Partial<{ name: string; email: string; password: string; timezone: string }> = {},
) {
  userCounter += 1;

  const name = overrides.name ?? `Test User ${userCounter}`;
  const [firstName, ...rest] = name.split(" ");
  const lastName = rest.join(" ") || "User";
  const password = overrides.password ?? "Password123";

  const payload = {
    firstName,
    lastName,
    email: overrides.email ?? `user${userCounter}@example.com`,
    password,
    confirmPassword: password,
    timezone: overrides.timezone ?? "UTC",
    locale: "en",
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
  overrides: Partial<{ title: string; priority: string; assigneeId: string; dueDate: string }> = {},
) {
  const payload = {
    title: overrides.title ?? "Test Task",
    priority: overrides.priority ?? "MEDIUM",
    assigneeId: overrides.assigneeId,
    dueDate: overrides.dueDate,
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

// PNG válido de 1x1 pixel, para tener un archivo real (no bytes cualquiera) que
// headObject en el confirm del avatar pueda aceptar como image/png.
const TEST_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

// Pide la URL prefirmada y sube el archivo directo al bucket (MinIO de test), como haría el cliente real.
// No confirma el avatar: eso lo hace cada test contra el endpoint que está probando.
export async function uploadTestAvatarFile({
  actorAccessToken,
  workspaceSlug,
  contentType = "image/png",
  fileSize,
}: {
  actorAccessToken: string;
  workspaceSlug: string;
  contentType?: string;
  fileSize?: number;
}) {
  const bytes = Buffer.from(TEST_PNG_BASE64, "base64");

  const uploadUrlRes = await request(app)
    .post(`/api/workspaces/${workspaceSlug}/avatar/upload-url`)
    .set("Cookie", `accessToken=${actorAccessToken}`)
    .send({ contentType, fileSize: fileSize ?? bytes.byteLength });

  if (uploadUrlRes.status !== 200) {
    throw new Error(`uploadTestAvatarFile (upload-url) failed: ${uploadUrlRes.status} ${JSON.stringify(uploadUrlRes.body)}`);
  }

  const { uploadUrl, key } = uploadUrlRes.body as { uploadUrl: string; key: string };

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: bytes,
  });

  if (putRes.status !== 200) {
    throw new Error(`uploadTestAvatarFile (PUT to bucket) failed: ${putRes.status}`);
  }

  return { key };
}

export { app };

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server as HttpServer } from "node:http";
import { type AddressInfo } from "node:net";
import { io as ioClient, type Socket } from "socket.io-client";
import { app, createProject, createTask, createWorkspace, signUp, addActiveMember, addActiveProjectMember } from "../helpers/api.ts";
import { createSocketServer } from "../../src/socket/socket.server.ts";
import { setRealtimeServer, type RealtimeServer } from "../../src/socket/realtime.ts";

// El socket necesita un servidor escuchando de verdad; las mutaciones siguen yendo por supertest
// contra `app`, asi que los helpers y el reset de la base entre tests valen igual.
let httpServer: HttpServer;
let io: RealtimeServer;
let port: number;

const openSockets: Socket[] = [];

beforeAll(async () => {
  httpServer = createServer(app);
  io = createSocketServer(httpServer);

  await new Promise<void>((resolve) => httpServer.listen(0, resolve));

  port = (httpServer.address() as AddressInfo).port;
});

afterEach(() => {
  // Sin esto vitest se queda colgado esperando a las conexiones.
  while (openSockets.length > 0) openSockets.pop()?.disconnect();
});

afterAll(async () => {
  setRealtimeServer(null);
  await new Promise<void>((resolve) => io.close(() => resolve()));
});

function open(accessToken?: string): Socket {
  const socket = ioClient(`http://localhost:${port}`, {
    transports: ["websocket"],
    extraHeaders: accessToken ? { Cookie: `accessToken=${accessToken}` } : {},
  });

  openSockets.push(socket);

  return socket;
}

function connected(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.on("connect", () => resolve());
    socket.on("connect_error", (error) => reject(error));
  });
}

// Rechaza al agotarse para que un fallo falle en vez de colgar la suite.
function waitFor<T>(socket: Socket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeoutMs);

    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function subscribe(socket: Socket, workspaceSlug: string, projectSlug: string): Promise<{ ok: boolean }> {
  return new Promise((resolve) => {
    socket.emit("project:subscribe", { workspaceSlug, projectSlug }, resolve);
  });
}

describe("socket handshake", () => {
  it("rejects a connection with no cookie", async () => {
    await expect(connected(open())).rejects.toThrow();
  });

  it("rejects a connection with a garbage token", async () => {
    await expect(connected(open("not-a-token"))).rejects.toThrow();
  });
});

describe("project room", () => {
  it("delivers an activity event to the other members of the project", async () => {
    const owner = await signUp();
    const workspace = await createWorkspace(owner.accessToken);
    const project = await createProject(owner.accessToken, workspace.slug);

    const member = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: member.user.id,
      role: "MEMBER",
    });
    await addActiveProjectMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      targetUserId: member.user.id,
      role: "MEMBER",
    });

    const socket = open(member.accessToken);
    await connected(socket);

    expect(await subscribe(socket, workspace.slug, project.slug)).toEqual({ ok: true });

    const received = waitFor<{ actorId: string; event: { action: string } }>(socket, "activity:new");

    await createTask(owner.accessToken, workspace.slug, project.slug, { title: "Ship it" });

    const message = await received;

    expect(message.event.action).toBe("TASK_CREATED");
    expect(message.actorId).toBe(owner.user.id);
  });

  it("refuses to subscribe to a project the user does not belong to, and sends nothing", async () => {
    const owner = await signUp();
    const workspace = await createWorkspace(owner.accessToken);
    const project = await createProject(owner.accessToken, workspace.slug);

    const outsider = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: outsider.user.id,
      role: "MEMBER",
    });

    const socket = open(outsider.accessToken);
    await connected(socket);

    expect(await subscribe(socket, workspace.slug, project.slug)).toEqual({ ok: false });

    const received = waitFor(socket, "activity:new", 500);

    await createTask(owner.accessToken, workspace.slug, project.slug);

    await expect(received).rejects.toThrow(/Timed out/);
  });
});

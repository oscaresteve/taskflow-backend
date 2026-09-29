import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "../config/env.ts";
import { verifyAccessToken } from "../shared/security/jwt.ts";
import { getAuthenticatedUser } from "../modules/auth/auth.service.ts";
import * as authorizationService from "../shared/auth/authorization.service.ts";
import { projectRoom, setRealtimeServer, userRoom, type RealtimeServer } from "./realtime.ts";

// La cookie no va firmada y el nombre es fijo, asi que no compensa una dependencia para esto. El
// handshake entrega la cabecera en crudo, no pasa por cookieParser.
function readCookie(header: string | undefined, name: string): string | undefined {
  return header
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function unauthorized(): Error {
  return Object.assign(new Error("Unauthorized"), { data: { code: "UNAUTHORIZED" } });
}

export function createSocketServer(httpServer: HttpServer): RealtimeServer {
  // socket.io necesita su propio CORS: el middleware de Express no corre en el handshake de
  // Engine.IO, que no pasa por el router.
  const io: RealtimeServer = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = readCookie(socket.handshake.headers.cookie, "accessToken");

      if (!token) return next(unauthorized());

      const { sub } = verifyAccessToken(token);
      const user = await getAuthenticatedUser(sub);

      socket.data.userId = user.id;

      next();
    } catch {
      // El cliente distingue por este codigo entre un token caducado (refresca y reintenta) y un
      // hipo del transporte (reintenta socket.io solo).
      next(unauthorized());
    }
  });

  io.on("connection", (socket) => {
    // La identidad ya la probo el handshake, asi que la sala del usuario no necesita permiso.
    socket.join(userRoom(socket.data.userId));

    socket.on("project:subscribe", async ({ workspaceSlug, projectSlug }, ack) => {
      try {
        const { project } = await authorizationService.getProjectContext({
          userId: socket.data.userId,
          workspaceSlug,
          projectSlug,
        });

        // Un socket esta como mucho en una sala de proyecto: la del que se esta viendo.
        await leaveProjectRooms(socket);
        await socket.join(projectRoom(project.id));

        ack?.({ ok: true });
      } catch {
        // getProjectContext lanza, y aqui no hay errorHandler que lo recoja: sin este catch una
        // promesa rechazada tumbaria el proceso. "No existe" y "no es tuyo" responden igual, para
        // no filtrar por el socket lo que el HTTP no filtra.
        ack?.({ ok: false });
      }
    });

    socket.on("project:unsubscribe", () => {
      void leaveProjectRooms(socket);
    });
  });

  setRealtimeServer(io);

  return io;
}

async function leaveProjectRooms(socket: { rooms: Set<string>; leave: (room: string) => Promise<void> | void }) {
  for (const room of socket.rooms) {
    if (room.startsWith("project:")) await socket.leave(room);
  }
}

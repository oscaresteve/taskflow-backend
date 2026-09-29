import { createServer } from "node:http";
import app from "./app.ts";
import { env } from "./config/env.ts";
import { prisma } from "./config/prisma.ts";
import { createSocketServer } from "./socket/socket.server.ts";
import { setRealtimeServer } from "./socket/realtime.ts";

// El socket se engancha al mismo servidor HTTP que Express, asi que hace falta crearlo a mano en
// vez de usar app.listen.
const httpServer = createServer(app);
const io = createSocketServer(httpServer);

httpServer.listen(env.PORT, () => {
  console.clear();

  const time = new Date().toLocaleTimeString();

  console.log(
    `\x1b[32m✔\x1b[0m Server listening\n` +
      `\x1b[36m➜\x1b[0m  Local:       \x1b[4mhttp://localhost:${env.PORT}\x1b[0m\n` +
      `\x1b[35m➜\x1b[0m  Environment: ${process.env.NODE_ENV ?? "development"}\n` +
      `\x1b[2m➜\x1b[0m  Started at:  ${time}\x1b[0m\n`,
  );
});

// Con sockets abiertos el proceso ya no muere solo: hay que cerrarlos o el reinicio de tsx watch
// deja conexiones colgando.
let closing = false;

function shutdown() {
  if (closing) return; // tsx watch manda SIGTERM en cada reinicio
  closing = true;

  setRealtimeServer(null); // los emit que lleguen tarde no hacen nada

  // io.close() cierra tambien el servidor HTTP que tiene debajo.
  io.close(() => {
    void prisma.$disconnect().then(() => process.exit(0));
  });

  // Si algo se queda colgado, no bloquear el reinicio indefinidamente.
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

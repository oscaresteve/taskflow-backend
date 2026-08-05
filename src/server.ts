import app from "./app.ts";
import { env } from "./config/env.ts";

app.listen(env.PORT, () => {
  console.clear();

  const time = new Date().toLocaleTimeString();

  console.log(
    `\x1b[32m✔\x1b[0m Server listening\n` +
      `\x1b[36m➜\x1b[0m  Local:       \x1b[4mhttp://localhost:${env.PORT}\x1b[0m\n` +
      `\x1b[35m➜\x1b[0m  Environment: ${process.env.NODE_ENV ?? "development"}\n` +
      `\x1b[2m➜\x1b[0m  Started at:  ${time}\x1b[0m\n`,
  );
});

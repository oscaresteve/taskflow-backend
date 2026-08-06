import express from "express";
import { router } from "./routes/index.ts";
import { errorHandler } from "./shared/middlewares/error-handler.ts";
import { env } from "./config/env.ts";
import cors from "cors";

const app = express();

app.use(express.json());

app.use(cors({ origin: env.CORS_ORIGIN }));
// TODO: Helmet
// TODO: Logger

app.use("/api", router);

// TODO: 404 Not Found

app.use(errorHandler); // Los errores llegan al handler con next(error)

export default app;

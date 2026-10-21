import express from "express";
import helmet from "helmet";
import { router } from "./routes/index.ts";
import { errorHandler } from "./shared/middlewares/error-handler.ts";
import { apiLimiter } from "./shared/middlewares/rate-limit.ts";
import { env } from "./config/env.ts";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

// Railway pone un proxy delante: sin esto, express-rate-limit veria siempre la IP
// del proxy (todas las peticiones compartirian el mismo contador).
app.set("trust proxy", 1);

app.use(express.json());

app.use(cookieParser());

app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));

app.use(helmet());
// TODO: Logger

app.use("/api", apiLimiter, router);

// TODO: 404 Not Found

app.use(errorHandler); // Los errores llegan al handler con next(error)

export default app;

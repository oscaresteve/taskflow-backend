import express from "express";
import { router } from "./routes/index.ts";
// import { errorHandler } from "./shared/middlewares/error-handler.js";

const app = express();

app.use(express.json());

// TODO: CORS
// TODO: Helmet
// TODO: Logger

app.use("/api", router);

// TODO: 404 Not Found

// app.use(errorHandler); // Los errores llegan al handler con next(error)

export default app;

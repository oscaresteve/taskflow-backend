import express, { type Express } from "express";
import { router } from "./routes/index.js";
// import { errorHandler } from "./shared/middlewares/error-handler.js";

const app: Express = express();

app.use(express.json());

// TODO: CORS
// TODO: Helmet
// TODO: Logger

app.use("/api", router);

// TODO: 404 Not Found

// app.use(errorHandler); // Los errores llegan al handler con next(error)

export default app;

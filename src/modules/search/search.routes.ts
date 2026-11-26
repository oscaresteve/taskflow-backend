import { Router } from "express";
import { auth } from "../../shared/middlewares/auth.ts";
import { validate } from "../../shared/middlewares/validate.ts";
import * as searchController from "./search.controller.ts";
import { searchQuerySchema } from "./schemas/search.schema.ts";

export const searchRouter = Router();

// 1. Buscador global del usuario: cruza espacios, proyectos y tareas en una sola peticion.
//    Cuelga de /me porque su ambito es "todo lo que este usuario puede abrir", como /me/overview.
// GET    /me/search
searchRouter.get("/me/search", auth, validate({ query: searchQuerySchema }), searchController.search);

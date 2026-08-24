import { Router } from "express";
import { auth } from "../../shared/middlewares/auth.ts";
import { validate } from "../../shared/middlewares/validate.ts";
import * as usersController from "./users.controller.ts";
import { usersQuerySchema } from "./schemas/users.schema.ts";

export const usersRouter = Router();

// 1. Buscar usuarios (por nombre o email), p.ej. para invitarlos a un workspace/proyecto
// GET    /users
usersRouter.get("/users", auth, validate({ query: usersQuerySchema }), usersController.findAll);

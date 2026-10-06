import { Router } from "express";
import { auth } from "../../shared/middlewares/auth.ts";
import { validate } from "../../shared/middlewares/validate.ts";
import * as usersController from "./users.controller.ts";
import { userParamsSchema, usersQuerySchema } from "./schemas/users.schema.ts";

export const usersRouter = Router();

// 1. Candidatos a los que dar de alta en un workspace: busca por nombre, y por email solo si se
//    da la direccion entera. Para el alta en un proyecto se usa la lista de miembros del
//    workspace (?excludeProjectSlug=...), no esto.
// GET    /users
usersRouter.get("/users", auth, validate({ query: usersQuerySchema }), usersController.findAll);

// 2. Ficha de alguien con quien compartes workspace
// GET    /users/:userId
usersRouter.get("/users/:userId", auth, validate({ params: userParamsSchema }), usersController.findOne);

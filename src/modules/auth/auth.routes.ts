import { Router } from "express";
import * as authController from "./auth.controller.ts";
import { validate } from "../../shared/middlewares/validate.ts";
import { signUpBodySchema } from "./schemas/auth.schema.ts";

export const authRouter = Router();

// Validar el body, params y query mediante middleware antes de pasar al controller.

authRouter.post("/sign-up", validate({ body: signUpBodySchema }), authController.signUp);

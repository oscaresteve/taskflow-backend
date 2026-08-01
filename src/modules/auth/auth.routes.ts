import { Router } from "express";
import * as authController from "./auth.controller.ts";
import { validate } from "../../shared/middlewares/validate.ts";
import { signInSchema, signUpSchema } from "./schemas/auth.schema.ts";
import { auth } from "../../shared/middlewares/auth.ts";

export const authRouter = Router();

// Validar el body, params y query mediante middleware antes de pasar al controller.

authRouter.post("/sign-up", validate({ body: signUpSchema }), authController.signUp);
authRouter.post("/sign-in", validate({ body: signInSchema }), authController.signIn);
authRouter.get("/me", auth, authController.me);

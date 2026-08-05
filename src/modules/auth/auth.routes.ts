import { Router } from "express";
import * as authController from "./auth.controller.ts";
import { validate } from "../../shared/middlewares/validate.ts";
import { refreshTokenSchema, signInSchema, signUpSchema } from "./schemas/auth.schema.ts";
import { auth } from "../../shared/middlewares/auth.ts";

export const authRouter = Router();

// Validar el body, params y query mediante middleware antes de pasar al controller.

authRouter.post("/sign-up", validate({ body: signUpSchema }), authController.signUp);
authRouter.post("/sign-in", validate({ body: signInSchema }), authController.signIn);
authRouter.get("/me", auth, authController.me);

// Sin middleware `auth`: el propio refresh token es la credencial, y el access
// token puede estar vencido, que es justo el caso que /refresh resuelve.
authRouter.post("/refresh", validate({ body: refreshTokenSchema }), authController.refresh);
authRouter.post("/sign-out", validate({ body: refreshTokenSchema }), authController.signOut);

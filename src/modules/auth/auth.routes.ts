import { Router } from "express";
import * as authController from "./auth.controller.ts";
import { validate } from "../../shared/middlewares/validate.ts";
import { signInSchema, signUpSchema, updateMeSchema } from "./schemas/auth.schema.ts";
import { avatarUploadUrlSchema, confirmAvatarSchema } from "../../shared/schemas/common.schema.ts";
import { auth } from "../../shared/middlewares/auth.ts";
import { authLimiter } from "../../shared/middlewares/rate-limit.ts";

export const authRouter = Router();

// Validar el body, params y query mediante middleware antes de pasar al controller.

authRouter.post("/sign-up", authLimiter, validate({ body: signUpSchema }), authController.signUp);
authRouter.post("/sign-in", authLimiter, validate({ body: signInSchema }), authController.signIn);
authRouter.get("/me", auth, authController.me);
authRouter.patch("/me", auth, validate({ body: updateMeSchema }), authController.updateMe);

// Avatar del usuario (subida vía URL prefirmada a S3/MinIO/R2), calcado del de workspace.
// POST   /auth/me/avatar/upload-url  -> pide la URL prefirmada de subida
// PUT    /auth/me/avatar             -> confirma que el archivo ya se subió
// DELETE /auth/me/avatar             -> quita el avatar actual
authRouter.post(
  "/me/avatar/upload-url",
  auth,
  validate({ body: avatarUploadUrlSchema }),
  authController.getAvatarUploadUrl,
);
authRouter.put("/me/avatar", auth, validate({ body: confirmAvatarSchema }), authController.confirmAvatar);
authRouter.delete("/me/avatar", auth, authController.deleteAvatar);

// Sin middleware `auth`: el propio refresh token (leído de la cookie) es la credencial, y el access
// token puede estar vencido, que es justo el caso que /refresh resuelve.
authRouter.post("/refresh", authController.refresh);
authRouter.post("/sign-out", authController.signOut);

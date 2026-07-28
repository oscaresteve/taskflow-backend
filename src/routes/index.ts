import { Router } from "express";
import { authRouter } from "../modules/auth/index.ts";

export const router = Router();

router.use("/auth", authRouter);
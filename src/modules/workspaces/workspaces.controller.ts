import { type NextFunction, type Request, type Response } from "express";
import * as workspacesService from "./workspaces.service.ts";
import slugify from "../../shared/utils/slugify.ts";

// Llamar al servicio y mappear la respuesta.
// Responder HTTP
// Pasar errores al error handler

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = req.body;
    const userId = req.user.id;
    const workspace = await workspacesService.create(data, userId);

    const workspaceResponse = workspace; //TODO: Mappear la respuesta

    res.status(201).json(workspaceResponse);
  } catch (error) {
    next(error);
  }
}

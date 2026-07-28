import { type NextFunction, type Request, type Response } from "express";
import * as workspacesService from "./workspaces.service.ts";

// Llamar al servicio y mappear la respuesta.
// Responder HTTP
// Pasar errores al error handler

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const workspace = await workspacesService.create(req.user.id, req.body);
    const workspaceResponse = workspace; //TODO: Mappear la respuesta

    res.status(201).json(workspaceResponse);
  } catch (error) {
    next(error);
  }
}

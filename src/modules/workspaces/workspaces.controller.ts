import { type NextFunction, type Request, type Response } from "express";
import * as workspacesService from "./workspaces.service.ts";
import slugify from "../../shared/utils/slugify.ts";

// Llamar al servicio y mappear la respuesta.
// Responder HTTP
// Pasar errores al error handler

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.user.id;
    const body = req.body;
    const slug = slugify(req.body.name); // Generar el slug

    const workspace = await workspacesService.create(id, body, slug);

    const workspaceResponse = workspace; //TODO: Mappear la respuesta

    res.status(201).json(workspaceResponse);
  } catch (error) {
    next(error);
  }
}

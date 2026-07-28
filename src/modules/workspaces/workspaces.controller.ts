import { type NextFunction, type Request, type Response } from "express";
import * as workspacesService from "./workspaces.service.ts";
import { toPaginatedWorkspaceResponseDto, toWorkspaceResponseDto } from "./mappers/workspaces.mapper.ts";
import { workspacesQuerySchema } from "./schemas/workspaces.schema.ts";

// Llamar al servicio y mappear la respuesta.
// Responder HTTP
// Pasar errores al error handler

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = req.body;
    const userId = req.user.id;
    const workspace = await workspacesService.create(data, userId);

    const workspaceResponse = toWorkspaceResponseDto(workspace);

    res.status(201).json(workspaceResponse);
  } catch (error) {
    next(error);
  }
}

export async function findAll(req: Request, res: Response, next: NextFunction) {
  try {
    const query = workspacesQuerySchema.parse(req.query); // Volver a parsear la query para obtener el tipado (no deberia hacerse ningun parseo en el controller)

    const userId = req.user.id;
    const workspaces = await workspacesService.findAll(userId, query);

    const workspacesResponse = toPaginatedWorkspaceResponseDto(workspaces, query.page, query.limit);

    res.json(workspacesResponse);
  } catch (error) {
    next(error);
  }
}

import { type NextFunction, type Request, type Response } from "express";
import * as workspacesService from "./workspaces.service.ts";
import { toWorkspaceResponseDto, toWorkspaceResponseDtoList } from "./mappers/workspaces.mapper.ts";

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
    const userId = req.user.id;
    const workspaces = await workspacesService.findAll(userId);

    const workspacesResponse = toWorkspaceResponseDtoList(workspaces);

    res.json(workspacesResponse);
  } catch (error) {
    next(error);
  }
}

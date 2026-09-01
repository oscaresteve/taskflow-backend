import { type NextFunction, type Request, type Response } from "express";
import * as workspacesService from "./workspaces.service.ts";
import { toPaginatedWorkspaceResponseDto, toWorkspaceResponseDto } from "./mappers/workspaces.mapper.ts";
import {
  type CreateWorkspaceDto,
  type UpdateWorkspaceDto,
  type WorkspaceQueryDto,
} from "./schemas/workspaces.schema.ts";
import type { WorkspaceParamsDto } from "../../shared/schemas/common.schema.ts";

// Llamar al servicio y mappear la respuesta.
// Responder HTTP
// Pasar errores al error handler

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = req.validated.body as CreateWorkspaceDto; // TODO: Tipar req.validated mediante genéricos para evitar los casts en los controllers.
    const userId = req.user.id;

    const workspace = await workspacesService.create({ data, userId });

    const workspaceResponse = toWorkspaceResponseDto(workspace);

    res.status(201).json(workspaceResponse);
  } catch (error) {
    next(error);
  }
}

export async function findAll(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const query = req.validated.query as WorkspaceQueryDto; // TODO: Tipar req.validated mediante genéricos para evitar los casts en los controllers.
    const page = query.page;
    const limit = query.limit;

    const workspaces = await workspacesService.findAll({ userId, query });

    const workspacesResponse = toPaginatedWorkspaceResponseDto({ workspaces, page, limit });

    res.json(workspacesResponse);
  } catch (error) {
    next(error);
  }
}

export async function findBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const params = req.validated.params as WorkspaceParamsDto; // TODO: Tipar req.validated mediante genéricos para evitar los casts en los controllers.
    const userId = req.user.id;
    const workspaceSlug = params.workspaceSlug;

    const workspace = await workspacesService.findBySlug({ userId, workspaceSlug });

    const workspaceResponse = toWorkspaceResponseDto(workspace);

    res.json(workspaceResponse);
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const params = req.validated.params as WorkspaceParamsDto; // TODO: Tipar req.validated mediante genéricos para evitar los casts en los controllers.
    const userId = req.user.id;
    const workspaceSlug = params.workspaceSlug;
    const data = req.validated.body as UpdateWorkspaceDto;

    const workspace = await workspacesService.update({ userId, workspaceSlug, data });

    const workspaceResponse = toWorkspaceResponseDto(workspace);

    res.json(workspaceResponse);
  } catch (error) {
    next(error);
  }
}
export async function deactivate(req: Request, res: Response, next: NextFunction) {
  try {
    const params = req.validated.params as WorkspaceParamsDto; // TODO: Tipar req.validated mediante genéricos para evitar los casts en los controllers.
    const userId = req.user.id;
    const workspaceSlug = params.workspaceSlug;

    await workspacesService.deactivate({ userId, workspaceSlug });

    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
}

import { type NextFunction, type Request, type Response } from "express";
import * as workspacesService from "./workspaces.service.ts";
import { toPaginatedWorkspaceResponseDto, toWorkspaceResponseDto } from "./mappers/workspaces.mapper.ts";
import {
  type CreateWorkspaceDto,
  type UpdateWorkspaceDto,
  type WorkspacesQueryDto,
  type WorkspacesSlugParamsDto,
} from "./schemas/workspaces.schema.ts";

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
    const query = req.validated.query as WorkspacesQueryDto; // TODO: Tipar req.validated mediante genéricos para evitar los casts en los controllers.
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
    const params = req.validated.params as WorkspacesSlugParamsDto; // TODO: Tipar req.validated mediante genéricos para evitar los casts en los controllers.
    const userId = req.user.id;
    const slug = params.slug;

    const workspace = await workspacesService.findBySlug({ userId, slug });

    const workspaceResponse = toWorkspaceResponseDto(workspace);

    res.json(workspaceResponse);
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const params = req.validated.params as WorkspacesSlugParamsDto; // TODO: Tipar req.validated mediante genéricos para evitar los casts en los controllers.
    const userId = req.user.id;
    const slug = params.slug;
    const data = req.validated.body as UpdateWorkspaceDto;

    const workspace = await workspacesService.update({ userId, slug, data });

    const workspaceResponse = toWorkspaceResponseDto(workspace);

    res.json(workspaceResponse);
  } catch (error) {
    next(error);
  }
}

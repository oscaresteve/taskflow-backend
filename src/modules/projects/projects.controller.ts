import type { NextFunction, Request, Response } from "express";
import type { CreateProjectDto, WorkspaceSlugParamsDto } from "./schemas/projects.schema.ts";
import * as projectService from "./projects.service.ts";
import { toProjectResponseDto } from "./mappers/projects.mapper.ts";

// Llamar al servicio y mappear la respuesta.
// Responder HTTP
// Pasar errores al error handler

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = req.validated.body as CreateProjectDto; // TODO: Tipar req.validated mediante genéricos para evitar los casts en los controllers.
    const userId = req.user.id;
    const params = req.validated.params as WorkspaceSlugParamsDto;
    const workspaceSlug = params.workspaceSlug;

    const project = await projectService.create({ data, userId, workspaceSlug });

    const projectResponse = toProjectResponseDto(project);

    res.status(201).json(projectResponse);
  } catch (error) {
    next(error);
  }
}

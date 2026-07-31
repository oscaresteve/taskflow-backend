import type { NextFunction, Request, Response } from "express";
import type { CreateProjectDto, ProjectsQueryDto, WorkspaceSlugParamsDto } from "./schemas/projects.schema.ts";
import * as projectService from "./projects.service.ts";
import {
  toPaginatedProjectResponseDto,
  toProjectResponseDto,
  toProjectResponseDtoList,
} from "./mappers/projects.mapper.ts";

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

export async function findAll(req: Request, res: Response, next: NextFunction) {
  try {
    const params = req.validated.params as WorkspaceSlugParamsDto;
    const userId = req.user.id;
    const workspaceSlug = params.workspaceSlug;
    const query = req.validated.query as ProjectsQueryDto;
    const page = query.page;
    const limit = query.limit;

    const projects = await projectService.findAll({ workspaceSlug, userId, query });

    const projectsResponse = toPaginatedProjectResponseDto({ page, limit, projects });
    res.json(projectsResponse);
  } catch (error) {
    next(error);
  }
}

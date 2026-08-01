import type { NextFunction, Request, Response } from "express";
import type {
  CreateProjectDto,
  ProjectQueryDto,
  UpdateProjectDto,
  ProjectParamsDto,
  WorkspaceParamsDto,
} from "./schemas/projects.schema.ts";
import * as projectService from "./projects.service.ts";
import { toPaginatedProjectResponseDto, toProjectResponseDto } from "./mappers/projects.mapper.ts";

// Llamar al servicio y mappear la respuesta.
// Responder HTTP
// Pasar errores al error handler

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = req.validated.body as CreateProjectDto; // TODO: Tipar req.validated mediante genéricos para evitar los casts en los controllers.
    const userId = req.user.id;
    const params = req.validated.params as WorkspaceParamsDto;
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
    const params = req.validated.params as WorkspaceParamsDto;
    const userId = req.user.id;
    const workspaceSlug = params.workspaceSlug;
    const query = req.validated.query as ProjectQueryDto;
    const page = query.page;
    const limit = query.limit;

    const projects = await projectService.findAll({ workspaceSlug, userId, query });

    const projectsResponse = toPaginatedProjectResponseDto({ page, limit, projects });
    res.json(projectsResponse);
  } catch (error) {
    next(error);
  }
}

export async function findBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const params = req.validated.params as ProjectParamsDto;
    const userId = req.user.id;
    const workspaceSlug = params.workspaceSlug;
    const projectSlug = params.projectSlug;

    const project = await projectService.findBySlug({ workspaceSlug, userId, projectSlug });

    const projectResponse = toProjectResponseDto(project);

    res.json(projectResponse);
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = req.validated.body as UpdateProjectDto; // TODO: Tipar req.validated mediante genéricos para evitar los casts en los controllers.
    const userId = req.user.id;
    const params = req.validated.params as ProjectParamsDto;
    const workspaceSlug = params.workspaceSlug;
    const projectSlug = params.projectSlug;

    const project = await projectService.update({ data, userId, workspaceSlug, projectSlug });

    const projectResponse = toProjectResponseDto(project);

    res.json(projectResponse);
  } catch (error) {
    next(error);
  }
}

export async function archive(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const params = req.validated.params as ProjectParamsDto;
    const workspaceSlug = params.workspaceSlug;
    const projectSlug = params.projectSlug;

    await projectService.archive({ userId, workspaceSlug, projectSlug });

    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
}

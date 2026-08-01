import type { NextFunction, Request, Response } from "express";
import type { CreateTaskDto } from "./schemas/tasks.schema.ts";
import type { WorkspaceSlugAndProjectSlugParamsDto } from "../projects/schemas/projects.schema.ts";
import * as tasksService from "./tasks.service.ts";
import { toTaskResponseDto } from "./mappers/tasks.mapper.ts";
import { z } from "zod";

// Llamar al servicio y mappear la respuesta.
// Responder HTTP
// Pasar errores al error handler

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = req.validated.body as CreateTaskDto; // TODO: Tipar req.validated mediante genéricos para evitar los casts en los controllers.
    const userId = req.user.id;
    const params = req.validated.params as WorkspaceSlugAndProjectSlugParamsDto;
    const workspaceSlug = params.workspaceSlug;
    const projectSlug = params.projectSlug;

    const project = await tasksService.create({ data, userId, workspaceSlug, projectSlug });

    const projectResponse = toTaskResponseDto(project);

    res.status(201).json(projectResponse);
  } catch (error) {
    next(error);
  }
}

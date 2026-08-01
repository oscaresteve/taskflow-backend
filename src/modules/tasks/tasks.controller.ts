import type { NextFunction, Request, Response } from "express";
import type {
  CreateTaskDto,
  ProjectParamsDto,
  TaskParamsDto,
  TaskQueryDto,
  UpdateTaskDto,
} from "./schemas/tasks.schema.ts";
import * as tasksService from "./tasks.service.ts";
import { toPaginatedTaskResponseDto, toTaskResponseDto } from "./mappers/tasks.mapper.ts";

// Llamar al servicio y mappear la respuesta.
// Responder HTTP
// Pasar errores al error handler

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = req.validated.body as CreateTaskDto; // TODO: Tipar req.validated mediante genéricos para evitar los casts en los controllers.
    const userId = req.user.id;
    const params = req.validated.params as ProjectParamsDto;
    const workspaceSlug = params.workspaceSlug;
    const projectSlug = params.projectSlug;

    const project = await tasksService.create({ data, userId, workspaceSlug, projectSlug });

    const projectResponse = toTaskResponseDto(project);

    res.status(201).json(projectResponse);
  } catch (error) {
    next(error);
  }
}

export async function findAll(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const query = req.validated.query as TaskQueryDto;
    const params = req.validated.params as ProjectParamsDto;
    const workspaceSlug = params.workspaceSlug;
    const projectSlug = params.projectSlug;

    const tasks = await tasksService.findAll({ query, userId, workspaceSlug, projectSlug });

    const tasksResponse = toPaginatedTaskResponseDto({ tasks, page: query.page, limit: query.limit });

    res.json(tasksResponse);
  } catch (error) {
    next(error);
  }
}

export async function findByTaskNumber(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const params = req.validated.params as TaskParamsDto;
    const workspaceSlug = params.workspaceSlug;
    const projectSlug = params.projectSlug;
    const taskNumber = params.taskNumber;

    const task = await tasksService.findByTaskNumber({ userId, workspaceSlug, projectSlug, taskNumber });

    const taskResponse = toTaskResponseDto(task);

    res.json(taskResponse);
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = req.validated.body as UpdateTaskDto;
    const userId = req.user.id;
    const params = req.validated.params as TaskParamsDto;
    const workspaceSlug = params.workspaceSlug;
    const projectSlug = params.projectSlug;
    const taskNumber = params.taskNumber;

    const project = await tasksService.update({ data, userId, workspaceSlug, projectSlug, taskNumber });

    const projectResponse = toTaskResponseDto(project);

    res.json(projectResponse);
  } catch (error) {
    next(error);
  }
}

export async function archive(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const params = req.validated.params as TaskParamsDto;
    const workspaceSlug = params.workspaceSlug;
    const projectSlug = params.projectSlug;
    const taskNumber = params.taskNumber;

    await tasksService.archive({ userId, workspaceSlug, projectSlug, taskNumber });

    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
}

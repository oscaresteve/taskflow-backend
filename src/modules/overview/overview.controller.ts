import { type NextFunction, type Request, type Response } from "express";
import * as overviewService from "./overview.service.ts";
import {
  toMyOverviewResponseDto,
  toProjectOverviewResponseDto,
  toWorkspaceOverviewResponseDto,
} from "./mappers/overview.mapper.ts";
import type { ProjectParamsDto, WorkspaceParamsDto } from "../../shared/schemas/common.schema.ts";

// Llamar al servicio y mappear la respuesta.
// Responder HTTP
// Pasar errores al error handler

export async function findMyOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;

    const overview = await overviewService.getMyOverview({ userId });

    res.json(toMyOverviewResponseDto(overview));
  } catch (error) {
    next(error);
  }
}

export async function findWorkspaceOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const params = req.validated.params as WorkspaceParamsDto; // TODO: Tipar req.validated mediante genéricos para evitar los casts en los controllers.
    const userId = req.user.id;
    const workspaceSlug = params.workspaceSlug;

    const overview = await overviewService.getWorkspaceOverview({ userId, workspaceSlug });

    res.json(toWorkspaceOverviewResponseDto(overview));
  } catch (error) {
    next(error);
  }
}

export async function findProjectOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const params = req.validated.params as ProjectParamsDto; // TODO: Tipar req.validated mediante genéricos para evitar los casts en los controllers.
    const userId = req.user.id;
    const workspaceSlug = params.workspaceSlug;
    const projectSlug = params.projectSlug;

    const overview = await overviewService.getProjectOverview({ userId, workspaceSlug, projectSlug });

    res.json(toProjectOverviewResponseDto(overview));
  } catch (error) {
    next(error);
  }
}

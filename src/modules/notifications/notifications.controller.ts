import type { NextFunction, Request, Response } from "express";
import * as notificationsService from "./notifications.service.ts";
import { toPaginatedNotificationResponseDto } from "./mappers/notifications.mapper.ts";
import type { NotificationParamsDto, NotificationQueryDto } from "./schemas/notifications.schema.ts";
import type { UnreadCountResponseDto } from "./dtos/notifications.dto.ts";

export async function findAll(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const query = req.validated.query as NotificationQueryDto;

    const notifications = await notificationsService.findAll({ userId, query });

    const notificationsResponse = toPaginatedNotificationResponseDto({
      notifications,
      page: query.page,
      limit: query.limit,
    });

    res.json(notificationsResponse);
  } catch (error) {
    next(error);
  }
}

export async function countUnread(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;

    const unread = await notificationsService.countUnread(userId);

    const unreadResponse: UnreadCountResponseDto = { unread };

    res.json(unreadResponse);
  } catch (error) {
    next(error);
  }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const params = req.validated.params as NotificationParamsDto;

    await notificationsService.markAsRead({ userId, notificationId: params.notificationId });

    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
}

export async function markAllAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;

    await notificationsService.markAllAsRead(userId);

    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
}

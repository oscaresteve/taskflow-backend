import type { PaginatedResponseDto } from "../../../shared/dtos/pagination.dto.ts";
import type { PaginatedResult } from "../../../shared/types/pagination.types.ts";
import type { TaskResponseDto } from "../dtos/tasks.dto.ts";
import type { Task } from "../../../shared/types/prisma.types.ts";

export function toTaskResponseDto(task: Task & { isFavorite: boolean }): TaskResponseDto {
  return {
    id: task.id,
    projectId: task.projectId,

    createdById: task.createdById,
    assigneeId: task.assigneeId,

    taskNumber: task.taskNumber,

    title: task.title,
    description: task.description,

    status: task.status,
    priority: task.priority,

    dueDate: task.dueDate,
    completedAt: task.completedAt,

    rank: task.rank,

    isArchived: task.isArchived,
    isFavorite: task.isFavorite,

    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export function toTaskResponseDtoList(tasks: (Task & { isFavorite: boolean })[]) {
  return tasks.map(toTaskResponseDto);
}

export function toPaginatedTaskResponseDto({
  tasks,
  page,
  limit,
}: {
  tasks: PaginatedResult<Task & { isFavorite: boolean }>;
  page: number;
  limit: number;
}): PaginatedResponseDto<TaskResponseDto> {
  return {
    data: toTaskResponseDtoList(tasks.items),

    pagination: {
      page,
      limit,
      total: tasks.total,
      pages: Math.ceil(tasks.total / limit),
    },
  };
}

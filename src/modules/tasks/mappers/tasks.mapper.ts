import type { PaginatedResponseDto } from "../../../shared/dtos/pagination.dto.ts";
import type { PaginatedResult } from "../../../shared/types/pagination.types.ts";
import type { TaskResponseDto } from "../dtos/tasks.dto.ts";
import type { Task } from "../../../shared/types/prisma.types.ts";

export function toTaskResponseDto(task: Task): TaskResponseDto {
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

    position: task.position,

    isArchived: task.isArchived,

    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export function toTaskResponseDtoList(tasks: Task[]) {
  return tasks.map(toTaskResponseDto);
}

export function toPaginatedTaskResponseDto({
  tasks,
  page,
  limit,
}: {
  tasks: PaginatedResult<Task>;
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

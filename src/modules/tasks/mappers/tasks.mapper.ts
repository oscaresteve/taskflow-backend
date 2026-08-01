import type { TaskResponseDto } from "../dtos/tasks.dto.ts";
import type { Task } from "../types/tasks.types.ts";

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

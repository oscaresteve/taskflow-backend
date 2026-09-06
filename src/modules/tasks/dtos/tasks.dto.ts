import type { TaskStatus, TaskPriority } from "../../../shared/types/prisma.types.ts";

export type TaskResponseDto = {
  id: string;
  projectId: string;

  createdById: string;
  assigneeId: string | null;

  taskNumber: number;

  title: string;
  description: string | null;

  status: TaskStatus;
  priority: TaskPriority;

  dueDate: Date | null;
  completedAt: Date | null;

  rank: string;

  isArchived: boolean;

  createdAt: Date;
  updatedAt: Date;
};

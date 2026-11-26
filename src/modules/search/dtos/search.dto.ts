import type { TaskPriority, TaskStatus } from "../../../shared/types/prisma.types.ts";

export type SearchWorkspaceDto = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
};

export type SearchProjectDto = {
  id: string;
  name: string;
  slug: string;
  key: string;
  color: string | null;
  workspace: {
    slug: string;
    name: string;
  };
};

export type SearchTaskDto = {
  id: string;
  taskNumber: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  project: {
    key: string;
    slug: string;
    name: string;
  };
  workspace: {
    slug: string;
    name: string;
  };
};

export type SearchResponseDto = {
  workspaces: SearchWorkspaceDto[];
  projects: SearchProjectDto[];
  tasks: SearchTaskDto[];
};

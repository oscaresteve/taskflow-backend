import { buildPublicUrl } from "../../../shared/storage/storage.service.ts";
import type { SearchProjectRow, SearchRows, SearchTaskRow } from "../search.repository.ts";
import type { SearchProjectDto, SearchResponseDto, SearchTaskDto, SearchWorkspaceDto } from "../dtos/search.dto.ts";
import type { Workspace } from "../../../shared/types/prisma.types.ts";

function toSearchWorkspaceDto(workspace: Workspace): SearchWorkspaceDto {
  return {
    id: workspace.id,

    name: workspace.name,
    slug: workspace.slug,

    description: workspace.description,
    // La key se guarda en BD, la URL pública se construye al vuelo a partir de S3_PUBLIC_URL_BASE
    avatarUrl: workspace.avatarKey ? buildPublicUrl({ key: workspace.avatarKey }) : null,
  };
}

function toSearchProjectDto(project: SearchProjectRow): SearchProjectDto {
  return {
    id: project.id,

    name: project.name,
    slug: project.slug,
    key: project.key,
    color: project.color,

    workspace: {
      slug: project.workspace.slug,
      name: project.workspace.name,
    },
  };
}

function toSearchTaskDto(task: SearchTaskRow): SearchTaskDto {
  return {
    id: task.id,

    taskNumber: task.taskNumber,
    title: task.title,

    status: task.status,
    priority: task.priority,

    project: {
      key: task.project.key,
      slug: task.project.slug,
      name: task.project.name,
    },

    workspace: {
      slug: task.project.workspace.slug,
      name: task.project.workspace.name,
    },
  };
}

export function toSearchResponseDto(rows: SearchRows): SearchResponseDto {
  return {
    workspaces: rows.workspaces.map(toSearchWorkspaceDto),
    projects: rows.projects.map(toSearchProjectDto),
    tasks: rows.tasks.map(toSearchTaskDto),
  };
}

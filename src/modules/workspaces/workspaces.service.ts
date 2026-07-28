import * as workspacesRepository from "./workspaces.repository.ts";
import type { CreateWorkspaceDto, WorkspacesQueryDto } from "./schemas/workspaces.schema.ts";
import type { Workspace } from "./types/workspaces.types.ts";
import generateUniqueSlug from "../../shared/utils/generate-unique-slug.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";

// LLamar al repository y realizar toda la lógica necesaria

export async function create(data: CreateWorkspaceDto, userId: string): Promise<Workspace> {
  const slug = await generateUniqueSlug(data.name, workspacesRepository.existsBySlug); // Generar el slug unico

  const workspace = await workspacesRepository.create({
    data,
    slug,
    userId,
  });

  return workspace;
}

export async function findAll(userId: string, query: WorkspacesQueryDto): Promise<PaginatedResult<Workspace>> {
  const workspaces = await workspacesRepository.findAllByUserId(query, userId);
  return workspaces;
}

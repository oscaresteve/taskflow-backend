import slugify from "../../shared/utils/slugify.ts";
import * as workspacesRepository from "./workspaces.repository.ts";
import type { CreateWorkspaceDto } from "./schemas/workspaces.schema.ts";
import type { Workspace } from "./types/workspaces.types.ts";

// LLamar al repository y realizar toda la lógica necesaria

export async function create(data: CreateWorkspaceDto, userId: string): Promise<Workspace> {
  const slug = slugify(data.name); // Generar el slug

  const workspace = await workspacesRepository.create(data, slug, userId);
  return workspace;
}

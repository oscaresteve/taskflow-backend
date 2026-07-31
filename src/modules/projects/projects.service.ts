import type { CreateProjectDto } from "./schemas/projects.schema.ts";
import { WorkspaceRole, type Project } from "./types/projects.types.ts";
import * as projectsRepository from "./projects.repository.ts";
import generateUniqueSlug from "../../shared/utils/generate-unique-slug.ts";
import { NotFoundError } from "../../shared/errors/not-found-error.ts";
import { ForbiddenError } from "../../shared/errors/forbidden-error.ts";
import { ConflictError } from "../../shared/errors/conflict-error.ts";

// LLamar al repository y realizar toda la lógica necesaria

export async function create({
  data,
  userId,
  workspaceSlug,
}: {
  data: CreateProjectDto;
  userId: string;
  workspaceSlug: string;
}): Promise<Project> {
  // Comprobar si existe el workspace
  const workspace = await projectsRepository.findWorkspaceBySlug(workspaceSlug);

  if (!workspace) throw new NotFoundError("Workspace not found");

  // Revisar si es miembro del workspace
  const workspaceId = workspace.id;

  const workspaceMember = await projectsRepository.findWorkspaceMember({ userId, workspaceId });

  if (!workspaceMember) throw new ForbiddenError("You are not a member of this workspace");

  // Comprobar si es OWNER O ADMIN
  if (workspaceMember.role !== WorkspaceRole.OWNER && workspaceMember.role !== WorkspaceRole.ADMIN)
    throw new ForbiddenError("You have not permissions to manage this workspace");

  // Generar slug unico en el workspace
  const slug = await generateUniqueSlug({
    text: data.name,
    exists: (slug) => projectsRepository.existsBySlugInWorkspace({ slug, workspaceId }),
  });

  // Comprobar que la key no existe
  const keyExists = await projectsRepository.existsByKeyInWorkspace({ key: data.key, workspaceId });

  if (keyExists) {
    throw new ConflictError("Project key already exists");
  }

  const project = await projectsRepository.create({ data, slug, workspaceId, userId });

  return project;
}

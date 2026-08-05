import type { CreateProjectDto, ProjectQueryDto, UpdateProjectDto } from "./schemas/projects.schema.ts";
import { type Project } from "../../shared/types/prisma.types.ts";
import * as projectsRepository from "./projects.repository.ts";
import generateUniqueSlug from "../../shared/utils/generate-unique-slug.ts";
import { ConflictError } from "../../shared/errors/conflict-error.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import * as authorizationService from "../../shared/auth/authorization.service.ts";
import { requireWorkspaceManager } from "../../shared/auth/permissions.ts";

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
  // Obtener contexto
  const { workspace, workspaceMember } = await authorizationService.getWorkspaceContext({ userId, workspaceSlug });

  // Comprobar permisos
  requireWorkspaceManager(workspaceMember);

  // Generar slug unico en el workspace
  const slug = await generateUniqueSlug({
    text: data.name,
    exists: (slug) => projectsRepository.existsBySlugInWorkspace({ slug, workspaceId: workspace.id }),
  });

  // Comprobar que la key no existe
  const keyExists = await projectsRepository.existsByKeyInWorkspace({ key: data.key, workspaceId: workspace.id });
  if (keyExists) {
    throw new ConflictError("Project key already exists");
  }

  const project = await projectsRepository.create({ data, slug, workspaceId: workspace.id, userId });

  return project;
}

export async function findAll({
  workspaceSlug,
  userId,
  query,
}: {
  workspaceSlug: string;
  userId: string;
  query: ProjectQueryDto;
}): Promise<PaginatedResult<Project>> {
  // Obtener contexto
  const { workspace } = await authorizationService.getWorkspaceContext({ userId, workspaceSlug });

  const projects = await projectsRepository.findAll({ query, userId, workspaceId: workspace.id });

  return projects;
}

export async function findBySlug({
  userId,
  workspaceSlug,
  projectSlug,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
}): Promise<Project> {
  // Obtener el contexto
  const { project } = await authorizationService.getProjectContext({ userId, workspaceSlug, projectSlug });

  return project;
}

export async function update({
  data,
  userId,
  workspaceSlug,
  projectSlug,
}: {
  data: UpdateProjectDto;
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
}): Promise<Project> {
  // Obtener el contexto
  const { workspace, workspaceMember, project } = await authorizationService.getProjectContext({
    userId,
    workspaceSlug,
    projectSlug,
  });

  // Comprobar permisos
  requireWorkspaceManager(workspaceMember);

  // Si cambia el nombre, generar nuevo slug unico en el workspace
  let newSlug = project.slug;

  if (data.name && data.name !== project.name)
    newSlug = await generateUniqueSlug({
      text: data.name,
      exists: (slug) => projectsRepository.existsBySlugInWorkspace({ slug, workspaceId: workspace.id }),
    });

  const updatedProject = await projectsRepository.update({ data, newSlug, projectId: project.id });

  return updatedProject;
}

export async function archive({
  userId,
  workspaceSlug,
  projectSlug,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
}): Promise<void> {
  // Obtener el contexto
  const { workspaceMember, project } = await authorizationService.getProjectContext({
    userId,
    workspaceSlug,
    projectSlug,
  });

  // Comprobar permisos
  requireWorkspaceManager(workspaceMember);

  // Comprobar que no este ya archivado
  if (project.isArchived === true) throw new ConflictError("Project is already archived");

  await projectsRepository.archive(project.id);
}

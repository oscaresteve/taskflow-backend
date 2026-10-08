import type { CreateProjectDto, ProjectQueryDto, UpdateProjectDto } from "./schemas/projects.schema.ts";
import * as projectsRepository from "./projects.repository.ts";
import generateUniqueSlug from "../../shared/utils/generate-unique-slug.ts";
import retryOnUniqueViolation from "../../shared/utils/retry-on-unique-violation.ts";
import { ConflictError } from "../../shared/errors/conflict-error.ts";
import { NotFoundError } from "../../shared/errors/not-found-error.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import * as authorizationService from "../../shared/auth/authorization.service.ts";
import { requireWorkspaceManager, requireWorkspaceOrProjectManager } from "../../shared/auth/permissions.ts";
import type { ActivityEventInput, ProjectEditedField } from "../activity/types/activity.types.ts";
import type { ProjectForViewer } from "./types/projects.types.ts";

// LLamar al repository y realizar toda la lógica necesaria

export async function create({
  data,
  userId,
  workspaceSlug,
}: {
  data: CreateProjectDto;
  userId: string;
  workspaceSlug: string;
}): Promise<ProjectForViewer> {
  // Obtener contexto
  const { workspace, workspaceMember } = await authorizationService.getWorkspaceContext({ userId, workspaceSlug });

  // Comprobar permisos
  requireWorkspaceManager(workspaceMember);

  const project = await retryOnUniqueViolation(async () => {
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

    return projectsRepository.create({ data, slug, workspaceId: workspace.id, userId });
  });

  // Un proyecto recien creado no puede estar marcado como favorito todavia, y su autor es el OWNER
  // que le ha puesto el repository en la misma transaccion.
  return { ...project, isFavorite: false, myRole: "OWNER" };
}

export async function findAll({
  workspaceSlug,
  userId,
  query,
}: {
  workspaceSlug: string;
  userId: string;
  query: ProjectQueryDto;
}): Promise<PaginatedResult<ProjectForViewer>> {
  // Obtener contexto
  const { workspace } = await authorizationService.getWorkspaceContext({ userId, workspaceSlug });

  const projects = await projectsRepository.findAll({ query, userId, workspaceId: workspace.id });

  // Los dos campos que dependen de quien mira se resuelven en lote: una query para toda la pagina
  // cada uno, no una por proyecto.
  const projectIds = projects.items.map((project) => project.id);

  const [favoritedIds, rolesByProjectId] = await Promise.all([
    projectsRepository.findFavoritedIds({ userId, projectIds }),
    projectsRepository.findMyRoles({ userId, projectIds }),
  ]);

  return {
    items: projects.items.map((project) => ({
      ...project,
      isFavorite: favoritedIds.has(project.id),
      // findAll ya filtra por pertenencia activa, asi que aqui siempre hay rol.
      myRole: rolesByProjectId.get(project.id) ?? null,
    })),
    total: projects.total,
  };
}

export async function findBySlug({
  userId,
  workspaceSlug,
  projectSlug,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
}): Promise<ProjectForViewer> {
  // Obtener el contexto
  const { project, projectMember } = await authorizationService.getProjectContext({
    userId,
    workspaceSlug,
    projectSlug,
  });

  const isFavorite = await projectsRepository.isFavorited({ userId, projectId: project.id });

  // getProjectContext ya ha exigido pertenencia activa, asi que el rol sale del contexto sin query.
  return { ...project, isFavorite, myRole: projectMember.role };
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
}): Promise<ProjectForViewer> {
  // Obtener el contexto
  const { workspace, workspaceMember, project, projectMember } =
    await authorizationService.getProjectContextAllowingWorkspaceManager({
      userId,
      workspaceSlug,
      projectSlug,
    });

  // Comprobar permisos
  requireWorkspaceOrProjectManager({ workspaceMember, projectMember });

  // Si cambia el nombre, generar nuevo slug unico en el workspace
  let newSlug = project.slug;

  if (data.name && data.name !== project.name)
    newSlug = await generateUniqueSlug({
      currentSlug: project.slug,
      text: data.name,
      exists: (slug) => projectsRepository.existsBySlugInWorkspace({ slug, workspaceId: workspace.id }),
    });

  // Nombre, descripcion y color no tienen narrativa propia, asi que comparten un unico evento
  // que solo registra cuales cambiaron de verdad.
  const fields: ProjectEditedField[] = [];

  if (data.name !== undefined && data.name !== project.name) fields.push("name");
  if (data.description !== undefined && (data.description ?? null) !== project.description) fields.push("description");
  if (data.color !== undefined && (data.color ?? null) !== project.color) fields.push("color");

  const events: ActivityEventInput[] =
    fields.length === 0
      ? []
      : [
          {
            workspaceId: workspace.id,
            projectId: project.id,
            taskId: null,
            actorId: userId,
            action: "PROJECT_UPDATED",
            payload: { projectName: data.name ?? project.name, projectKey: project.key, fields },
          },
        ];

  const [updatedProject, isFavorite] = await Promise.all([
    projectsRepository.update({ data, newSlug, projectId: project.id, events }),
    projectsRepository.isFavorited({ userId, projectId: project.id }),
  ]);

  // Una pertenencia ausente o desactivada no es un rol: aqui el mando puede venir del espacio.
  const myRole = projectMember?.isActive ? projectMember.role : null;

  return { ...updatedProject, isFavorite, myRole };
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
  const { workspace, workspaceMember, project, projectMember } =
    await authorizationService.getProjectContextAllowingWorkspaceManager({
      userId,
      workspaceSlug,
      projectSlug,
    });

  // Comprobar permisos
  requireWorkspaceOrProjectManager({ workspaceMember, projectMember });

  // Comprobar que no este ya archivado
  if (project.isArchived === true) throw new ConflictError("Project is already archived");

  await projectsRepository.archive({
    projectId: project.id,
    events: [
      {
        workspaceId: workspace.id,
        projectId: project.id,
        taskId: null,
        actorId: userId,
        action: "PROJECT_ARCHIVED",
        payload: { projectName: project.name, projectKey: project.key },
      },
    ],
  });
}

export async function favorite({
  userId,
  workspaceSlug,
  projectSlug,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
}): Promise<void> {
  // Obtener el contexto
  const { project } = await authorizationService.getProjectContext({ userId, workspaceSlug, projectSlug });

  // Comprobar que no este ya marcado como favorito
  if (await projectsRepository.isFavorited({ userId, projectId: project.id })) {
    throw new ConflictError("Project is already favorited");
  }

  await projectsRepository.createFavorite({ userId, projectId: project.id });
}

export async function unfavorite({
  userId,
  workspaceSlug,
  projectSlug,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
}): Promise<void> {
  // Obtener el contexto
  const { project } = await authorizationService.getProjectContext({ userId, workspaceSlug, projectSlug });

  // Comprobar que este marcado como favorito
  if (!(await projectsRepository.isFavorited({ userId, projectId: project.id }))) {
    throw new NotFoundError("Project is not favorited");
  }

  await projectsRepository.deleteFavorite({ userId, projectId: project.id });
}

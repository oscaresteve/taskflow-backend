import { prisma } from "../../config/prisma.ts";
import type { CreateWorkspaceDto } from "./schemas/workspaces.schema.ts";
import { WorkspaceMemberStatus, WorkspaceRole, type Workspace } from "./types/workspaces.types.ts";

// Solo comunicarse con el ORM o DB

export async function create(data: CreateWorkspaceDto, slug: string, userId: string): Promise<Workspace> {
  // Crear el workspacemeber usando Prisma Interactive Transactions
  return prisma.$transaction(async (tx) => {
    // 1. Crear el workspace
    const workspace = await tx.workspace.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        logoUrl: data.logoUrl,
      },
    });

    // 2. Añadir al creador como OWNER
    await tx.workspaceMember.create({
      data: {
        userId,
        workspaceId: workspace.id,
        role: WorkspaceRole.OWNER,
        status: WorkspaceMemberStatus.ACTIVE,
        joinedAt: new Date(),
      },
    });

    return workspace;
  });
}

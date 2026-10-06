import { prisma } from "../../config/prisma.ts";
import type { Prisma } from "../../prisma/generated/prisma/client.ts";
import { WorkspaceMemberStatus } from "../../shared/types/prisma.types.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { UsersQueryDto } from "./schemas/users.schema.ts";

// Lo que el selector de miembros necesita para pintar un candidato: nombre, avatar y el email, que
// es lo que distingue a dos homonimos antes de invitar a uno. Nada mas sale de aqui: el directorio
// lo ve gente que todavia no comparte espacio con estas personas.
const userSummarySelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  email: true,
} as const;

export type UserSummaryRow = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  email: string;
};

// La ficha de una persona con la que ya compartes workspace, que es lo que pinta el popup.
const userProfileSelect = {
  ...userSummarySelect,
  isActive: true,
  createdAt: true,
  lastLoginAt: true,
} as const;

export type UserProfileRow = UserSummaryRow & {
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
};

export async function findAll({
  query,
  excludeUserId,
  excludeWorkspaceId,
}: {
  query: UsersQueryDto;
  excludeUserId: string;
  excludeWorkspaceId: string;
}): Promise<PaginatedResult<UserSummaryRow>> {
  const where: Prisma.UserWhereInput = {};

  where.isActive = true;
  where.id = { not: excludeUserId };

  where.workspaceMembers = {
    none: {
      workspaceId: excludeWorkspaceId,
    },
  };

  if (query.search) {
    where.OR = [
      {
        firstName: {
          contains: query.search,
          mode: "insensitive",
        },
      },
      {
        lastName: {
          contains: query.search,
          mode: "insensitive",
        },
      },
      {
        // La direccion casa entera y no por trozos: esto sirve para dar de alta a quien ya
        // conoces, no para recolectar las direcciones de un dominio buscando "@empresa.com".
        email: {
          equals: query.search,
          mode: "insensitive",
        },
      },
    ];
  }

  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSummarySelect,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      skip,
      take: query.limit,
    }),

    prisma.user.count({
      where,
    }),
  ]);

  return {
    items,
    total,
  };
}

// La autorizacion va en el propio where y no en una consulta aparte: si no hay nada que compartas
// con esa persona, para ti no existe, y el servicio responde con el mismo 404 que si no existiera.
export async function findProfileById({
  targetUserId,
  viewerId,
}: {
  targetUserId: string;
  viewerId: string;
}): Promise<UserProfileRow | null> {
  return prisma.user.findFirst({
    where: {
      id: targetUserId,
      OR: [
        { id: viewerId },
        {
          // Al objetivo le vale cualquier status, porque a quien fue eliminado del espacio los
          // demas lo siguen viendo como asignado de tareas y autor de comentarios.
          workspaceMembers: {
            some: {
              workspace: {
                isActive: true,
                members: { some: { userId: viewerId, status: WorkspaceMemberStatus.ACTIVE } },
              },
            },
          },
        },
      ],
    },
    select: userProfileSelect,
  });
}

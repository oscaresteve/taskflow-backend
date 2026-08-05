import { prisma } from "../config/prisma.ts";
import { hashPassword } from "../shared/security/password.ts";
import slugify from "../shared/utils/slugify.ts";
import { WorkspaceRole, WorkspaceMemberStatus, ProjectRole, TaskStatus, TaskPriority } from "../shared/types/prisma.types.ts";

// Mismo orden que tests/setup/db.ts: hijos antes que padres por las FKs.
async function resetDatabase() {
  await prisma.comment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await resetDatabase();

  const passwordHash = await hashPassword("password123");

  const [ada, alan, grace] = await Promise.all([
    prisma.user.create({
      data: { name: "Ada Lovelace", email: "ada@taskflow.dev", passwordHash, emailVerifiedAt: new Date() },
    }),
    prisma.user.create({
      data: { name: "Alan Turing", email: "alan@taskflow.dev", passwordHash, emailVerifiedAt: new Date() },
    }),
    prisma.user.create({
      data: { name: "Grace Hopper", email: "grace@taskflow.dev", passwordHash, emailVerifiedAt: new Date() },
    }),
  ]);

  const workspace = await prisma.workspace.create({
    data: {
      name: "Acme Inc",
      slug: slugify("Acme Inc"),
      description: "Espacio de trabajo principal de Acme",
      members: {
        create: [
          { userId: ada.id, role: WorkspaceRole.OWNER, status: WorkspaceMemberStatus.ACTIVE, joinedAt: new Date() },
          { userId: alan.id, role: WorkspaceRole.ADMIN, status: WorkspaceMemberStatus.ACTIVE, joinedAt: new Date() },
          { userId: grace.id, role: WorkspaceRole.MEMBER, status: WorkspaceMemberStatus.ACTIVE, joinedAt: new Date() },
        ],
      },
    },
  });

  const website = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: "Website Redesign",
      slug: slugify("Website Redesign"),
      key: "WEB",
      description: "Rediseño de la web corporativa",
      members: {
        create: [
          { userId: ada.id, role: ProjectRole.OWNER, joinedAt: new Date() },
          { userId: alan.id, role: ProjectRole.ADMIN, joinedAt: new Date() },
          { userId: grace.id, role: ProjectRole.MEMBER, joinedAt: new Date() },
        ],
      },
    },
  });

  const mobileApp = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: "Mobile App",
      slug: slugify("Mobile App"),
      key: "APP",
      description: "Aplicación móvil de Acme",
      members: {
        create: [
          { userId: ada.id, role: ProjectRole.OWNER, joinedAt: new Date() },
          { userId: alan.id, role: ProjectRole.ADMIN, joinedAt: new Date() },
        ],
      },
    },
  });

  async function seedTasks({
    projectId,
    tasks,
  }: {
    projectId: string;
    tasks: {
      title: string;
      status: TaskStatus;
      priority: TaskPriority;
      assigneeId: string | null;
    }[];
  }) {
    for (const [index, task] of tasks.entries()) {
      await prisma.task.create({
        data: {
          projectId,
          createdById: ada.id,
          assigneeId: task.assigneeId,
          taskNumber: index + 1,
          title: task.title,
          status: task.status,
          priority: task.priority,
          position: index + 1,
        },
      });
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { nextTaskNumber: tasks.length + 1 },
    });
  }

  await seedTasks({
    projectId: website.id,
    tasks: [
      { title: "Diseñar la nueva home", status: TaskStatus.DONE, priority: TaskPriority.HIGH, assigneeId: grace.id },
      { title: "Maquetar la página de precios", status: TaskStatus.IN_PROGRESS, priority: TaskPriority.MEDIUM, assigneeId: grace.id },
      { title: "Revisar accesibilidad", status: TaskStatus.IN_REVIEW, priority: TaskPriority.MEDIUM, assigneeId: alan.id },
      { title: "Migrar el blog", status: TaskStatus.TODO, priority: TaskPriority.LOW, assigneeId: null },
    ],
  });

  await seedTasks({
    projectId: mobileApp.id,
    tasks: [
      { title: "Configurar CI/CD", status: TaskStatus.DONE, priority: TaskPriority.HIGH, assigneeId: alan.id },
      { title: "Implementar login", status: TaskStatus.IN_PROGRESS, priority: TaskPriority.URGENT, assigneeId: alan.id },
      { title: "Preparar release en las tiendas", status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, assigneeId: null },
    ],
  });

  const taskInReview = await prisma.task.findFirst({
    where: { projectId: website.id, status: TaskStatus.IN_REVIEW },
  });

  if (taskInReview) {
    await prisma.comment.create({
      data: { taskId: taskInReview.id, authorId: ada.id, content: "Buen trabajo, solo falta revisar el contraste de los botones." },
    });
    await prisma.comment.create({
      data: { taskId: taskInReview.id, authorId: alan.id, content: "Tomo nota, lo corrijo esta tarde." },
    });
  }

  console.log("Seed completed.");
  console.log("Users (password: password123):");
  console.log(`  - ${ada.email}`);
  console.log(`  - ${alan.email}`);
  console.log(`  - ${grace.email}`);
  console.log(`Workspace: ${workspace.slug}`);
  console.log(`Projects: ${website.slug}, ${mobileApp.slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

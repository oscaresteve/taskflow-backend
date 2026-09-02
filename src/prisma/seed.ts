import { prisma } from "../config/prisma.ts";
import { hashPassword } from "../shared/security/password.ts";
import slugify from "../shared/utils/slugify.ts";
import {
  WorkspaceRole,
  WorkspaceMemberStatus,
  ProjectRole,
  TaskStatus,
  TaskPriority,
  type Task,
  type User,
} from "../shared/types/prisma.types.ts";

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

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function daysFromNow(days: number): Date {
  return daysAgo(-days);
}

async function seedTasks({
  projectId,
  createdById,
  tasks,
}: {
  projectId: string;
  createdById: string;
  tasks: {
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    assigneeId: string | null;
    dueDate?: Date;
    completedAt?: Date;
    isArchived?: boolean;
    createdAt?: Date;
  }[];
}): Promise<Task[]> {
  const createdTasks: Task[] = [];

  for (const [index, task] of tasks.entries()) {
    const createdTask = await prisma.task.create({
      data: {
        projectId,
        createdById,
        assigneeId: task.assigneeId,
        taskNumber: index + 1,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        completedAt: task.completedAt,
        isArchived: task.isArchived ?? false,
        position: index + 1,
        createdAt: task.createdAt,
      },
    });
    createdTasks.push(createdTask);
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { nextTaskNumber: tasks.length + 1 },
  });

  return createdTasks;
}

// --- Generación masiva de usuarios, para poder probar paginación, límites y scroll ---
// Cada combinación (nombre, apellido) es única (20 nombres x 20 apellidos = 400 posibles),
// así que el email se puede derivar del nombre real en vez de usar un contador.

const FIRST_NAMES = [
  "Marie", "Isaac", "Rosalind", "Niels", "Barbara", "Edsger", "Radia", "Vint", "Hedy", "Claude",
  "John", "Frances", "Steve", "Bjarne", "Guido", "Yukihiro", "Anders", "James", "Brendan", "Rasmus",
];

const LAST_NAMES = [
  "Curie", "Newton", "Franklin", "Bohr", "Liskov", "Dijkstra", "Perlman", "Cerf", "Lamarr", "Shannon",
  "McCarthy", "Allen", "Wozniak", "Stroustrup", "van Rossum", "Matsumoto", "Hejlsberg", "Gosling", "Eich", "Lerdorf",
];

const BULK_USER_COUNT = 120;

function toEmailLocalPart(text: string): string {
  return text.toLowerCase().replace(/[^a-z]/g, "");
}

async function seedBulkUsers(passwordHash: string): Promise<User[]> {
  const seeds = Array.from({ length: BULK_USER_COUNT }, (_, i) => {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
    const createdAt = daysAgo(BULK_USER_COUNT - i); // Escalonados en el tiempo, para probar el orden por fecha.

    return {
      name: `${firstName} ${lastName}`,
      email: `${toEmailLocalPart(firstName)}.${toEmailLocalPart(lastName)}@taskflow.dev`,
      createdAt,
    };
  });

  // Se crean en paralelo: son independientes entre sí, no hace falta ir uno a uno.
  return Promise.all(
    seeds.map((seed) =>
      prisma.user.create({
        data: {
          name: seed.name,
          email: seed.email,
          passwordHash,
          avatarUrl: `https://i.pravatar.cc/150?u=${seed.email}`,
          emailVerifiedAt: seed.createdAt,
          lastLoginAt: seed.createdAt,
          createdAt: seed.createdAt,
        },
      }),
    ),
  );
}

async function main() {
  await resetDatabase();

  const passwordHash = await hashPassword("password123");

  // Usuarios variados: verificados, sin verificar, sin haber iniciado sesión nunca,
  // desactivados, y uno sin ningún workspace (cuenta recién creada).
  const [ada, alan, grace, margaret, katherine, linus, tim, dennis] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Ada Lovelace",
        email: "ada@taskflow.dev",
        passwordHash,
        avatarUrl: "https://i.pravatar.cc/150?u=ada",
        emailVerifiedAt: daysAgo(400),
        lastLoginAt: daysAgo(0),
        createdAt: daysAgo(400),
      },
    }),
    prisma.user.create({
      data: {
        name: "Alan Turing",
        email: "alan@taskflow.dev",
        passwordHash,
        avatarUrl: "https://i.pravatar.cc/150?u=alan",
        emailVerifiedAt: daysAgo(400),
        lastLoginAt: daysAgo(1),
        createdAt: daysAgo(400),
      },
    }),
    prisma.user.create({
      data: {
        name: "Grace Hopper",
        email: "grace@taskflow.dev",
        passwordHash,
        avatarUrl: "https://i.pravatar.cc/150?u=grace",
        emailVerifiedAt: daysAgo(380),
        lastLoginAt: daysAgo(3),
        createdAt: daysAgo(380),
      },
    }),
    prisma.user.create({
      data: {
        name: "Margaret Hamilton",
        email: "margaret@taskflow.dev",
        passwordHash,
        avatarUrl: "https://i.pravatar.cc/150?u=margaret",
        emailVerifiedAt: daysAgo(200),
        lastLoginAt: daysAgo(10),
        createdAt: daysAgo(200),
      },
    }),
    // Aceptó la invitación al workspace hace poco pero todavía no ha iniciado sesión.
    prisma.user.create({
      data: {
        name: "Katherine Johnson",
        email: "katherine@taskflow.dev",
        passwordHash,
        emailVerifiedAt: daysAgo(5),
        lastLoginAt: null,
        createdAt: daysAgo(5),
      },
    }),
    // Se registró pero aún no ha verificado su email.
    prisma.user.create({
      data: {
        name: "Linus Torvalds",
        email: "linus@taskflow.dev",
        passwordHash,
        emailVerifiedAt: null,
        lastLoginAt: null,
        createdAt: daysAgo(2),
      },
    }),
    // Cuenta desactivada: ya no puede autenticarse ni ser añadido a nada nuevo.
    prisma.user.create({
      data: {
        name: "Tim Berners-Lee",
        email: "tim@taskflow.dev",
        passwordHash,
        isActive: false,
        avatarUrl: "https://i.pravatar.cc/150?u=tim",
        emailVerifiedAt: daysAgo(300),
        lastLoginAt: daysAgo(90),
        createdAt: daysAgo(300),
      },
    }),
    // Usuario recién registrado, sin pertenecer todavía a ningún workspace.
    prisma.user.create({
      data: {
        name: "Dennis Ritchie",
        email: "dennis@taskflow.dev",
        passwordHash,
        emailVerifiedAt: daysAgo(1),
        lastLoginAt: daysAgo(1),
        createdAt: daysAgo(1),
      },
    }),
  ]);

  // Usuarios generados en volumen, solo para poblar listados largos (paginación, límites, scroll).
  const bulkUsers = await seedBulkUsers(passwordHash);

  // De los usuarios en volumen, un subconjunto se une a Acme para poder probar
  // listados largos de miembros de workspace y de proyecto.
  const ACME_BULK_MEMBER_COUNT = 90;
  const acmeBulkMembers = bulkUsers.slice(0, ACME_BULK_MEMBER_COUNT);

  // --- Workspace 1: Acme Inc (el principal, con la mayoría de los datos) ---
  const acme = await prisma.workspace.create({
    data: {
      name: "Acme Inc",
      slug: slugify("Acme Inc"),
      description: "Espacio de trabajo principal de Acme",
      createdAt: daysAgo(400),
      members: {
        create: [
          { userId: ada.id, role: WorkspaceRole.OWNER, status: WorkspaceMemberStatus.ACTIVE, joinedAt: daysAgo(400) },
          { userId: alan.id, role: WorkspaceRole.ADMIN, status: WorkspaceMemberStatus.ACTIVE, joinedAt: daysAgo(400) },
          { userId: grace.id, role: WorkspaceRole.MEMBER, status: WorkspaceMemberStatus.ACTIVE, joinedAt: daysAgo(380) },
          { userId: margaret.id, role: WorkspaceRole.MEMBER, status: WorkspaceMemberStatus.ACTIVE, joinedAt: daysAgo(200) },
          { userId: katherine.id, role: WorkspaceRole.MEMBER, status: WorkspaceMemberStatus.ACTIVE, joinedAt: daysAgo(5) },
          // Invitación enviada, todavía no aceptada.
          { userId: linus.id, role: WorkspaceRole.MEMBER, status: WorkspaceMemberStatus.PENDING, joinedAt: null },
          // Expulsado del workspace tras desactivar su cuenta; el rol se resetea a MEMBER al eliminar.
          { userId: tim.id, role: WorkspaceRole.MEMBER, status: WorkspaceMemberStatus.REMOVED, joinedAt: null },
          // Miembros en volumen, activos, casi todos MEMBER con algún ADMIN salpicado.
          ...acmeBulkMembers.map((user, i) => ({
            userId: user.id,
            role: i % 20 === 0 ? WorkspaceRole.ADMIN : WorkspaceRole.MEMBER,
            status: WorkspaceMemberStatus.ACTIVE,
            joinedAt: daysAgo(ACME_BULK_MEMBER_COUNT - i),
          })),
        ],
      },
    },
  });

  // --- Workspace 2: Freelance Studio (segundo workspace de Grace, prueba de multi-tenencia) ---
  const freelanceStudio = await prisma.workspace.create({
    data: {
      name: "Freelance Studio",
      slug: slugify("Freelance Studio"),
      description: "Estudio freelance de Grace para proyectos con clientes externos",
      createdAt: daysAgo(150),
      members: {
        create: [
          { userId: grace.id, role: WorkspaceRole.OWNER, status: WorkspaceMemberStatus.ACTIVE, joinedAt: daysAgo(150) },
          { userId: katherine.id, role: WorkspaceRole.MEMBER, status: WorkspaceMemberStatus.ACTIVE, joinedAt: daysAgo(140) },
        ],
      },
    },
  });

  // --- Workspace 3: Legacy Co (workspace dado de baja, isActive false) ---
  const legacyCo = await prisma.workspace.create({
    data: {
      name: "Legacy Co",
      slug: slugify("Legacy Co"),
      description: "Cliente antiguo, cuenta dada de baja",
      isActive: false,
      createdAt: daysAgo(500),
      members: {
        create: [{ userId: ada.id, role: WorkspaceRole.OWNER, status: WorkspaceMemberStatus.ACTIVE, joinedAt: daysAgo(500) }],
      },
    },
  });

  // --- Proyectos de Acme Inc ---
  const website = await prisma.project.create({
    data: {
      workspaceId: acme.id,
      name: "Website Redesign",
      slug: slugify("Website Redesign"),
      key: "WEB",
      description: "Rediseño de la web corporativa",
      createdAt: daysAgo(390),
      members: {
        create: [
          { userId: ada.id, role: ProjectRole.OWNER, joinedAt: daysAgo(390) },
          { userId: alan.id, role: ProjectRole.ADMIN, joinedAt: daysAgo(390) },
          { userId: grace.id, role: ProjectRole.MEMBER, joinedAt: daysAgo(370) },
          { userId: katherine.id, role: ProjectRole.MEMBER, joinedAt: daysAgo(4) },
          // Sigue siendo miembro del workspace, pero fue retirada de este proyecto en concreto.
          { userId: margaret.id, role: ProjectRole.MEMBER, isActive: false, joinedAt: null },
        ],
      },
    },
  });

  const mobileApp = await prisma.project.create({
    data: {
      workspaceId: acme.id,
      name: "Mobile App",
      slug: slugify("Mobile App"),
      key: "APP",
      description: "Aplicación móvil de Acme",
      createdAt: daysAgo(300),
      members: {
        create: [
          { userId: ada.id, role: ProjectRole.OWNER, joinedAt: daysAgo(300) },
          { userId: alan.id, role: ProjectRole.ADMIN, joinedAt: daysAgo(300) },
          { userId: grace.id, role: ProjectRole.MEMBER, joinedAt: daysAgo(290) },
          { userId: katherine.id, role: ProjectRole.MEMBER, joinedAt: daysAgo(4) },
        ],
      },
    },
  });

  // Proyecto archivado: campaña cerrada hace más de un año.
  const marketingSite = await prisma.project.create({
    data: {
      workspaceId: acme.id,
      name: "Marketing Site",
      slug: slugify("Marketing Site"),
      key: "MKT",
      description: "Landing de campañas de marketing, proyecto cerrado",
      isArchived: true,
      createdAt: daysAgo(450),
      members: {
        create: [
          { userId: ada.id, role: ProjectRole.OWNER, joinedAt: daysAgo(450) },
          { userId: margaret.id, role: ProjectRole.MEMBER, joinedAt: daysAgo(450) },
        ],
      },
    },
  });

  // Proyecto en volumen, con muchos miembros y muchas tareas: para probar límites,
  // paginación y scroll en /tasks y en /projects/:slug/members.
  const BACKLOG_MEMBER_COUNT = 50;
  const backlogMembers = acmeBulkMembers.slice(0, BACKLOG_MEMBER_COUNT);

  const bigBacklog = await prisma.project.create({
    data: {
      workspaceId: acme.id,
      name: "Core Platform",
      slug: slugify("Core Platform"),
      key: "CORE",
      description: "Backlog principal de la plataforma: el equipo con más gente y más tareas abiertas",
      createdAt: daysAgo(250),
      members: {
        create: [
          { userId: ada.id, role: ProjectRole.OWNER, joinedAt: daysAgo(250) },
          { userId: alan.id, role: ProjectRole.ADMIN, joinedAt: daysAgo(250) },
          { userId: grace.id, role: ProjectRole.MEMBER, joinedAt: daysAgo(240) },
          { userId: margaret.id, role: ProjectRole.MEMBER, joinedAt: daysAgo(240) },
          { userId: katherine.id, role: ProjectRole.MEMBER, joinedAt: daysAgo(4) },
          ...backlogMembers.map((user, i) => ({
            userId: user.id,
            role: ProjectRole.MEMBER,
            joinedAt: daysAgo(BACKLOG_MEMBER_COUNT - i),
          })),
        ],
      },
    },
  });

  // --- Proyectos en volumen de Acme Inc, para probar paginación/scroll en el listado de proyectos ---
  // Nombres de iniciativas reales de producto, con la key derivada de sus iniciales.
  const PROJECT_NAMES = [
    "Design System", "Payments API", "Customer Portal", "Internal Wiki", "Search Revamp",
    "Notifications Service", "Billing Dashboard", "Onboarding Flow", "Data Pipeline", "Security Audit",
    "API Gateway", "Support Portal", "Analytics Dashboard", "Localization", "Dark Mode",
    "Performance Tuning", "Accessibility Audit", "Third-Party Integrations", "Feature Flags", "Rate Limiting",
    "Email Templates", "Push Notifications", "Two-Factor Auth", "Audit Logs", "Outbound Webhooks",
    "GraphQL Migration", "Design Tokens", "Component Library", "Video Calls", "File Uploads",
    "Offline Mode", "Dashboard Widgets", "Reporting Engine", "Currency Conversion", "Tax Calculation",
    "Inventory Sync", "Shipping Labels", "Fraud Detection", "Chatbot Support", "Voice Search",
  ];

  function projectKey(name: string): string {
    const words = name.split(/[\s-]+/).filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return words.map((word) => word[0]).join("").toUpperCase();
  }

  const bulkProjects = await Promise.all(
    PROJECT_NAMES.map((name, i) => {
      const createdAt = daysAgo(PROJECT_NAMES.length - i);

      return prisma.project.create({
        data: {
          workspaceId: acme.id,
          name,
          slug: slugify(name),
          key: projectKey(name),
          description: `Iniciativa de producto: ${name}.`,
          createdAt,
          members: {
            create: [
              { userId: ada.id, role: ProjectRole.OWNER, joinedAt: createdAt },
              { userId: acmeBulkMembers[i % acmeBulkMembers.length].id, role: ProjectRole.MEMBER, joinedAt: createdAt },
            ],
          },
        },
      });
    }),
  );

  // --- Proyecto de Freelance Studio ---
  // Mismo nombre y key que "Website Redesign" en Acme: demuestra que el slug solo es único por workspace.
  const clientWebsite = await prisma.project.create({
    data: {
      workspaceId: freelanceStudio.id,
      name: "Website Redesign",
      slug: slugify("Website Redesign"),
      key: "WEB",
      description: "Rediseño para un cliente externo",
      createdAt: daysAgo(140),
      members: {
        create: [
          { userId: grace.id, role: ProjectRole.OWNER, joinedAt: daysAgo(140) },
          { userId: katherine.id, role: ProjectRole.MEMBER, joinedAt: daysAgo(130) },
        ],
      },
    },
  });

  // --- Proyecto de Legacy Co ---
  const migration = await prisma.project.create({
    data: {
      workspaceId: legacyCo.id,
      name: "Migration",
      slug: slugify("Migration"),
      key: "MIG",
      isArchived: true,
      createdAt: daysAgo(500),
      members: {
        create: [{ userId: ada.id, role: ProjectRole.OWNER, joinedAt: daysAgo(500) }],
      },
    },
  });

  const [, , accessibilityTask, , cookiesPolicyTask] = await seedTasks({
    projectId: website.id,
    createdById: ada.id,
    tasks: [
      {
        title: "Diseñar la nueva home",
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        assigneeId: grace.id,
        dueDate: daysAgo(355),
        completedAt: daysAgo(350),
        createdAt: daysAgo(385),
      },
      {
        title: "Maquetar la página de precios",
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
        assigneeId: grace.id,
        dueDate: daysFromNow(3),
        createdAt: daysAgo(20),
      },
      {
        title: "Revisar accesibilidad",
        description: "Comprobar contraste de color y navegación por teclado según WCAG 2.1 AA.",
        status: TaskStatus.IN_REVIEW,
        priority: TaskPriority.MEDIUM,
        assigneeId: alan.id,
        dueDate: daysAgo(2), // vencida: caso extremo de tarea fuera de plazo
        createdAt: daysAgo(15),
      },
      {
        title: "Migrar el blog",
        status: TaskStatus.TODO,
        priority: TaskPriority.LOW,
        assigneeId: null,
        createdAt: daysAgo(10),
      },
      {
        title: "Actualizar política de cookies",
        description: "Legal pide adaptarla a la nueva normativa antes de fin de mes.",
        status: TaskStatus.TODO,
        priority: TaskPriority.URGENT,
        // Sigue asignada a Margaret aunque ya no sea miembro activo del proyecto.
        assigneeId: margaret.id,
        dueDate: daysAgo(10), // urgente y ya vencida
        createdAt: daysAgo(40),
      },
      {
        title: "Optimizar imágenes del hero",
        status: TaskStatus.DONE,
        priority: TaskPriority.LOW,
        assigneeId: katherine.id,
        dueDate: daysAgo(25),
        completedAt: daysAgo(20),
        createdAt: daysAgo(30),
      },
      {
        title: "Prototipo antiguo del footer",
        status: TaskStatus.TODO,
        priority: TaskPriority.LOW,
        assigneeId: null,
        isArchived: true, // tarea archivada, ya no aparece en el listado por defecto
        createdAt: daysAgo(200),
      },
    ],
  });

  const [, , , , crashBugTask] = await seedTasks({
    projectId: mobileApp.id,
    createdById: ada.id,
    tasks: [
      {
        title: "Configurar CI/CD",
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        assigneeId: alan.id,
        dueDate: daysAgo(285),
        completedAt: daysAgo(280),
        createdAt: daysAgo(298),
      },
      {
        title: "Implementar login",
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.URGENT,
        assigneeId: alan.id,
        dueDate: daysFromNow(1),
        createdAt: daysAgo(25),
      },
      {
        title: "Preparar release en las tiendas",
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        assigneeId: null,
        dueDate: daysFromNow(30),
        createdAt: daysAgo(5),
      },
      {
        title: "Diseñar onboarding",
        status: TaskStatus.IN_REVIEW,
        priority: TaskPriority.HIGH,
        assigneeId: katherine.id,
        dueDate: daysFromNow(5),
        createdAt: daysAgo(8),
      },
      {
        title: "Bug: crash al abrir notificaciones",
        description: "Reproducible en Android 14 al tener más de 20 notificaciones acumuladas.",
        status: TaskStatus.TODO,
        priority: TaskPriority.URGENT,
        assigneeId: grace.id,
        dueDate: daysAgo(1), // bug urgente y vencido
        createdAt: daysAgo(2),
      },
    ],
  });

  await seedTasks({
    projectId: marketingSite.id,
    createdById: ada.id,
    tasks: [
      {
        title: "Diseñar landing de verano",
        status: TaskStatus.DONE,
        priority: TaskPriority.MEDIUM,
        assigneeId: margaret.id,
        completedAt: daysAgo(440),
        isArchived: true,
        createdAt: daysAgo(448),
      },
      {
        title: "Publicar campaña de Black Friday",
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        assigneeId: ada.id,
        completedAt: daysAgo(400),
        isArchived: true,
        createdAt: daysAgo(410),
      },
    ],
  });

  await seedTasks({
    projectId: clientWebsite.id,
    createdById: grace.id,
    tasks: [
      {
        title: "Configurar dominio del cliente",
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        assigneeId: grace.id,
        completedAt: daysAgo(130),
        createdAt: daysAgo(138),
      },
      {
        title: "Diseñar wireframes",
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
        assigneeId: katherine.id,
        dueDate: daysFromNow(7),
        createdAt: daysAgo(20),
      },
      {
        title: "Redactar contenido",
        status: TaskStatus.TODO,
        priority: TaskPriority.LOW,
        assigneeId: null,
        createdAt: daysAgo(5),
      },
    ],
  });

  await seedTasks({
    projectId: migration.id,
    createdById: ada.id,
    tasks: [
      {
        title: "Exportar datos del cliente",
        status: TaskStatus.DONE,
        priority: TaskPriority.MEDIUM,
        assigneeId: ada.id,
        completedAt: daysAgo(495),
        isArchived: true,
        createdAt: daysAgo(499),
      },
    ],
  });

  // Tareas en volumen para Core Platform: supera el límite máximo de página (100),
  // para poder probar el clamp del `limit` además de la paginación normal.
  const BACKLOG_TASK_COUNT = 130;
  const TASK_STATUSES = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW, TaskStatus.DONE];
  const TASK_PRIORITIES = [TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.URGENT];
  const backlogAssignees = [ada.id, alan.id, grace.id, margaret.id, katherine.id, null, ...backlogMembers.map((u) => u.id)];

  // Título tipo "Verbo + sujeto", como tareas reales de un backlog técnico.
  const TASK_VERBS = [
    "Implementar", "Corregir", "Optimizar", "Refactorizar", "Documentar",
    "Investigar", "Diseñar", "Configurar", "Actualizar", "Eliminar",
    "Migrar", "Probar", "Revisar", "Automatizar", "Mejorar",
  ];
  const TASK_SUBJECTS = [
    "el endpoint de autenticación", "la validación de formularios", "el sistema de notificaciones",
    "la caché de consultas", "el flujo de pago", "la exportación a CSV", "el panel de administración",
    "la búsqueda avanzada", "los tests de integración", "la paginación de resultados",
    "el rate limiting de la API", "los logs de auditoría", "el manejo de errores", "la carga de imágenes",
    "el soporte multi-idioma", "la sincronización offline", "el envío de emails", "los webhooks salientes",
    "el dashboard de métricas", "la gestión de permisos",
  ];

  const backlogTasks = await seedTasks({
    projectId: bigBacklog.id,
    createdById: ada.id,
    tasks: Array.from({ length: BACKLOG_TASK_COUNT }, (_, i) => {
      const status = TASK_STATUSES[i % TASK_STATUSES.length];
      const createdAtDays = BACKLOG_TASK_COUNT - i;
      const verb = TASK_VERBS[i % TASK_VERBS.length];
      const subject = TASK_SUBJECTS[Math.floor(i / TASK_VERBS.length) % TASK_SUBJECTS.length];

      return {
        title: `${verb} ${subject}`,
        status,
        priority: TASK_PRIORITIES[i % TASK_PRIORITIES.length],
        assigneeId: backlogAssignees[i % backlogAssignees.length],
        createdAt: daysAgo(createdAtDays),
        // Las tareas terminadas se completan unos días después de crearse.
        completedAt: status === TaskStatus.DONE ? daysAgo(Math.max(createdAtDays - 3, 0)) : undefined,
        // Una de cada tres tareas abiertas tiene fecha límite, algunas ya vencidas.
        dueDate: status !== TaskStatus.DONE && i % 3 === 0 ? daysFromNow((i % 10) - 5) : undefined,
      };
    }),
  });

  // Hilo de comentarios en la tarea de accesibilidad: normal, editado y eliminado (soft delete).
  await prisma.comment.create({
    data: {
      taskId: accessibilityTask.id,
      authorId: ada.id,
      content: "Buen trabajo, solo falta revisar el contraste de los botones.",
      createdAt: daysAgo(14),
    },
  });
  await prisma.comment.create({
    data: {
      taskId: accessibilityTask.id,
      authorId: alan.id,
      content: "Tomo nota, lo corrijo esta tarde y actualizo el ticket.",
      editedAt: daysAgo(13),
      createdAt: daysAgo(14),
    },
  });
  await prisma.comment.create({
    data: {
      taskId: accessibilityTask.id,
      authorId: grace.id,
      content: "Comentario eliminado por su autora",
      deletedAt: daysAgo(12),
      createdAt: daysAgo(13),
    },
  });

  // Comentario sobre la tarea urgente y vencida.
  await prisma.comment.create({
    data: {
      taskId: cookiesPolicyTask.id,
      authorId: ada.id,
      content: "Esto lleva días vencido, ¿alguien puede reasignárselo a otra persona del equipo?",
      createdAt: daysAgo(3),
    },
  });

  // Comentario sobre el bug urgente de la app móvil.
  await prisma.comment.create({
    data: {
      taskId: crashBugTask.id,
      authorId: alan.id,
      content: "Confirmado en mi dispositivo de pruebas, le doy prioridad esta semana.",
      createdAt: daysAgo(1),
    },
  });

  // Hilo largo de comentarios en la primera tarea del backlog, para poder probar scroll.
  const commentAuthors = [ada.id, alan.id, grace.id, margaret.id, katherine.id];
  const COMMENT_MESSAGES = [
    "¿Alguna actualización sobre esto?",
    "Ya lo tengo casi listo, subo el PR mañana.",
    "Buen punto, lo tengo en cuenta antes de continuar.",
    "¿Podemos priorizar esto para el próximo sprint?",
    "Revisado y aprobado por mi parte.",
    "Necesito más contexto antes de seguir con esto.",
    "Esto depende de que se cierre la tarea anterior primero.",
    "Lo he probado en staging y funciona correctamente.",
    "¿Quién se encarga finalmente de esto?",
    "Voy a necesitar ayuda de backend para terminarlo.",
    "Actualizado según el feedback de la última reunión.",
    "Cerrado, ya está desplegado en producción.",
    "Reabro porque ha vuelto a fallar en producción.",
    "Añadido un test para cubrir este caso.",
    "Pendiente de validación con el cliente.",
  ];
  const firstBacklogTask = backlogTasks[0];
  const BACKLOG_COMMENT_COUNT = 25;

  for (let i = 0; i < BACKLOG_COMMENT_COUNT; i++) {
    await prisma.comment.create({
      data: {
        taskId: firstBacklogTask.id,
        authorId: commentAuthors[i % commentAuthors.length],
        content: COMMENT_MESSAGES[i % COMMENT_MESSAGES.length],
        createdAt: daysAgo(BACKLOG_COMMENT_COUNT - i),
      },
    });
  }

  const totalUsers = 8 + bulkUsers.length;
  const totalProjects = 5 + bulkProjects.length;

  console.log("Seed completed.");
  console.log("Users (password: password123):");
  console.log(`  - ${ada.email} (workspace owner, activo)`);
  console.log(`  - ${alan.email} (workspace admin, activo)`);
  console.log(`  - ${grace.email} (miembro, activo, dueño de Freelance Studio)`);
  console.log(`  - ${margaret.email} (miembro, activo)`);
  console.log(`  - ${katherine.email} (miembro, nunca ha iniciado sesión)`);
  console.log(`  - ${linus.email} (email sin verificar, invitación pendiente)`);
  console.log(`  - ${tim.email} (cuenta desactivada, expulsado del workspace)`);
  console.log(`  - ${dennis.email} (sin ningún workspace)`);
  console.log(`  - ${bulkUsers.length} usuarios generados en volumen (ej. ${bulkUsers[0].email}), misma contraseña`);
  console.log(`Total users: ${totalUsers}`);
  console.log(`Workspaces: ${acme.slug} (${ACME_BULK_MEMBER_COUNT + 7} miembros), ${freelanceStudio.slug}, ${legacyCo.slug} (inactivo)`);
  console.log(
    `Projects: ${totalProjects} en total. Destacados: ${website.slug}, ${mobileApp.slug}, ${marketingSite.slug} (archivado), ${bigBacklog.slug} (${BACKLOG_MEMBER_COUNT + 5} miembros, ${BACKLOG_TASK_COUNT} tareas), ${clientWebsite.slug}@${freelanceStudio.slug}, ${migration.slug}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

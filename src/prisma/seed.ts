import { prisma } from "../config/prisma.ts";
import { hashPassword } from "../shared/security/password.ts";
import slugify from "../shared/utils/slugify.ts";
import { rankBetween } from "../shared/utils/lexorank.ts";
import {
  WorkspaceRole,
  WorkspaceMemberStatus,
  ProjectRole,
  TaskStatus,
  TaskPriority,
} from "../shared/types/prisma.types.ts";

// La seed tiene dos mitades con trabajos distintos, y por eso están escritas de forma distinta:
//
//   1. Nimbus Studio: escrito a mano, tarea a tarea. Es el workspace que se enseña, así que los
//      textos se leen como los de un proyecto real y los casos límite (tarea vencida, sin
//      responsable, archivada, miembro dado de baja...) están puestos a conciencia.
//
//   2. Logística Peninsular: generado por iteración. Solo existe para tener listados largos con los
//      que ver la paginación y el tope de `limit`. Su contenido da igual.
//
// Las fechas son relativas al momento de ejecutar la seed, así que cada vez que se relanza el
// dataset vuelve a estar al día: hay trabajo vencido, trabajo de esta semana y trabajo recién
// cerrado, que es lo que miran las pantallas de resumen.

const PASSWORD = "Password123"; // cumple la política de `signUpSchema`: mayúscula, minúscula y dígito

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function daysFromNow(days: number): Date {
  return daysAgo(-days);
}

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

type CommentInput = {
  authorId: string;
  content: string;
  createdAt: Date;
  editedAt?: Date;
  deletedAt?: Date;
};

type TaskInput = {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  dueDate?: Date;
  completedAt?: Date;
  isArchived?: boolean;
  createdAt: Date;
  comments?: CommentInput[];
};

// Lo único que comparten las dos mitades, porque son reglas del modelo y no decisiones de
// contenido: el `rank` ordena dentro de cada columna del tablero (se encadena por estado, cada
// tarea detrás de la última de su columna), el `taskNumber` es correlativo dentro del proyecto y
// el `updatedAt` refleja la última actividad real, que es por lo que ordenan los resúmenes.
async function insertTasks(projectId: string, createdById: string, tasks: TaskInput[]) {
  const lastRankByStatus = new Map<TaskStatus, string>();

  for (const [index, input] of tasks.entries()) {
    const rank = rankBetween(lastRankByStatus.get(input.status) ?? null, null);
    lastRankByStatus.set(input.status, rank);

    const lastComment = input.comments?.at(-1)?.createdAt;

    const task = await prisma.task.create({
      data: {
        projectId,
        createdById,
        assigneeId: input.assigneeId,
        taskNumber: index + 1,
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        dueDate: input.dueDate,
        completedAt: input.completedAt,
        isArchived: input.isArchived ?? false,
        rank,
        createdAt: input.createdAt,
        updatedAt: lastComment ?? input.completedAt ?? input.createdAt,
      },
    });

    if (input.comments?.length) {
      await prisma.comment.createMany({
        data: input.comments.map((comment) => ({
          taskId: task.id,
          authorId: comment.authorId,
          content: comment.content,
          createdAt: comment.createdAt,
          updatedAt: comment.editedAt ?? comment.createdAt,
          editedAt: comment.editedAt,
          deletedAt: comment.deletedAt,
        })),
      });
    }
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { nextTaskNumber: tasks.length + 1 },
  });
}

// ---------------------------------------------------------------------------
// 1. Nimbus Studio — escrito a mano
// ---------------------------------------------------------------------------

async function seedNimbusStudio(passwordHash: string) {
  const person = (
    firstName: string,
    lastName: string,
    extra: Partial<Parameters<typeof prisma.user.create>[0]["data"]> = {},
  ) =>
    prisma.user.create({
      data: {
        firstName,
        lastName,
        email: `${slugify(firstName)}@taskflow.dev`,
        passwordHash,
        timezone: "Europe/Madrid",
        locale: "es",
        emailVerifiedAt: daysAgo(300),
        lastLoginAt: daysAgo(1),
        createdAt: daysAgo(300),
        ...extra,
      },
    });

  const demo = await person("Demo", "Usuario", { lastLoginAt: new Date() });
  const ana = await person("Ana", "Pereira");
  const bruno = await person("Bruno", "Salas");
  const carla = await person("Carla", "Ferrán");
  const diego = await person("Diego", "Ibáñez");
  // Invitada hace unos días, todavía no ha verificado el email.
  const elena = await person("Elena", "Roldán", {
    emailVerifiedAt: null,
    lastLoginAt: null,
    createdAt: daysAgo(6),
  });
  // Dejó el estudio: cuenta desactivada y expulsado del workspace. Sigue figurando como responsable
  // de tareas antiguas, que es justo el caso que interesa poder enseñar.
  const felix = await person("Félix", "Moret", { isActive: false, lastLoginAt: daysAgo(80) });
  // Aceptó la invitación pero aún no ha entrado ni una vez.
  const gema = await person("Gema", "Oliart", { lastLoginAt: null, createdAt: daysAgo(3) });

  const workspace = await prisma.workspace.create({
    data: {
      name: "Nimbus Studio",
      slug: "nimbus-studio",
      description: "Estudio de producto digital. Diseño y desarrollo de aplicaciones a medida.",
      createdAt: daysAgo(300),
      members: {
        create: [
          { userId: demo.id, role: WorkspaceRole.OWNER, status: WorkspaceMemberStatus.ACTIVE, joinedAt: daysAgo(300) },
          { userId: ana.id, role: WorkspaceRole.ADMIN, status: WorkspaceMemberStatus.ACTIVE, joinedAt: daysAgo(295) },
          { userId: bruno.id, role: WorkspaceRole.ADMIN, status: WorkspaceMemberStatus.ACTIVE, joinedAt: daysAgo(240) },
          { userId: carla.id, role: WorkspaceRole.MEMBER, status: WorkspaceMemberStatus.ACTIVE, joinedAt: daysAgo(180) },
          { userId: diego.id, role: WorkspaceRole.MEMBER, status: WorkspaceMemberStatus.ACTIVE, joinedAt: daysAgo(90) },
          { userId: gema.id, role: WorkspaceRole.MEMBER, status: WorkspaceMemberStatus.ACTIVE, joinedAt: daysAgo(3) },
          { userId: elena.id, role: WorkspaceRole.MEMBER, status: WorkspaceMemberStatus.PENDING, joinedAt: null },
          { userId: felix.id, role: WorkspaceRole.MEMBER, status: WorkspaceMemberStatus.REMOVED, joinedAt: null },
        ],
      },
    },
  });

  // --- Plataforma Web: el proyecto principal, el que se abre en la demo ---
  const web = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: "Plataforma Web",
      slug: "plataforma-web",
      key: "WEB",
      description: "Portal público y área privada de clientes.",
      color: "#2563eb",
      createdAt: daysAgo(280),
      members: {
        create: [
          { userId: demo.id, role: ProjectRole.OWNER, joinedAt: daysAgo(280) },
          { userId: ana.id, role: ProjectRole.ADMIN, joinedAt: daysAgo(280) },
          { userId: carla.id, role: ProjectRole.MEMBER, joinedAt: daysAgo(175) },
          { userId: diego.id, role: ProjectRole.MEMBER, joinedAt: daysAgo(88) },
          // Ya no trabaja en este proyecto, pero conserva tareas antiguas a su nombre.
          { userId: felix.id, role: ProjectRole.MEMBER, joinedAt: daysAgo(270), isActive: false },
        ],
      },
    },
  });

  await insertTasks(web.id, demo.id, [
    {
      title: "Definir la arquitectura de la información",
      description: "Mapa de secciones del portal y del área privada, acordado con el cliente.",
      status: TaskStatus.DONE,
      priority: TaskPriority.HIGH,
      assigneeId: ana.id,
      completedAt: daysAgo(255),
      createdAt: daysAgo(275),
    },
    {
      title: "Montar el sistema de diseño en Figma",
      status: TaskStatus.DONE,
      priority: TaskPriority.MEDIUM,
      assigneeId: ana.id,
      completedAt: daysAgo(230),
      createdAt: daysAgo(250),
    },
    {
      // Cerrada dentro de la última semana: es lo que alimenta el contador de velocidad.
      title: "Migrar el formulario de alta a la nueva API",
      status: TaskStatus.DONE,
      priority: TaskPriority.HIGH,
      assigneeId: demo.id,
      completedAt: daysAgo(2),
      createdAt: daysAgo(20),
    },
    {
      title: "Corregir el salto de foco al abrir el menú",
      status: TaskStatus.DONE,
      priority: TaskPriority.LOW,
      assigneeId: carla.id,
      completedAt: daysAgo(5),
      createdAt: daysAgo(12),
    },
    {
      title: "Revisar la accesibilidad del área privada",
      description: "Contraste de color y navegación completa por teclado, según WCAG 2.1 AA.",
      status: TaskStatus.IN_REVIEW,
      priority: TaskPriority.HIGH,
      assigneeId: demo.id,
      dueDate: daysFromNow(4), // vence esta semana
      createdAt: daysAgo(18),
      comments: [
        {
          authorId: ana.id,
          content: "He pasado el audit automático y quedan tres avisos de contraste en los botones secundarios.",
          createdAt: daysAgo(9),
        },
        {
          authorId: demo.id,
          content: "Vistos. Los dos primeros se arreglan cambiando el token de color; el tercero depende del fondo.",
          createdAt: daysAgo(8),
        },
        {
          authorId: carla.id,
          content: "Si cambiamos ese token, ojo que también afecta a la app móvil.",
          createdAt: daysAgo(8),
        },
        {
          authorId: demo.id,
          content: "Cierto. Lo hablo con Bruno antes de tocarlo y os cuento.",
          createdAt: daysAgo(7),
          editedAt: daysAgo(7),
        },
        {
          authorId: carla.id,
          content: "Comentario retirado por su autora.",
          createdAt: daysAgo(6),
          deletedAt: daysAgo(6), // borrado lógico: la API ya no lo devuelve en el listado
        },
        {
          authorId: ana.id,
          content: "Con el token nuevo pasan los tres. Queda solo la revisión con lector de pantalla.",
          createdAt: daysAgo(3),
        },
      ],
    },
    {
      title: "Implementar el buscador con filtros",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      assigneeId: diego.id,
      dueDate: daysFromNow(6),
      createdAt: daysAgo(14),
      comments: [
        {
          authorId: diego.id,
          content: "Los filtros por categoría ya funcionan. Me falta el de rango de fechas.",
          createdAt: daysAgo(4),
        },
      ],
    },
    {
      title: "Optimizar la carga de imágenes del portal",
      description: "La home tarda casi cuatro segundos en móvil. Sospechamos de las imágenes del carrusel.",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      assigneeId: demo.id,
      dueDate: daysFromNow(12), // programada, fuera de la ventana de "vence pronto"
      createdAt: daysAgo(11),
    },
    {
      title: "Conectar el envío de notificaciones por email",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      assigneeId: carla.id,
      createdAt: daysAgo(9),
    },
    {
      title: "Renovar el certificado SSL del dominio",
      description: "Caducó la semana pasada y el aviso del navegador asusta a los clientes.",
      status: TaskStatus.TODO,
      priority: TaskPriority.URGENT,
      assigneeId: demo.id,
      dueDate: daysAgo(4), // vencida y urgente
      createdAt: daysAgo(10),
      comments: [
        {
          authorId: bruno.id,
          content: "Esto es lo más urgente que tenemos ahora mismo, no lo dejemos pasar otra semana.",
          createdAt: daysAgo(2),
        },
      ],
    },
    {
      title: "Rehacer la plantilla de la factura en PDF",
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      assigneeId: felix.id, // responsable que ya no es miembro activo del proyecto
      dueDate: daysAgo(15), // vencida y sin nadie que la recoja
      createdAt: daysAgo(60),
    },
    {
      title: "Escribir los tests del flujo de registro",
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      assigneeId: demo.id,
      createdAt: daysAgo(7), // sin fecha límite
    },
    {
      title: "Documentar el despliegue en el README",
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      assigneeId: null, // sin responsable
      createdAt: daysAgo(6),
    },
    {
      title: "Revisar los textos legales con el cliente",
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      assigneeId: null,
      dueDate: daysFromNow(30),
      createdAt: daysAgo(5),
    },
    {
      title: "Preparar la demo para la reunión del viernes",
      status: TaskStatus.TODO,
      priority: TaskPriority.URGENT,
      assigneeId: ana.id,
      dueDate: daysFromNow(2),
      createdAt: daysAgo(3),
    },
    {
      title: "Prototipo descartado de la home antigua",
      status: TaskStatus.DONE,
      priority: TaskPriority.LOW,
      assigneeId: ana.id,
      completedAt: daysAgo(200),
      isArchived: true, // archivada: fuera del listado por defecto
      createdAt: daysAgo(220),
    },
  ]);

  // --- App Móvil: segundo proyecto, más pequeño ---
  const app = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: "App Móvil",
      slug: "app-movil",
      key: "APP",
      description: "Aplicación para iOS y Android conectada a la plataforma.",
      color: "#16a34a",
      createdAt: daysAgo(120),
      members: {
        create: [
          { userId: demo.id, role: ProjectRole.OWNER, joinedAt: daysAgo(120) },
          { userId: bruno.id, role: ProjectRole.ADMIN, joinedAt: daysAgo(120) },
          { userId: diego.id, role: ProjectRole.MEMBER, joinedAt: daysAgo(85) },
        ],
      },
    },
  });

  await insertTasks(app.id, demo.id, [
    {
      title: "Configurar el pipeline de builds",
      status: TaskStatus.DONE,
      priority: TaskPriority.HIGH,
      assigneeId: bruno.id,
      completedAt: daysAgo(100),
      createdAt: daysAgo(115),
    },
    {
      title: "Pantalla de inicio de sesión",
      status: TaskStatus.DONE,
      priority: TaskPriority.HIGH,
      assigneeId: diego.id,
      completedAt: daysAgo(6),
      createdAt: daysAgo(40),
    },
    {
      title: "Sincronización offline de tareas",
      description: "Guardar los cambios en local y reenviarlos cuando vuelva la conexión.",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.URGENT,
      assigneeId: bruno.id,
      dueDate: daysFromNow(5),
      createdAt: daysAgo(30),
      comments: [
        {
          authorId: bruno.id,
          content: "La cola de reenvío ya funciona. Falta decidir qué hacer cuando hay conflicto.",
          createdAt: daysAgo(5),
        },
        {
          authorId: demo.id,
          content: "Por ahora que gane el cambio del servidor y avisamos al usuario.",
          createdAt: daysAgo(4),
        },
      ],
    },
    {
      title: "Crash al abrir una notificación con la app cerrada",
      description: "Reproducible en Android 14. Solo ocurre si hay más de veinte notificaciones acumuladas.",
      status: TaskStatus.IN_REVIEW,
      priority: TaskPriority.URGENT,
      assigneeId: demo.id,
      dueDate: daysAgo(1), // venció ayer
      createdAt: daysAgo(8),
    },
    {
      title: "Adaptar la navegación a tablets",
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      assigneeId: demo.id,
      dueDate: daysFromNow(20),
      createdAt: daysAgo(6),
    },
    {
      title: "Preparar las fichas de las tiendas",
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      assigneeId: null,
      createdAt: daysAgo(4),
    },
    {
      title: "Revisar los permisos de cámara en iOS",
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      assigneeId: diego.id,
      createdAt: daysAgo(2),
    },
  ]);

  // --- Rediseño de Marca: proyecto archivado ---
  const brand = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: "Rediseño de Marca",
      slug: "rediseno-de-marca",
      key: "MARCA",
      description: "Identidad visual del estudio. Se cerró el año pasado.",
      color: "#db2777",
      isArchived: true,
      createdAt: daysAgo(290),
      members: {
        create: [
          { userId: demo.id, role: ProjectRole.OWNER, joinedAt: daysAgo(290) },
          { userId: ana.id, role: ProjectRole.ADMIN, joinedAt: daysAgo(290) },
        ],
      },
    },
  });

  await insertTasks(brand.id, demo.id, [
    {
      title: "Propuesta de logotipo",
      status: TaskStatus.DONE,
      priority: TaskPriority.HIGH,
      assigneeId: ana.id,
      completedAt: daysAgo(270),
      createdAt: daysAgo(285),
    },
    {
      title: "Manual de marca",
      status: TaskStatus.DONE,
      priority: TaskPriority.MEDIUM,
      assigneeId: ana.id,
      completedAt: daysAgo(262),
      createdAt: daysAgo(280),
    },
    {
      title: "Papelería y tarjetas",
      status: TaskStatus.DONE,
      priority: TaskPriority.LOW,
      assigneeId: ana.id,
      completedAt: daysAgo(258),
      createdAt: daysAgo(275),
    },
  ]);

  // --- Portal de Clientes: recién creado, todavía sin ninguna tarea ---
  await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: "Portal de Clientes",
      slug: "portal-de-clientes",
      key: "PORT",
      description: "Área de seguimiento para los clientes del estudio. Arranca el mes que viene.",
      color: "#f59e0b",
      createdAt: daysAgo(2),
      members: {
        create: [{ userId: demo.id, role: ProjectRole.OWNER, joinedAt: daysAgo(2) }],
      },
    },
  });

  return { demo, ana };
}

// Un workspace dado de baja. Existe para que el estado `isActive: false` tenga material: no sale en
// el listado por defecto, solo al filtrar por él, y desde dentro es de solo lectura.
async function seedClosedWorkspace(demoId: string, partnerId: string) {
  const workspace = await prisma.workspace.create({
    data: {
      name: "Herrera & Vidal",
      slug: "herrera-vidal",
      description: "Cliente antiguo. La colaboración terminó y el espacio quedó dado de baja.",
      isActive: false,
      createdAt: daysAgo(620),
      members: {
        create: [
          { userId: demoId, role: WorkspaceRole.OWNER, status: WorkspaceMemberStatus.ACTIVE, joinedAt: daysAgo(620) },
          { userId: partnerId, role: WorkspaceRole.MEMBER, status: WorkspaceMemberStatus.ACTIVE, joinedAt: daysAgo(615) },
        ],
      },
    },
  });

  const site = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: "Web Corporativa",
      slug: "web-corporativa",
      key: "WEB", // mismo slug y key que en Nimbus: ambos son únicos por workspace, no globalmente
      description: "Sitio corporativo del cliente. Entregado y cerrado.",
      isArchived: true,
      createdAt: daysAgo(615),
      members: {
        create: [
          { userId: demoId, role: ProjectRole.OWNER, joinedAt: daysAgo(615) },
          { userId: partnerId, role: ProjectRole.MEMBER, joinedAt: daysAgo(615) },
        ],
      },
    },
  });

  await insertTasks(site.id, demoId, [
    {
      title: "Entrega final al cliente",
      status: TaskStatus.DONE,
      priority: TaskPriority.HIGH,
      assigneeId: demoId,
      completedAt: daysAgo(560),
      createdAt: daysAgo(590),
    },
    {
      title: "Traspaso del dominio y los accesos",
      status: TaskStatus.DONE,
      priority: TaskPriority.MEDIUM,
      assigneeId: partnerId,
      completedAt: daysAgo(555),
      createdAt: daysAgo(580),
    },
  ]);
}

// ---------------------------------------------------------------------------
// 2. Logística Peninsular — generado por iteración
// ---------------------------------------------------------------------------
// Los tamaños pasan de 100, que es el `limit` máximo que acepta la API, para poder ver tanto la
// paginación como el recorte del límite. Todo se deriva del índice: sin aleatoriedad, el dataset
// sale idéntico en cada ejecución.

const BULK_USERS = 120;
const BULK_PROJECTS = 110;
const BIG_PROJECT_TASKS = 120;
const BIG_PROJECT_COMMENTS = 125;
const TASKS_PER_PROJECT = 6;

const FIRST_NAMES = [
  "Lucía", "Martín", "Sofía", "Hugo", "Valeria", "Mateo", "Emma", "Bruno", "Olivia", "Leo",
  "Julia", "Pablo", "Noa", "Álvaro", "Vega", "Marco", "Irene", "Nico", "Alba", "Iván",
];
const LAST_NAMES = [
  "Alonso", "Bravo", "Carrasco", "Duarte", "Esteban", "Fuentes", "Gallego", "Herrera",
  "Iglesias", "Jurado", "Lorenzo", "Mateos", "Navarro", "Ortega", "Prieto", "Quintana",
  "Rueda", "Sierra", "Tejada", "Ureña",
];
const CITIES = [
  "Madrid", "Barcelona", "Valencia", "Sevilla", "Zaragoza", "Málaga", "Murcia", "Bilbao",
  "Alicante", "Córdoba", "Valladolid", "Vigo", "Gijón", "Granada", "Oviedo", "Pamplona",
  "Almería", "Burgos", "Salamanca", "León", "Cádiz", "Huelva", "Lleida", "Tarragona",
  "Badajoz", "Logroño", "Santander", "Toledo",
];
const ZONES = ["Norte", "Sur", "Este", "Oeste"];

const TASK_TITLES = [
  "Revisar el inventario del almacén",
  "Cerrar el parte mensual de incidencias",
  "Actualizar el cuadrante de turnos",
  "Renovar el contrato de mantenimiento",
  "Auditar el consumo energético del centro",
  "Formar al personal en prevención de riesgos",
  "Revisar las hojas de ruta de reparto",
  "Actualizar el listado de proveedores",
  "Preparar el informe trimestral de costes",
  "Revisar la señalización de seguridad",
  "Planificar la parada técnica del trimestre",
  "Actualizar el protocolo de apertura y cierre",
  "Revisar las devoluciones pendientes",
  "Cuadrar el arqueo de caja del mes",
  "Solicitar presupuesto para nuevas estanterías",
  "Analizar los tiempos de entrega de la última ruta",
  "Coordinar la limpieza industrial de la planta",
  "Revisar el estado de la flota ligera",
  "Negociar las tarifas con la agencia de transporte",
  "Actualizar el plan de emergencia y evacuación",
];

const COMMENTS = [
  "¿Alguna novedad sobre esto?",
  "Lo tengo casi cerrado, mañana lo confirmo.",
  "Pendiente de que responda el proveedor.",
  "Revisado por mi parte, todo correcto.",
  "Necesito más datos antes de continuar.",
  "Esto depende de que se cierre lo anterior.",
  "Confirmado con el responsable del centro.",
  "Lo dejo para la semana que viene, esta no llego.",
  "Ya está hecho y verificado.",
  "Subo la prioridad, nos está bloqueando.",
  "Avisado el equipo por el grupo interno.",
  "Queda pendiente la validación final.",
];

const STATUSES = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW, TaskStatus.DONE];
const PRIORITIES = [TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.URGENT];

async function seedLogistica(passwordHash: string, demoId: string) {
  // Cada combinación de nombre y apellido es distinta (20 x 20 = 400 posibles), así que el email se
  // puede derivar del nombre sin arrastrar un contador.
  const users = await Promise.all(
    Array.from({ length: BULK_USERS }, (_, index) => {
      const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
      const lastName = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
      const createdAt = daysAgo(BULK_USERS - index); // escalonados, para que ordenar por fecha tenga sentido

      return prisma.user.create({
        data: {
          firstName,
          lastName,
          email: `${slugify(firstName)}.${slugify(lastName)}@logistica.dev`,
          passwordHash,
          timezone: "Europe/Madrid",
          locale: "es",
          // Uno de cada veinte desactivado y uno de cada diez sin verificar el email.
          isActive: index % 20 !== 0,
          emailVerifiedAt: index % 10 === 0 ? null : createdAt,
          lastLoginAt: index % 10 === 0 ? null : daysAgo(index % 30),
          createdAt,
        },
      });
    }),
  );

  const workspace = await prisma.workspace.create({
    data: {
      name: "Logística Peninsular",
      slug: "logistica-peninsular",
      description: "Grupo con centros de distribución repartidos por todo el país.",
      createdAt: daysAgo(500),
      members: {
        create: [
          // Aquí el demo es ADMIN y no dueño: es lo que permite ver qué puede y qué no puede hacer
          // un admin, por ejemplo que no pueda tocar al OWNER.
          { userId: demoId, role: WorkspaceRole.ADMIN, status: WorkspaceMemberStatus.ACTIVE, joinedAt: daysAgo(500) },
          ...users.map((user, index) => ({
            userId: user.id,
            role: index === 0 ? WorkspaceRole.OWNER : index % 15 === 0 ? WorkspaceRole.ADMIN : WorkspaceRole.MEMBER,
            // Una cola de invitaciones pendientes y algún expulsado al final, para que los filtros
            // por estado devuelvan resultados en todas sus combinaciones.
            status:
              index >= BULK_USERS - 6
                ? WorkspaceMemberStatus.REMOVED
                : index >= BULK_USERS - 16
                  ? WorkspaceMemberStatus.PENDING
                  : WorkspaceMemberStatus.ACTIVE,
            joinedAt: index < BULK_USERS - 16 ? daysAgo(BULK_USERS - index) : null,
          })),
        ],
      },
    },
  });

  const activeUsers = users.slice(0, BULK_USERS - 16);

  for (let index = 0; index < BULK_PROJECTS; index++) {
    // Ciudad x zona da 112 nombres distintos, de sobra para los 110 proyectos.
    const name = `${CITIES[index % CITIES.length]} ${ZONES[Math.floor(index / CITIES.length) % ZONES.length]}`;
    const createdAt = daysAgo(BULK_PROJECTS - index + 30);
    const isBig = index === 0;

    // El equipo sale de una ventana deslizante sobre la plantilla: cada proyecto tiene gente
    // distinta sin necesidad de sortear nada.
    const teamSize = isBig ? 40 : 5;
    const team = Array.from(
      { length: teamSize },
      (_, position) => activeUsers[(index * 3 + position) % activeUsers.length],
    );

    const project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name,
        slug: slugify(name),
        key: `L${String(index + 1).padStart(3, "0")}`,
        description: `Centro de distribución de ${name}.`,
        // Uno de cada quince archivado, para que el filtro `isArchived` tenga material.
        isArchived: index > 0 && index % 15 === 0,
        createdAt,
        members: {
          create: [
            // El demo tiene que ser miembro activo: `GET /projects` solo devuelve los proyectos en
            // los que lo es, así que sin esto el listado largo no se vería.
            { userId: demoId, role: ProjectRole.MEMBER, joinedAt: createdAt },
            ...team.map((user, position) => ({
              userId: user.id,
              role: position === 0 ? ProjectRole.OWNER : ProjectRole.MEMBER,
              joinedAt: createdAt,
              isActive: position !== teamSize - 1, // el último de cada equipo está dado de baja
            })),
          ],
        },
      },
    });

    const taskCount = isBig ? BIG_PROJECT_TASKS : TASKS_PER_PROJECT;

    const tasks: TaskInput[] = Array.from({ length: taskCount }, (_, position) => {
      const status = STATUSES[position % STATUSES.length];
      const createdDaysAgo = taskCount - position + 5;
      const title = TASK_TITLES[position % TASK_TITLES.length];
      const round = Math.floor(position / TASK_TITLES.length);

      return {
        // La vuelta va en el título para no repetir la misma tarea dentro de un proyecto.
        title: round === 0 ? title : `${title} (fase ${round + 1})`,
        status,
        priority: PRIORITIES[position % PRIORITIES.length],
        // Una de cada cinco se queda sin responsable.
        assigneeId: position % 5 === 0 ? null : team[position % team.length].id,
        createdAt: daysAgo(createdDaysAgo),
        // Las terminadas se cierran unos días después de crearse, y algunas dentro de la última
        // semana para que el contador de velocidad no salga a cero.
        completedAt: status === TaskStatus.DONE ? daysAgo(Math.max(createdDaysAgo - 8, position % 7)) : undefined,
        // Una de cada tres abiertas lleva fecha límite, repartida entre vencidas y futuras.
        dueDate: status !== TaskStatus.DONE && position % 3 === 0 ? daysFromNow((position % 20) - 7) : undefined,
        isArchived: status === TaskStatus.DONE && position % 17 === 0,
        // La primera tarea del proyecto grande lleva el hilo largo.
        comments:
          isBig && position === 0
            ? Array.from({ length: BIG_PROJECT_COMMENTS }, (_, commentIndex) => ({
                authorId: team[commentIndex % team.length].id,
                content: COMMENTS[commentIndex % COMMENTS.length],
                createdAt: daysAgo(BIG_PROJECT_COMMENTS - commentIndex),
              }))
            : undefined,
      };
    });

    await insertTasks(project.id, team[0].id, tasks);
  }

  return workspace;
}

async function main() {
  console.time("seed");
  await resetDatabase();

  // Una sola vez: hashear por usuario dispararía el tiempo de la seed y todos comparten contraseña.
  const passwordHash = await hashPassword(PASSWORD);

  const { demo, ana } = await seedNimbusStudio(passwordHash);
  await seedClosedWorkspace(demo.id, ana.id);
  await seedLogistica(passwordHash, demo.id);

  const [users, workspaces, projects, tasks, comments] = await Promise.all([
    prisma.user.count(),
    prisma.workspace.count(),
    prisma.project.count(),
    prisma.task.count(),
    prisma.comment.count(),
  ]);

  console.timeEnd("seed");
  console.log(`\n${users} usuarios, ${workspaces} workspaces, ${projects} proyectos, ${tasks} tareas, ${comments} comentarios.`);
  console.log(`\nAcceso: ${demo.email} / ${PASSWORD}  (misma contraseña para todos)`);
  console.log("\n  nimbus-studio          OWNER   escrito a mano, es el que se enseña");
  console.log("  herrera-vidal          OWNER   dado de baja, solo visible con ?isActive=false");
  console.log(`  logistica-peninsular   ADMIN   ${BULK_PROJECTS} proyectos y ${BULK_USERS} usuarios, para listados largos`);
  console.log(`                                 madrid-norte -> ${BIG_PROJECT_TASKS} tareas y ${BIG_PROJECT_COMMENTS} comentarios en L001-1`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

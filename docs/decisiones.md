# TaskFlow — Decisiones del proyecto

## Backend

### Lenguaje y framework: Node.js + TypeScript + Express 5

Quería un stack de backend consolidado, usado en empresas grandes, para que el proyecto tuviera peso real de cara a un portfolio. TypeScript no fue una opción a valorar, sino un requisito desde el principio.

**Por qué Express y no Fastify/NestJS/Hono:** es el framework más extendido y reconocible del ecosistema Node — la prioridad era consolidar un stack conocido, no explorar alternativas más nuevas u opinionadas.

### Base de datos y ORM: PostgreSQL + Prisma 7

Prisma es un ORM moderno y muy conocido en el ecosistema TypeScript. En producción la base de datos correrá en Neon (ya lo había usado antes): tiene capa gratuita, sin _sleep_ ni _cold start_, algo importante para que el proyecto esté siempre disponible en el portfolio. En local, dos contenedores Postgres separados vía Docker Compose: uno para desarrollo y otro exclusivo para tests, para no machacar los datos de desarrollo cada vez que corre la suite.

### Almacenamiento de archivos: Cloudflare R2 (prod) + MinIO (dev)

Cloudflare R2 en producción y MinIO en desarrollo, ambos compatibles con la API de S3.

**Por qué:** R2 usa la API de S3 (conocida, con capa gratuita ideal para un portfolio) y MinIO habla esa misma API, así el código de storage no cambia entre entornos y todo se puede levantar en local vía Docker.

**Subida de archivos: URL prefirmada (presigned URL), no proxy por el backend.** El backend expone un endpoint que devuelve una URL de `PutObject` firmada; el cliente sube el archivo directo al bucket (R2 o MinIO) y el backend nunca ve los bytes del archivo pasar por su memoria/ancho de banda.

**Por qué:** aunque el primer caso de uso (avatar de workspace) es un archivo pequeño donde un proxy por el backend sería igual de simple, el sistema de storage se diseña una vez para todos los casos de uso futuros (adjuntos de tareas, que sí pueden ser archivos grandes), y ahí la URL prefirmada escala mejor. Requiere configurar CORS en el bucket y validar el archivo con condiciones en la policy de la URL firmada en vez de leerlo en el backend, pero evita que el servidor sea un cuello de botella de ancho de banda para subidas.

### Validación: Zod

Es el estándar de facto para validar datos en proyectos TypeScript, y además llevo tiempo usándolo — no hubo necesidad de evaluar alternativas como Joi o class-validator.

### Autenticación: JWT (access + refresh) con bcrypt, en cookies httpOnly

Access token de corta duración + refresh token para no forzar al usuario a reautenticarse constantemente, con bcrypt para el hash de contraseñas. Los tokens se envían en cookies httpOnly en vez de exponerlos en el cuerpo de la respuesta o esperarlos en un header `Authorization`, buscando mayor seguridad frente a robo de tokens vía XSS.

### Arquitectura en capas: routes → controller → service → repository

Vengo de trabajar con Spring Boot y esa separación de responsabilidades (capa de entrada HTTP, lógica de negocio, acceso a datos) me parece escalable y ordenada, así que trasladé el mismo patrón a Express en vez de usar una estructura más plana.

### Testing: Vitest + Supertest (tests de integración)

Ya había trabajado con esta combinación antes y es una elección conocida en el ecosistema. Los tests son de integración (contra una base de datos Postgres real en el contenedor de test) en vez de unitarios con mocks.

### Ordenación de tareas: lexorank

Para el orden de las tareas en el tablero (drag & drop) probé primero con un campo numérico de orden, pero me encontré con el límite natural de reordenaciones que tiene ese enfoque (hay que renumerar o dejar huecos, y eventualmente se agotan). Investigué y encontré que lexorank (orden por claves alfanuméricas, al estilo Jira) es la solución más profesional para este problema, así que la adopté.

### Historial, notificaciones y tiempo real: una tabla de eventos de dominio

Las tres features se apoyan en la misma pieza — una tabla de eventos inmutables con actor, acción, entidad, payload y fecha — en vez de resolver cada una por su cuenta. El historial es leer esos eventos, las notificaciones son materializar los que te afectan y el tiempo real es empujarlos por la sala del proyecto. Los eventos se escriben en la misma transacción que la mutación que los origina, para que el registro no pueda afirmar algo que luego hizo rollback.

Para el transporte en vivo, socket.io en vez de `ws` a pelo: hacen falta salas por proyecto y reconexión con backoff, y con `ws` eso hay que escribirlo a mano junto con los heartbeats. El interés está en el modelado de eventos, no en reimplementar un multiplexor.

El diseño completo (esquema, catálogo de acciones, reglas de destinatarios, menciones, aristas conocidas y fases) está en `eventos-de-dominio.md`.

### Soft delete reversible: cada baja tiene su verbo inverso

Todas las bajas son lógicas (`isActive`, `isArchived`, `deletedAt`, `WorkspaceMemberStatus`), pero durante un tiempo fueron de ida: no existía ninguna ruta para reactivar un espacio, desarchivar un proyecto o una tarea, restaurar un comentario ni devolver a un miembro. Ahora cada una tiene su inversa, y estas son las reglas que las gobiernan.

**El verbo inverso es el de la baja que lo mató, no un `activate` genérico.** `remove` → `restore`, `deactivate` → `activate`, `archive` → `unarchive`, `delete` → `restore`. Eso deja a `PATCH /members/:userId/activate` del espacio queriendo decir una sola cosa — "la invitación PENDING se acepta" — y la readmisión de un eliminado como ruta aparte, con su propio evento (`WORKSPACE_MEMBER_RESTORED`) y su propio cuerpo. Fusionarlas habría obligado a ramificar acción y validación por el estado previo dentro de un mismo service.

**Lo muerto se direcciona con cargadores hermanos, no con un flag.** `findWorkspaceBySlug` filtra `isActive: true` y `findProjectBySlug` filtra `isArchived: false`, que es justo lo que hace que un espacio desactivado responda 404 en todas partes. Para la reversión hay dos funciones nuevas con el estado en el nombre (`findWorkspaceBySlugIncludingInactive`, `findProjectBySlugIncludingArchived`) y sus dos cargadores de contexto (`getWorkspaceContextIncludingInactive`, `getProjectContextIncludingArchivedAllowingWorkspaceManager`).

**Por qué no un `includeInactive` booleano:** tendría que atravesar `getWorkspaceContext` → `getProjectContextAllowingWorkspaceManager` → `getProjectContext`, tres funciones de las que la última no debe admitirlo nunca, y ensancharía el radio de todos los llamantes actuales para servir a dos rutas. El nombre hermano declara la excepción en el punto de llamada y deja el camino caliente intacto.

**El espacio manda sobre el proyecto.** El cargador de desarchivado resuelve el espacio con el cargador estricto, así que desarchivar un proyecto de un espacio inactivo da 404: primero se reactiva el espacio. La precedencia la impone el cargador, no una comprobación suelta en el service.

**Tarea archivada y comentario borrado no necesitaron cargador.** `getTaskContext` y `getCommentContext` nunca filtraron el estado (son `update` y `move` los que rechazan a mano una tarea archivada), así que siguen siendo direccionables y su vuelta es solo ruta + service.

**La baja machaca el rol, y la vuelta lo vuelve a elegir.** `remove`, `leave` y `deactivate` ponen `role: MEMBER` a propósito: una fila muerta no debe conservar permisos. Por eso `restore` y `activate` aceptan un `role` opcional (por defecto `MEMBER`), validado con las mismas reglas de asignación que el alta. Las alternativas eran volver siempre como MEMBER y cambiar el rol después —dos pasos, y un cambio de rol en el historial que nadie pidió— o una columna `previousRole`, que añade esquema para guardar una verdad que caduca: a quien se readmite tres meses después no se le devuelve OWNER por inercia.

**Sin cascada inversa.** `leave` desactiva las pertenencias a proyectos del espacio, pero `restore` no las reactiva. Una cascada inversa resucitaría también filas que `remove` nunca mató, y la de `leave` ya había machacado los roles, así que solo podría devolver una verdad a medias. Quién vuelve a un proyecto lo decide quien manda en ese proyecto.

**El `create` de miembros distingue la fila viva de la muerta.** Una fila de membresía nunca se borra (`@@unique([userId, workspaceId])`), así que `POST /members` siempre choca. Si la fila está viva sigue devolviendo "already a member"; si está muerta, un mensaje que apunta al restore. Lo que distingue las dos ramas es el mensaje y no el status: los dos módulos de miembros resuelven *todas* sus guardas de estado con 400, mientras que espacio, proyecto y comentario usan 409, y lo nuevo sigue al módulo en el que vive en lugar de abrir una tercera convención. Es además una rama defensiva para consumidores directos de la API: los dos selectores de personas excluyen a quien ya tiene fila en cualquier estado, así que desde la UI no se puede llegar a ese choque.

**Restaurar no comprueba `User.isActive`.** El alta rechaza a un usuario desactivado, pero la vuelta no: su fila ya existe y esa persona sigue figurando como autora y asignada en el espacio, así que bloquearla la dejaría encerrada para siempre si su cuenta no se reactiva. Lo que le impide operar es su propio acceso.

**El ciclo de vida, módulo a módulo.** La regla es una: *un recurso dado de baja es de solo lectura, y lo único que admite es su propia reversión*. Cómo se enforce cambia según si el recurso sigue siendo direccionable:

| Recurso | De baja | Se lee | Se escribe | Cómo se corta |
|---|---|---|---|---|
| Workspace | `isActive: false` | solo la fila del listado (`?isActive=false`) | nada salvo `/reactivate` | el loader filtra → 404 en todo lo demás |
| Project | `isArchived: true` | solo la fila del listado (`?isArchived=true`) | nada salvo `/unarchive` | el loader filtra → 404 |
| Task | `isArchived: true` | todo (detalle, comentarios) | nada salvo `/unarchive` | el loader **no** filtra, así que el corte lo ponen los services a mano |
| Comment | `deletedAt` | no sale del listado | nada salvo `/restore` | el listado filtra; el id sigue resolviendo |
| Membresías | `REMOVED` / `isActive: false` | la fila del listado por estado | nada salvo `/restore` o `/activate` | el service rechaza `update` |

Dos consecuencias de esa regla que hubo que arreglar al añadir las reversiones:

- **Los responsables viajan en el listado, no se preguntan por fila.** La tabla de gestión pintaba las caras de los owners con una petición de miembros *por fila*, que en un espacio desactivado o un proyecto archivado responde 404 — justo en la pestaña donde hay que decidir si recuperarlo. Ahora `findAll` los resuelve en lote y la fila los trae (`WorkspaceListItemResponseDto` / `ProjectListItemResponseDto`). De paso desaparece un N+1 que también pagaba la pestaña de activos.
- **Una tarea archivada era de solo lectura a medias:** no se podía editar su título, pero sí comentarla, editar y borrar comentarios. Como su contexto sí la resuelve, el corte está ahora explícito en `comments.service` (`requireUnarchivedTask`), igual que ya lo hacían `update` y `move` de la propia tarea. Los favoritos quedan fuera a propósito: son una marca personal sin huella de dominio (no emiten eventos).
- **La ficha de una persona ya no exige compartir un espacio *activo*.** `findProfileById` filtraba `workspace.isActive: true`, así que el popup de un responsable de un espacio desactivado daba 404 mientras su avatar seguía pintándose. Desactivar un espacio no convierte a su gente en desconocidos; lo que sigue acotando quién puede mirar es la pertenencia ACTIVE de quien pregunta.

**El ciclo de vida nunca cambia quién ve qué.** Es el patrón que siguen los cinco listados: el ámbito padre decide quién entra y la pertenencia decide qué fila es tuya, y la baja no mueve ninguna de las dos cosas. Quien podía ver algo vivo lo sigue viendo muerto (las membresías sobreviven a la desactivación y al archivado), y quien no podía verlo sigue sin verlo. Ningún listado da visibilidad extra por ser manager.

**Lo que ese patrón deja sin cerrar:** un proyecto archivado del que no eres miembro activo no aparece en `GET .../projects` ni con `?isArchived=true` — y tampoco aparecía cuando estaba activo, así que el archivado no quita nada. Lo que chirría es que `requireWorkspaceOrProjectManager` sí deja a un manager del espacio archivarlo y desarchivarlo desde fuera: el mando alcanza más que el listado. Pasa con quien archiva un proyecto al que nunca se añadió, y ya pasaba antes de que existiera la vuelta.

Cerrarlo obliga a mover una de dos puertas, y ninguna es barata: **ensanchar el listado** (que un manager vea proyectos que nunca tocó, sin precedente en ningún otro listado y en contra de la regla de producto de que un contador solo cuenta lo alcanzable) o **estrechar el permiso** (exigir pertenencia al proyecto para archivar y desarchivar, en contra del `requireWorkspaceOrProjectManager` que está documentado y cubierto por tests). Se queda como limitación conocida: por API hay salida, por la UI no.

### Hosting: Vercel (frontend) + subdominios del mismo dominio

Frontend en Vercel bajo `taskflow.oscaresteve.dev`, y backend en un servicio de contenedores con un subdominio propio, `taskflow-api.oscaresteve.dev`.

**Por qué el backend lleva dominio propio y no la URL que da la plataforma:** las cookies de sesión se emiten con `sameSite: "lax"`, que es el valor correcto para una aplicación como esta (no necesita que terceros sitios manden la cookie), pero exige que frontend y backend sean _same-site_. Dos subdominios de `oscaresteve.dev` lo son; `taskflow.vercel.app` y `taskflow-api.up.railway.app` no, porque son dominios registrables distintos, y ahí el navegador descarta la cookie y el login deja de funcionar. Poner el subdominio cuesta un `CNAME` y evita tener que relajar las cookies a `sameSite: "none"`.

El detalle de cada variable, y lo que falta resolver antes del primer despliegue, está en [`despliegue.md`](./despliegue.md).

### Gestor de paquetes: pnpm (obligatorio)

pnpm es seguro por defecto — sobre todo relevante después de los ataques recientes a la cadena de suministro de npm. Es el único gestor soportado en el proyecto.

---

## Frontend

### Framework: Next.js 16 (App Router) + React 19

Ya lo conocía y me ofrece ventajas de un framework consolidado frente a un SPA con Vite, incluyendo SSR.

### UI y estilos: Tailwind v4 + shadcn/ui

Tailwind es mi estándar habitual. shadcn/ui no es una librería de componentes cerrada como MUI o Chakra: los componentes se copian al proyecto y son completamente modificables y flexibles, y ya tengo experiencia con él.

### Estado de servidor: TanStack React Query

Primera vez que lo uso — para cachear las respuestas de la API y optimizar peticiones. No descarté ninguna alternativa, fue una elección directa para aprenderlo.

### Formularios: React Hook Form + Zod (resolvers)

Es lo que uso siempre en formularios con React, y se integra perfectamente tanto con Zod (mismo validador que en el backend) como con los componentes de shadcn.

### Drag & drop: @dnd-kit

Primera vez que lo uso, para el tablero tipo Kanban. Ahorra mucho trabajo frente a implementarlo a mano.

### Internacionalización: next-intl

Para soportar traducciones y centralizar los textos de la aplicación en un solo sitio, con integración directa con Next.js.

### Tema oscuro: next-themes

Se integra bien tanto con Next.js como con shadcn/ui.

### Estado en la URL: nuqs

Primera vez que lo uso, en vez de manejarlo a mano con los hooks de navegación de Next. Necesitaba que ciertos estados (filtros, paginación...) vivieran en la URL para que las páginas se puedan compartir con ese estado incluido, y nuqs ahorra bastante trabajo respecto a hacerlo manualmente.

Eso incluye **la pestaña activa** de cualquier vista que segmente por estado (miembros por estado, espacios/proyectos/tareas por ciclo de vida): un enlace a "los miembros eliminados" tiene que abrir ahí, así que la pestaña es un parámetro más (`?tab=`) y no `useState`.

### Gráficos: recharts

Es la librería que usa shadcn/ui para sus componentes de charts.

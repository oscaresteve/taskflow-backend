# TaskFlow — Backend

Este repositorio es el backend de **TaskFlow**, una aplicación de gestión de proyectos y tareas organizada en workspaces. Es un proyecto pensado para aprender: la idea es tener una API REST "de verdad" (con auth, roles, tests...) pero con un código lo más simple y directo posible.

El frontend vive en un repositorio aparte: [`taskflow-frontend`](https://github.com/oscaresteve/taskflow-frontend).

## Demo

**[taskflow.oscaresteve.dev](https://taskflow.oscaresteve.dev)** — `demo@taskflow.dev` / `Password123`, o directamente el botón **"Entrar como demo"** de la pantalla de login.

Para levantarlo en local, con Docker corriendo:

```bash
pnpm demo
```

Encadena los cinco pasos de la puesta en marcha: copia el `.env` si no está, instala, levanta Docker, aplica las migraciones, carga los datos de ejemplo y arranca la API. **Vacía la base de datos de desarrollo** cada vez, porque siembra siempre.

El frontend va aparte, en su repositorio: `pnpm dev` en `../taskflow-frontend`, y queda en `http://localhost:3000`.

Si vas a tocar el código, mejor los pasos de uno en uno, que es el resto de este README.

## Stack

- **Node.js** + **TypeScript**
- **Express 5** para la API REST
- **Prisma 7** como ORM, con **PostgreSQL** como base de datos (adaptador `pg`)
- **Zod** para validar lo que llega en `body`/`params`/`query`
- **JWT** (access + refresh token) para la autenticación, y **bcrypt** para las contraseñas
- **socket.io** para los eventos en tiempo real (tablero, comentarios, notificaciones)
- **S3** para los archivos subidos: **Cloudflare R2** en producción y **MinIO** en local, que habla la misma API
- **Vitest** + **Supertest** para los tests de integración
- **Docker Compose** para levantar Postgres y MinIO en local (de cada uno, una instancia para desarrollo y otra para los tests)

Gestor de paquetes: **pnpm** (es el único soportado en este proyecto, no uses `npm` ni `yarn`).

## Requisitos previos

- Node.js
- pnpm
- Docker y Docker Compose (para la base de datos y el almacenamiento)

## Puesta en marcha

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Variables de entorno

```bash
cp .env.example .env
```

`.env.example` trae las 16 variables con valores que funcionan en local tal cual: son los que esperan los contenedores de `docker-compose.yml`, así que no hay que editar nada para arrancar.

Las valida zod al arrancar (`src/config/env.ts`), de forma que si falta alguna o no cumple el formato el proceso no arranca y dice cuál. Las que tienen reglas que no se adivinan:

- `BCRYPT_SALT_ROUNDS` tiene que estar entre 10 y 15.
- `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` tienen que tener mínimo 32 caracteres, y ser distintos entre sí. En local no hace falta que sean nada especial, solo texto largo.
- `CORS_ORIGIN` es el origen del frontend (`http://localhost:3000`). Lo usan el `cors()` de Express y, por separado, el servidor de socket.io, porque el handshake de Engine.IO no pasa por los middlewares de Express. Admite un solo origen, no una lista.
- Las `S3_*` apuntan al MinIO de Docker. `S3_FORCE_PATH_STYLE` va a `true` en local porque MinIO necesita path-style; R2 y S3 usan virtual-hosted-style.

Para los valores de producción, mira [`docs/despliegue.md`](./docs/despliegue.md).

### 3. Levantar la base de datos y el almacenamiento con Docker

`docker-compose.yml` levanta cuatro servicios, por parejas de desarrollo y tests para no mezclar datos:

| Servicio        | Qué es                        | Puerto                     |
| --------------- | ----------------------------- | -------------------------- |
| `postgres`      | Postgres de desarrollo        | `5432`                     |
| `postgres-test` | Postgres de los tests         | `5433`                     |
| `minio`         | Almacenamiento de archivos    | `9000`, consola en `9001`  |
| `minio-test`    | El de los tests               | `9002`, consola en `9003`  |

```bash
pnpm db:up    # los levanta, espera a que estén listos y crea los buckets
pnpm db:down  # los para
```

`pnpm db:up` hace además una cosa que no se ve: lanza los jobs `minio-init` y `minio-test-init`, que crean el bucket y lo marcan como lectura pública. Están en su propio _profile_ de Compose precisamente para quedarse fuera del `up --wait`, porque un contenedor que termina —aunque termine bien— rompe el `--wait`.

### 4. Aplicar las migraciones

```bash
pnpm exec prisma migrate deploy
```

### 5. (Opcional) Cargar datos de prueba

```bash
pnpm db:seed
```

Esto vacía la base de datos de dev y la rellena con datos de ejemplo. No usa ninguna librería de datos falsos: la seed tiene dos mitades escritas de forma distinta, porque hacen cosas distintas.

**Acceso:** `demo@taskflow.dev` / `Password123` (misma contraseña para todos los usuarios).

**1. Nimbus Studio — escrito a mano.** Un estudio de producto digital con 8 personas y 4 proyectos. Es el workspace que se enseña, así que las tareas están escritas una a una y se leen como las de un proyecto real, con un hilo de comentarios que es una conversación de verdad. Los casos límite están puestos a conciencia y se ven leyendo el fichero: una tarea vencida y urgente, otra asignada a alguien que ya dejó el estudio, otra sin responsable, una archivada, un comentario editado y otro borrado, una invitación `PENDING`, un miembro `REMOVED` con la cuenta desactivada, un proyecto archivado y otro recién creado sin ninguna tarea.

**2. Logística Peninsular — generado por iteración.** 120 usuarios y 110 proyectos, creados en bucle a partir del índice. Solo existe para tener listados largos: su contenido da igual. Uno de sus proyectos (`madrid-norte`) tiene 120 tareas y 125 comentarios en su primera tarea. Esas cifras pasan de 100, que es el `limit` máximo que acepta la API, así que es donde se ven la paginación y el recorte del límite. El demo es ADMIN aquí, no dueño, que es lo que permite comprobar que un admin no puede tocar al OWNER.

Hay además un tercer workspace mínimo, `herrera-vidal`, dado de baja (`isActive=false`): no aparece en el listado por defecto, solo al filtrar por ese estado. Repite el slug y la key `WEB` de un proyecto de Nimbus, que es la forma de comprobar que ambos son únicos por workspace y no globalmente.

Las fechas son relativas al momento de ejecutarla, así que **cada vez que la relanzas el dataset vuelve a estar "al día"**: hay trabajo vencido, trabajo que vence esta semana y trabajo cerrado en los últimos 7 días, que es lo que miran las pantallas de resumen. Si la base se queda meses sin regenerar, esos contadores acaban a cero.

### 6. Arrancar el servidor

```bash
pnpm dev
```

Arranca en `http://localhost:4000` (el `PORT` de `.env.example`, que es el que espera el frontend por defecto) con recarga automática al guardar cambios. La API cuelga de `/api`; el socket, de `/socket.io`, fuera de `/api`.

## Scripts disponibles

| Script            | Qué hace                                                 |
| ----------------- | -------------------------------------------------------- |
| `pnpm dev`        | Arranca el servidor en modo desarrollo (con hot reload)  |
| `pnpm demo`       | Encadena la puesta en marcha entera y arranca la API (siembra siempre) |
| `pnpm test`       | Corre toda la suite de tests una vez                     |
| `pnpm test:watch` | Corre los tests en modo watch                            |
| `pnpm db:up`      | Levanta los contenedores de Postgres y MinIO (dev + test)|
| `pnpm db:down`    | Para los contenedores                                    |
| `pnpm db:seed`    | Resetea la base de dev y la rellena con datos de ejemplo |

Comandos de Prisma que se usan a menudo:

```bash
pnpm exec prisma migrate dev --name <nombre>   # crear y aplicar una migración nueva
pnpm exec prisma generate                      # regenerar el cliente de Prisma
pnpm exec prisma studio                        # abrir una UI para ver/editar la base de datos
```

## Estructura del proyecto

Cada "recurso" de la API (workspaces, proyectos, tareas...) vive en su propia carpeta dentro de `src/modules/`, y todos siguen la misma estructura interna:

```
src/modules/<nombre>/
  <nombre>.routes.ts       -> define las rutas de Express
  <nombre>.controller.ts   -> lee la request y llama al service
  <nombre>.service.ts      -> aquí vive la lógica de negocio (permisos, reglas...)
  <nombre>.repository.ts   -> el único sitio que habla con Prisma
  schemas/<nombre>.schema.ts -> validaciones con Zod
  dtos/<nombre>.dto.ts     -> forma de la respuesta que se envía al cliente
  mappers/<nombre>.mapper.ts -> convierte lo que devuelve Prisma al DTO de respuesta
```

La idea es que cada capa solo hable con la de al lado: la ruta llama al controller, el controller al service, el service al repository. Así, si mañana cambias de base de datos o de framework HTTP, solo tocas una capa.

Otras carpetas importantes:

- `src/shared/` — cosas que usan varios módulos: middlewares (`auth`, `validate`), errores personalizados, utilidades (slugs, paginación...) y la lógica de autorización compartida (comprobar si un usuario pertenece a un workspace/proyecto y qué rol tiene).
- `src/prisma/` — el `schema.prisma`, las migraciones y el script de seed.
- `tests/` — tests de integración, uno por módulo, que llaman a la API real (con Supertest) en vez de mockear cosas.

## Modelo de datos

```
Usuario -> Miembro de Workspace -> Workspace -> Proyecto -> Miembro de Proyecto
                                                          -> Tarea -> Comentario
```

Puntos clave:

- Pertenecer a un workspace y pertenecer a un proyecto son cosas independientes: ser ADMIN del workspace no te da automáticamente permisos dentro de un proyecto.
- Los roles (tanto en workspace como en proyecto) son `OWNER` > `ADMIN` > `MEMBER`. Un `ADMIN` nunca puede gestionar ni asignar el rol `OWNER`.
- Las tareas se numeran por proyecto (tarea nº 1, nº 2... de _ese_ proyecto), no de forma global.
- No hay borrado físico: los workspaces se desactivan (`isActive`), los miembros se marcan como `REMOVED`, las tareas se archivan (`isArchived`), etc.

## Endpoints principales

Todos los endpoints (salvo sign-up, sign-in, refresh y sign-out) requieren un `Authorization: Bearer <token>`.

**Auth**

```
POST   /auth/sign-up
POST   /auth/sign-in
GET    /auth/me
POST   /auth/refresh
POST   /auth/sign-out
```

**Workspaces**

```
POST   /workspaces
GET    /workspaces
GET    /workspaces/:workspaceSlug
PATCH  /workspaces/:workspaceSlug
PATCH  /workspaces/:workspaceSlug/deactivate
```

**Miembros de workspace**

```
GET    /workspaces/:workspaceSlug/members
POST   /workspaces/:workspaceSlug/members
PATCH  /workspaces/:workspaceSlug/members/:userId
PATCH  /workspaces/:workspaceSlug/members/:userId/activate
PATCH  /workspaces/:workspaceSlug/members/:userId/remove
```

**Proyectos**

```
POST   /workspaces/:workspaceSlug/projects
GET    /workspaces/:workspaceSlug/projects
GET    /workspaces/:workspaceSlug/projects/:projectSlug
PATCH  /workspaces/:workspaceSlug/projects/:projectSlug
PATCH  /workspaces/:workspaceSlug/projects/:projectSlug/archive
```

**Miembros de proyecto**

```
GET    /workspaces/:workspaceSlug/projects/:projectSlug/members
POST   /workspaces/:workspaceSlug/projects/:projectSlug/members
PATCH  /workspaces/:workspaceSlug/projects/:projectSlug/members/:userId
PATCH  /workspaces/:workspaceSlug/projects/:projectSlug/members/:userId/deactivate
```

**Tareas**

```
POST   /workspaces/:workspaceSlug/projects/:projectSlug/tasks
GET    /workspaces/:workspaceSlug/projects/:projectSlug/tasks
GET    /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber
PATCH  /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber
PATCH  /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/archive
```

**Comentarios**

```
GET    /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/comments
POST   /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/comments
PATCH  /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/comments/:commentId
PATCH  /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/comments/:commentId/delete
```

## Tests

```bash
pnpm test        # una sola vez
pnpm test:watch  # en modo watch
```

Los tests son de integración: levantan la app de Express de verdad y le hacen peticiones HTTP con Supertest, usando el contenedor de Postgres dedicado a tests (`localhost:5433`, ver `pnpm db:up`). Antes de cada test se borran todas las filas de todas las tablas, así que cada test empieza siempre con la base de datos vacía.
## Despliegue

En producción el frontend va en Vercel, el backend en un servicio con dominio propio, la base de datos en Neon y los archivos subidos en Cloudflare R2. Todo está en [`docs/despliegue.md`](./docs/despliegue.md): variables de cada entorno, por qué el backend necesita un subdominio del mismo dominio que el frontend (si no, el login no funciona), y el checklist de lo que falta resolver antes del primer despliegue.

## Documentación

- [`docs/decisiones.md`](./docs/decisiones.md) — por qué este stack y no otro, backend y frontend.
- [`docs/eventos-de-dominio.md`](./docs/eventos-de-dominio.md) — el diseño de la tabla de eventos que sostiene el historial, las notificaciones y el tiempo real.
- [`docs/despliegue.md`](./docs/despliegue.md) — poner esto en producción.

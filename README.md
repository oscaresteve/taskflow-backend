# TaskFlow — Backend

Este repositorio es el backend de **TaskFlow**, una aplicación de gestión de proyectos y tareas organizada en workspaces. Es un proyecto pensado para aprender: la idea es tener una API REST "de verdad" (con auth, roles, tests...) pero con un código lo más simple y directo posible.

## Stack

- **Node.js** + **TypeScript**
- **Express 5** para la API REST
- **Prisma 7** como ORM, con **PostgreSQL** como base de datos (adaptador `pg`)
- **Zod** para validar lo que llega en `body`/`params`/`query`
- **JWT** (access + refresh token) para la autenticación, y **bcrypt** para las contraseñas
- **Vitest** + **Supertest** para los tests de integración
- **Docker Compose** para levantar Postgres en local (uno para dev y otro para tests)

Gestor de paquetes: **pnpm** (es el único soportado en este proyecto, no uses `npm` ni `yarn`).

## Requisitos previos

- Node.js
- pnpm
- Docker y Docker Compose (para la base de datos)

## Puesta en marcha

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Variables de entorno

Copia estas variables a un archivo `.env` en la raíz del proyecto:

```env
DATABASE_URL="postgresql://taskflow:taskflow@localhost:5432/taskflow?schema=public"
PORT=3000
BCRYPT_SALT_ROUNDS=12
JWT_ACCESS_SECRET=cambia-esto-por-un-secreto-de-al-menos-32-caracteres
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=cambia-esto-tambien-por-otro-secreto-de-32-caracteres
JWT_REFRESH_EXPIRES_IN=30d
```

Un par de notas sobre estas variables (se validan al arrancar el servidor, así que si falta alguna o no cumple el formato, el proceso no arranca):

- `BCRYPT_SALT_ROUNDS` tiene que estar entre 10 y 15.
- `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` tienen que tener mínimo 32 caracteres. No hace falta que sean nada especial, solo texto largo y distinto en cada uno.

### 3. Levantar Postgres con Docker

El proyecto trae un `docker-compose.yml` con dos contenedores: uno para desarrollo (`localhost:5432`) y otro exclusivo para los tests (`localhost:5433`), para no mezclar datos.

```bash
pnpm db:up    # levanta los dos contenedores y espera a que estén listos
pnpm db:down  # los para
```

### 4. Aplicar las migraciones

```bash
pnpm dlx prisma migrate deploy
```

### 5. (Opcional) Cargar datos de prueba

```bash
pnpm db:seed
```

Esto vacía la base de datos de dev y la rellena con datos de ejemplo pensados para cubrir casos reales: 3 workspaces, 5 proyectos, 18 tareas y varios comentarios. Todos los usuarios usan la contraseña `password123`:

| Usuario               | Situación                                                          |
| --------------------- | ------------------------------------------------------------------- |
| `ada@taskflow.dev`      | Owner de Acme Inc, activa                                          |
| `alan@taskflow.dev`     | Admin de Acme Inc, activo                                          |
| `grace@taskflow.dev`    | Miembro de Acme Inc y owner de su propio workspace, Freelance Studio |
| `margaret@taskflow.dev` | Miembro activa, pero retirada de uno de los proyectos              |
| `katherine@taskflow.dev`| Aceptó la invitación al workspace pero nunca ha iniciado sesión    |
| `linus@taskflow.dev`    | Registrado pero con el email sin verificar, invitación pendiente   |
| `tim@taskflow.dev`      | Cuenta desactivada, expulsada del workspace                        |
| `dennis@taskflow.dev`   | Recién registrado, no pertenece a ningún workspace                 |

Los datos también incluyen otros casos límite habituales: un workspace desactivado (`legacy-co`), un proyecto archivado (`marketing-site`), tareas archivadas, tareas vencidas (incluida una urgente), una tarea asignada a alguien ya retirado del proyecto, y comentarios editados o borrados (soft delete). También hay dos proyectos con el mismo slug (`website-redesign`) en workspaces distintos, para comprobar que el slug solo es único dentro de cada workspace.

### 6. Arrancar el servidor

```bash
pnpm dev
```

Arranca en `http://localhost:3000` (o el puerto que hayas puesto en `PORT`) con recarga automática al guardar cambios.

## Scripts disponibles

| Script            | Qué hace                                                 |
| ----------------- | -------------------------------------------------------- |
| `pnpm dev`        | Arranca el servidor en modo desarrollo (con hot reload)  |
| `pnpm test`       | Corre toda la suite de tests una vez                     |
| `pnpm test:watch` | Corre los tests en modo watch                            |
| `pnpm db:up`      | Levanta los contenedores de Postgres (dev + test)        |
| `pnpm db:down`    | Para los contenedores                                    |
| `pnpm db:seed`    | Resetea la base de dev y la rellena con datos de ejemplo |

Comandos de Prisma que se usan a menudo:

```bash
pnpm dlx prisma migrate dev --name <nombre>    # crear y aplicar una migración nueva
pnpm dlx prisma generate                       # regenerar el cliente de Prisma
pnpm dlx prisma studio                         # abrir una UI para ver/editar la base de datos
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
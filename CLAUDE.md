# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

TaskFlow backend: an Express 5 + TypeScript REST API (project/task management, workspaces, members) backed by PostgreSQL via Prisma 7 with the `pg` driver adapter.

## Commands

This project uses **pnpm** exclusively (enforced via `devEngines` in `package.json`) — never suggest `npm`/`npx`/`yarn` commands, including for one-off package runs (`pnpm dlx` instead of `npx`). For a CLI that is already a dependency of the project, such as `prisma`, use `pnpm exec` so it runs the pinned version.

- `pnpm db:up` — start the local infrastructure via Docker Compose, waiting for it to be healthy: `postgres` (dev, `localhost:5432`), `postgres-test` (`localhost:5433`), `minio` (dev file storage, `localhost:9000`, console on `9001`) and `minio-test` (`9002`/`9003`). It then runs the `minio-init`/`minio-test-init` one-shot jobs that create the upload bucket and make it publicly readable — they sit in their own Compose profile precisely so they stay out of `up --wait`, which a container that exits (even successfully) would break. `pnpm db:down` stops everything. Required before `pnpm dev` or `pnpm test`.
- `pnpm dev` — run the server with hot reload (`tsx watch src/server.ts`). There is no `build` or `start` script (see `docs/despliegue.md` — that's a deployment blocker, not an oversight).
- `pnpm demo` (`scripts/demo.sh`) — the setup steps in one command, backend only: copies `.env` from `.env.example` if missing, `pnpm install`, `db:up`, `migrate deploy`, `db:seed`, then `pnpm dev`. **It always seeds, so it wipes the dev database**; use `pnpm db:up && pnpm dev` to start without touching the data. It deliberately knows nothing about the frontend repo.
- `pnpm test` — run the integration test suite once (`vitest run`); `pnpm test:watch` for watch mode. See Testing below.
- No lint/format script is configured.
- Prisma (schema lives at `src/prisma/schema.prisma`, migrations at `src/prisma/migrations`, config in `prisma.config.ts`):
  - **`pnpm exec prisma ...`, never `pnpm dlx prisma ...`.** `dlx` fetches the latest Prisma, which is now an entirely different CLI (8.x, the Prisma Developer Platform): `migrate` was renamed to `migration` and `generate`/`studio` are gone, so every `dlx` invocation fails. `exec` runs the 7.9 pinned in `package.json`.
  - `pnpm exec prisma migrate dev --name <name>` — create/apply a migration in dev.
  - `pnpm exec prisma generate` — regenerate the client into `src/prisma/generated/prisma`.
  - `pnpm exec prisma studio` — browse the dev DB.
  - `pnpm db:seed` (= `prisma db seed`, configured via `migrations.seed` in `prisma.config.ts`) — wipes the dev DB (same table order as `tests/setup/db.ts`) and recreates the demo dataset. Re-runnable any time (~2s), not run automatically by migrations. See Seed below.
  - The `prisma-cli` and `prisma-client-api` skills cover the rest of the CLI/query surface in detail.

### Required environment variables (`src/config/env.ts`, validated with zod at startup)

Sixteen, all of them in `.env.example` with working local values (`cp .env.example .env` and the project runs): `DATABASE_URL`, `PORT` (default 3000, but 4000 in `.env.example` because that's what the frontend defaults to), `NODE_ENV` (`development`/`test`/`production`, default `development` — `cookies.ts` derives `secure` from it), `BCRYPT_SALT_ROUNDS` (10–15), `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (min 32 chars each), `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `CORS_ORIGIN` (a single origin, no list), and seven `S3_*` (`S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `S3_FORCE_PATH_STYLE`, `S3_PUBLIC_URL_BASE`). Production values and the deployment checklist live in `docs/despliegue.md`.

## Architecture

### Module layout

Each domain lives under `src/modules/<name>/` (`auth`, `users`, `workspaces`, `workspace-members`, `projects`, `project-members`, `tasks`) with the same internal shape:

- `<name>.routes.ts` — Express `Router`; wires `auth` + `validate(...)` middleware, then the controller. Registered in `src/routes/index.ts`.
- `<name>.controller.ts` — pulls `req.validated.{body,params,query}` and `req.user`, calls the service, maps the result with the module's mapper, sends the HTTP response. Casts `req.validated.*` to the schema-inferred DTO type (noted in code as a known gap — no generic typing on `req.validated` yet).
- `<name>.service.ts` — all business logic: authorization checks, uniqueness/slug generation, orchestration. Never touches Prisma directly.
- `<name>.repository.ts` — the only layer that calls `prisma`. Takes/returns plain data, no HTTP or business concerns.
- `schemas/<name>.schema.ts` — zod schemas for body/params/query; DTO types are `z.infer<...>` of these schemas.
- `dtos/<name>.dto.ts` — outbound response shape(s).
- `mappers/<name>.mapper.ts` — converts Prisma model → response DTO (incl. paginated wrapper).
- `index.ts` — re-exports just the router.

Prisma model/enum types (`Workspace`, `Task`, `WorkspaceRole`, ...) are imported from the single shared `src/shared/types/prisma.types.ts`, which re-exports them from `src/prisma/generated/prisma`. Modules used to each have their own local `types/<name>.types.ts` re-export file; that's been centralized — don't reintroduce a per-module one, add the type/enum to the shared file instead if it's missing.

Routes → controller → service → repository is a one-way dependency chain; don't skip layers (e.g. no calling `prisma` from a controller, no HTTP concerns in a service).

### Request validation

`src/shared/middlewares/validate.ts` takes zod schemas for `body`/`params`/`query`, parses `req.body/params/query`, and stores the parsed result on `req.validated` (typed in `src/shared/types/express.d.ts`). Zod throws on failure and is caught by the global error handler, which turns a `ZodError` into a 400 with per-field messages.

### Auth & authorization

- `src/shared/middlewares/auth.ts` — reads the access token from the `accessToken` **cookie** (not an `Authorization` header), verifies it (`src/shared/security/jwt.ts`), loads the user via `auth.service.getAuthenticatedUser`, and sets `req.user`. Tokens are set as cookies by the controller (`src/shared/security/cookies.ts`) and never returned in the response body.
- `src/shared/auth/authorization.repository.ts` / `authorization.service.ts` — shared "context" loaders (`getWorkspaceContext`, `getProjectContext`, `getTaskContext`, `get*MemberTarget`) that resolve slugs/IDs to entities and enforce that the acting user is a member, throwing `NotFoundError`/`ForbiddenError` as appropriate. `getProjectContextAllowingWorkspaceManager` is the one exception: it returns `projectMember: ProjectMember | null` instead of throwing, because the actions that a workspace manager may perform without being in the project cannot let the loader reject them before the role is even looked at. `getProjectContext` is that loader plus the two throws. Almost every service calls one of these first to get `{ workspace, workspaceMember, project, projectMember, ... }`.
- `src/shared/auth/permissions.ts` — pure role-check functions (`requireWorkspaceManager`, `requireProjectManager`, `requireCanManageWorkspaceMember`, `requireCanAssignWorkspaceRole`, and project equivalents) called by services after loading context, plus the `isWorkspaceManager`/`isProjectManager` predicates they are built on. Role hierarchy: `OWNER` > `ADMIN` > `MEMBER`, and `ADMIN` can never manage/assign `OWNER`. `requireWorkspaceOrProjectManager` is the disjunction used to administer a project; when the authority comes from the workspace the project's own hierarchy does not apply, so a workspace manager can manage and demote a project `OWNER`.
- JWT auth issues an access token plus a refresh token (`sub` = user id); `POST /auth/refresh` and `POST /auth/sign-out` are wired up, with the refresh token hashed into the `RefreshToken` table (`src/shared/security/hash-token.ts`) and rotated/revoked there. `/auth/refresh` deliberately has no `auth` middleware: the refresh cookie is itself the credential.
- Note: `isActive` is currently **not** checked on sign-in or in `getAuthenticatedUser`, so a deactivated user can still authenticate. The seed includes a deactivated account, which makes this easy to reproduce.

### Errors

All custom errors extend `AppError` (`src/shared/errors/app-error.ts`, carries `statusCode`) — see `bad-request-error.ts`, `conflict-error.ts`, `forbidden-error.ts`, `not-found-error.ts`, `unauthorized-error.ts`, `sign-in-failed-error.ts`. Controllers always `try/catch` and call `next(error)`; `src/shared/middlewares/error-handler.ts` is the single place that maps errors to HTTP responses, handling `ZodError`, `AppError` subclasses, and known Prisma error codes (`P2002` → 409, `P2025` → 404) before falling back to 500. Don't format error responses in controllers/services — throw and let the handler do it.

### Data layer

- `src/config/prisma.ts` constructs the singleton `PrismaClient` using the `PrismaPg` adapter and `env.DATABASE_URL`; import `prisma` from here everywhere.
- Multi-step writes that must be atomic (e.g. creating a `Project` + its owner `ProjectMember`) use `prisma.$transaction` inside the repository function.
- Slugs are generated with `src/shared/utils/generate-unique-slug.ts` (base slug from `slugify.ts`, then a `-1`, `-2`, ... suffix loop against a repository-provided `exists` check) and are scoped per-workspace (e.g. project slug unique within a workspace, not globally).
- Pagination: repositories return `{ items, total }` (`PaginatedResult<T>`, `src/shared/types/pagination.types.ts`); mappers wrap that into `{ data, pagination: { page, limit, total, pages } }` (`src/shared/dtos/pagination.dto.ts`).

### Seed (`src/prisma/seed.ts`)

No data-faking library — the file is plain Prisma calls. It has two halves, written differently on purpose because they do different jobs:

1. **Nimbus Studio — written by hand.** 8 people, 4 projects, every task spelled out as a literal. This is the workspace the demo shows, so the text reads like a real project and the edge cases are placed deliberately and are visible by reading the file: an overdue urgent task, one assigned to someone no longer an active project member, an unassigned one, an archived one, an edited and a soft-deleted comment, a `PENDING` invite, a `REMOVED` member whose account is deactivated, an archived project and an empty one.
2. **Logística Peninsular — generated by iteration.** 120 users and 110 projects built in a loop from the index, no randomness, so it comes out identical every run. It exists only for long lists; its content does not matter. `madrid-norte` carries 120 tasks and 125 comments on its first task — both clear the API's `limit` cap of 100, which is where pagination and the clamp have material. `demo` is ADMIN there rather than OWNER, which is what exercises "an admin cannot manage the OWNER" (verified: 403 on the owner, 204 on a plain member).

A third minimal workspace, `herrera-vidal`, is deactivated (`isActive: false`) so the workspace-list filter has material, and it reuses the `WEB` slug/key of a Nimbus project to show both are unique per workspace, not globally.

`insertTasks` is the only thing the two halves share, because it enforces model rules rather than content: `rank` chained per status column, `taskNumber` sequential with `nextTaskNumber`, and `updatedAt` set to the task's real last activity (last comment, completion, or creation) — the overviews order "recent activity" by it, so leaving it at the seed-run timestamp would make that list arbitrary. A share of `completedAt` values land inside the last 7 days, or every velocity counter reads 0.

Dates are relative to `new Date()`, so a re-seed always lands "current".

### Tiempo real (`src/socket/`)

`server.ts` crea el servidor HTTP a mano y le engancha socket.io; `app.ts` no sabe nada de sockets.

- `socket/realtime.ts` — el contrato de mensajes y el publicador. Guarda un `io` seteable y **cada
  emisor es no-op sin servidor**, que es lo que permite que los repositorios sigan siendo importables
  desde los tests con supertest y desde el seed. Importa los DTO **solo como tipos**: si importara
  algo en tiempo de ejecución de `src/modules/`, el grafo cerraría sobre `activity.repository` y
  reventaría al arrancar con un TDZ en `personSelect`.
- `socket/socket.server.ts` — `createSocketServer(httpServer)`, que es lo que montan `server.ts` y
  los tests. Tiene su **propio CORS**: el `cors()` de Express no corre en el handshake de Engine.IO.
  El handshake lee la cookie `accessToken` a mano (no pasa por `cookieParser`) y las salas reusan
  `authorizationService.getProjectContext`, así que no hay autorización nueva.

La publicación sale de `activity.repository.record`, **dentro de la transacción** y envuelta en
`try/catch` para que un fallo del canal en vivo no tumbe una escritura que ya fue bien. La excepción
es `task:reordered`, que se emite desde `tasks.service.move` porque una reordenación pura no deja
evento.

**Límite conocido: el emisor es en proceso.** Con más de una instancia de Node la mitad de los
clientes no recibiría nada; haría falta el adaptador de Redis. La ruta del socket es `/socket.io`,
**fuera de `/api`**, así que cualquier proxy inverso tiene que enrutarla aparte.

### Testing

`tests/integration/<module>.test.ts` — one file per module (`auth`, `users`, `workspaces`, `workspace-members`, `projects`, `project-members`, `tasks`, `comments`, `overview`, `search`, `activity`, `notifications`, plus `socket` for the realtime channel). Tests run with Vitest + Supertest against the real Express `app` and a dedicated local Postgres container (`postgres-test` in `docker-compose.yml`, `localhost:5433`, separate from the dev container on `5432`):

- `tests/setup/test-database-url.ts` — the shared `TEST_DATABASE_URL` constant pointing at the `postgres-test` container, imported by both `vitest.config.ts` and `global-setup.ts` so it lives in one place.
- `tests/setup/global-setup.ts` — drops and recreates the `public` schema once per run via a raw `pg` client, then provisions it with `prisma migrate deploy`. Requires `pnpm db:up` to have been run first.
- `tests/setup/db.ts` — `beforeEach` hook that deletes all rows from every table so each test starts from an empty database.
- `vitest.config.ts` sets the required env vars directly (`test.env`) instead of a `.env.test` file, and disables file parallelism since every test file shares the same database.
- `tests/helpers/api.ts` — small fixture builders (`signUp`, `createWorkspace`, `addActiveMember`, `createProject`, `addActiveProjectMember`, `createTask`, ...) that go through the real HTTP endpoints rather than writing to the DB directly, except where there's no endpoint for it (e.g. `deactivateUser`).

Tests target real business rules from the service layer (permissions, state transitions, uniqueness checks) — not zod validation edge cases, which are generic and not worth asserting per module.

### Domain model (`src/prisma/schema.prisma`)

`User` → `WorkspaceMember` → `Workspace` → `Project` → `ProjectMember` / `Task` → `Comment`. Workspace and project membership each have their own role enum (`WorkspaceRole`, `ProjectRole`: `OWNER`/`ADMIN`/`MEMBER`). They are checked independently for *membership* and for task-level actions — a workspace admin is not automatically a project member and gets no say over tasks or comments. **Administering a project is the exception**: editing it, archiving it and managing its members are allowed to a manager of the project *or* a manager of the workspace that contains it (`requireWorkspaceOrProjectManager`), so the workspace owner is never locked out of a project they were not added to. Tasks are numbered per-project (`Project.nextTaskNumber`, unique `[projectId, taskNumber]`), not globally.

### Module conventions to follow

- Relative imports use explicit `.ts` extensions (enabled by `rewriteRelativeImportExtensions` in `tsconfig.json`); match existing files.
- Repository/service functions take a single destructured options object, not positional args.
- **Code comments must be written in natural Spanish** (not machine-translated-sounding), project-wide — this applies to new code and tests, not just existing files. Write comments only where the *why* isn't obvious from the code, same bar as usual; don't add a Spanish comment just to have one.
- This is a junior/learning project — favor simple, direct code over abstractions, generic helpers, or configurability that isn't needed yet. Don't introduce patterns (factories, generic builders, extra indirection layers) beyond what the existing module structure already uses. When in doubt, match the simplest existing example rather than the most flexible one.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

TaskFlow backend: an Express 5 + TypeScript REST API (project/task management, workspaces, members) backed by SQLite via Prisma 7 with the `better-sqlite3` driver adapter.

## Commands

This project uses **pnpm** exclusively (enforced via `devEngines` in `package.json`) — never suggest `npm`/`npx`/`yarn` commands, including for one-off package runs (`pnpm dlx` instead of `npx`).

- `pnpm dev` — run the server with hot reload (`tsx watch src/server.ts`). There is no `build` or `start` script.
- `pnpm test` — run the integration test suite once (`vitest run`); `pnpm test:watch` for watch mode. See Testing below.
- No lint/format script is configured.
- Prisma (schema lives at `src/prisma/schema.prisma`, migrations at `src/prisma/migrations`, config in `prisma.config.ts`):
  - `pnpm dlx prisma migrate dev --name <name>` — create/apply a migration in dev.
  - `pnpm dlx prisma generate` — regenerate the client into `src/prisma/generated/prisma`.
  - `pnpm dlx prisma studio` — browse the SQLite dev DB.
  - The `prisma-cli` and `prisma-client-api` skills cover the rest of the CLI/query surface in detail.

### Required environment variables (`src/config/env.ts`, validated with zod at startup)

`DATABASE_URL`, `PORT` (default 3000), `BCRYPT_SALT_ROUNDS` (10–15), `JWT_SECRET` (min 32 chars), `JWT_EXPIRES_IN`.

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

- `src/shared/middlewares/auth.ts` — reads the `Bearer` token, verifies it (`src/shared/security/jwt.ts`), loads the user via `auth.service.getAuthenticatedUser`, and sets `req.user`.
- `src/shared/auth/authorization.repository.ts` / `authorization.service.ts` — shared "context" loaders (`getWorkspaceContext`, `getProjectContext`, `getTaskContext`, `get*MemberTarget`) that resolve slugs/IDs to entities and enforce that the acting user is a member, throwing `NotFoundError`/`ForbiddenError` as appropriate. Almost every service calls one of these first to get `{ workspace, workspaceMember, project, projectMember, ... }`.
- `src/shared/auth/permissions.ts` — pure role-check functions (`requireWorkspaceManager`, `requireProjectManager`, `requireCanManageWorkspaceMember`, `requireCanAssignWorkspaceRole`, and project equivalents) called by services after loading context. Role hierarchy: `OWNER` > `ADMIN` > `MEMBER`, and `ADMIN` can never manage/assign `OWNER`.
- JWT auth issues only an access token today (`generateAccessToken`/`verifyAccessToken`, `sub` = user id); the `RefreshToken` model exists in the schema but no refresh-token flow is wired up yet.

### Errors

All custom errors extend `AppError` (`src/shared/errors/app-error.ts`, carries `statusCode`) — see `bad-request-error.ts`, `conflict-error.ts`, `forbidden-error.ts`, `not-found-error.ts`, `unauthorized-error.ts`, `sign-in-failed-error.ts`. Controllers always `try/catch` and call `next(error)`; `src/shared/middlewares/error-handler.ts` is the single place that maps errors to HTTP responses, handling `ZodError`, `AppError` subclasses, and known Prisma error codes (`P2002` → 409, `P2025` → 404) before falling back to 500. Don't format error responses in controllers/services — throw and let the handler do it.

### Data layer

- `src/config/prisma.ts` constructs the singleton `PrismaClient` using the `PrismaBetterSqlite3` adapter and `env.DATABASE_URL`; import `prisma` from here everywhere.
- Multi-step writes that must be atomic (e.g. creating a `Project` + its owner `ProjectMember`) use `prisma.$transaction` inside the repository function.
- Slugs are generated with `src/shared/utils/generate-unique-slug.ts` (base slug from `slugify.ts`, then a `-1`, `-2`, ... suffix loop against a repository-provided `exists` check) and are scoped per-workspace (e.g. project slug unique within a workspace, not globally).
- Pagination: repositories return `{ items, total }` (`PaginatedResult<T>`, `src/shared/types/pagination.types.ts`); mappers wrap that into `{ data, pagination: { page, limit, total, pages } }` (`src/shared/dtos/pagination.dto.ts`).

### Testing

`tests/integration/<module>.test.ts` — one file per module (`auth`, `workspaces`, `workspace-members`, `projects`, `project-members`, `tasks`; `users` has no tests since that module isn't implemented). Tests run with Vitest + Supertest against the real Express `app` and a dedicated SQLite file (`test.db`, separate from `dev.db`):

- `tests/setup/global-setup.ts` — provisions `test.db` once per run via `prisma migrate deploy` and removes it afterwards.
- `tests/setup/db.ts` — `beforeEach` hook that deletes all rows from every table so each test starts from an empty database.
- `vitest.config.ts` sets the required env vars directly (`test.env`) instead of a `.env.test` file, and disables file parallelism since every test file shares the same database.
- `tests/helpers/api.ts` — small fixture builders (`signUp`, `createWorkspace`, `addActiveMember`, `createProject`, `addActiveProjectMember`, `createTask`, ...) that go through the real HTTP endpoints rather than writing to the DB directly, except where there's no endpoint for it (e.g. `deactivateUser`).

Tests target real business rules from the service layer (permissions, state transitions, uniqueness checks) — not zod validation edge cases, which are generic and not worth asserting per module.

### Domain model (`src/prisma/schema.prisma`)

`User` → `WorkspaceMember` → `Workspace` → `Project` → `ProjectMember` / `Task` → `Comment`. Workspace and project membership each have their own role enum (`WorkspaceRole`, `ProjectRole`: `OWNER`/`ADMIN`/`MEMBER`) and are checked independently — being a workspace admin does not imply project-level permissions. Tasks are numbered per-project (`Project.nextTaskNumber`, unique `[projectId, taskNumber]`), not globally.

### Module conventions to follow

- Relative imports use explicit `.ts` extensions (enabled by `rewriteRelativeImportExtensions` in `tsconfig.json`); match existing files.
- Repository/service functions take a single destructured options object, not positional args.
- **Code comments must be written in natural Spanish** (not machine-translated-sounding), project-wide — this applies to new code and tests, not just existing files. Write comments only where the *why* isn't obvious from the code, same bar as usual; don't add a Spanish comment just to have one.
- This is a junior/learning project — favor simple, direct code over abstractions, generic helpers, or configurability that isn't needed yet. Don't introduce patterns (factories, generic builders, extra indirection layers) beyond what the existing module structure already uses. When in doubt, match the simplest existing example rather than the most flexible one.

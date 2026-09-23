# AGENTS.md — BPMS

Business Process Management System (MVP): NestJS backend + Next.js frontend. Monorepo with two independent npm packages — there is no root package.json; run all commands from `backend/` or `frontend/`.

## Layout

- `backend/` — NestJS 12 (ESM), Prisma 7 + `@prisma/adapter-better-sqlite3`, `bpmn-engine`. SQLite DB at `backend/db/bpms.db`.
- `frontend/` — Next.js 16 (App Router), React 19, Tailwind 4, shadcn/Radix + MUI, `bpmn-js`, TanStack Query, Zustand.
- `.agents/rules/*.mdc` — NestJS layout & naming conventions. **Read these before touching backend modules.**
- `compose.yml` — Docker: backend :3001, frontend :3000 (Unix-style scripts; run on Linux/macOS/Git Bash or Docker, not plain cmd).

## Commands

Backend (from `backend/`):

```bash
npm run dev            # nest start --watch (port 3001)
npm run build          # nest build
npm run lint           # oxlint src/ test/
npm run format         # prettier
npm run test           # vitest run (unit)
npm run test:e2e       # vitest --config vitest.config.e2e.ts
npm run prisma:generate   # REQUIRED after schema edits; client is generated into src/common/infrastructure/database/generated/prisma (gitignored)
npm run prisma:migrate    # dev migrations
npm run prisma:seed       # seed users: admin/admin123, john|jane|ali|bob/user123
```

Frontend (from `frontend/`):

```bash
npm run dev            # next dev -p 3000
npm run build          # standalone output
npm run lint           # eslint
```

There is no frontend typecheck gate: `next.config.ts` sets `typescript.ignoreBuildErrors: true` — run `npx tsc --noEmit` yourself before trusting TS correctness.

## Backend architecture rules (enforced conventions)

- Subpath imports only: `#common/*` and `#modules/*` (defined in `package.json` `imports`). **Always use `.js` extensions** in relative/subpath imports (ESM).
- Module layout: `src/modules/<domain>/{controllers,services,repositories,dto/request,dto/response,contracts,providers}/`. Existing domains: auth, bpmn, category, dashboard, department, file, form, health, position, process, process-instance, report, task, user.
- Config goes in `src/common/config/configs/<name>.config.ts` (registerAs + Joi schema), registered in `AppModule` and typed in `config.type.ts`.
- Persistence via repositories extending `Repository<'Model'>` from `#common/infrastructure/database/base.repository` — no raw Prisma in services.
- Naming is **domain + verb**: `userGetMany`, `userCreate`, `UserCreateDto` — never `getUsers`/`CreateUserDto`.
- List endpoints accept `page/pageSize/sortBy/sortOrder/search` and return the envelope `{ items, totalCount }` (pageSize capped at 100).
- Logging via nestjs-pino; Swagger is enabled in non-prod at `/api/docs` (describes the full domain flow — read it for orientation).

## Frontend architecture

- Path alias `@/*` → `src/*`.
- All API calls go through `src/lib/api.ts` (same-origin `/api` — Next rewrites proxy to `localhost:3001`, so CORS never comes up). The api client **unwraps** the `{items,totalCount}` envelope and auto-paginates, so list helpers resolve to plain `T[]`.
- Views live in `src/components/views/*-view.tsx`; thin route pages under `src/app/(app)/{admin,dashboard,instances,processes,tasks}`.
- UI text is **Persian (RTL)** — strings come from the `t` object in `src/lib/i18n.ts`; add new UI strings there, in Persian.
- BPMN modeling uses `bpmn-js` (frontend) ↔ `bpmn-engine` (backend); process definitions are BPMN 2.0 XML uploaded by admins, userTasks are bound by element name to users/forms.

## Gotchas

- `next.config.ts` sets `skipTrailingSlashRedirect: true` deliberately — removing it causes an infinite `/dashboard` redirect loop behind the proxy.
- `**/generated/prisma` and `*.db` are gitignored: fresh clone needs `prisma:generate` (+ `prisma:migrate` or copy `db/bpms.db`).
- Frontend `start`/`build` scripts use Unix `cp`/`tee` — they fail on Windows cmd; use Git Bash, WSL, or Docker.
- `frontend/tsconfig.json` `exclude` list intentionally ignores several dirs; don't "fix" it.
- Env config: `backend/.env` (see `.env.example`) — `DATABASE_URL=file:./db/bpms.db`, `JWT_SECRET` must be ≥32 chars (Joi-validated).

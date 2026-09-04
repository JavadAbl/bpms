# BPMS — Business Process Management System (v1)

High-level, declarative BPMN workflow system: bpmn-js designer, no-code task
assignment strategies, validated gateway conditions, dynamic forms with file
attachments, immutable process versioning, persistent engine runtime.
Persian (RTL) UI.

**Agents / contributors: start with [`AGENTS.md`](AGENTS.md)**, then:

- [`docs/architecture.md`](docs/architecture.md) — stack, topology, data model, request flows
- [`docs/domain-guide.md`](docs/domain-guide.md) — assignment strategies, conditions contract, forms/files, versioning semantics
- [`docs/api-reference.md`](docs/api-reference.md) — endpoint catalog
- [`docs/development-guide.md`](docs/development-guide.md) — running, testing, pitfalls, v1 scope & roadmap
- [`worklog.md`](worklog.md) — append-only multi-agent work history

Layout: `frontend/` (Next.js 16), `backend/` (NestJS 11 + Prisma/SQLite + bpmn-engine), `scripts/` (E2E suites).

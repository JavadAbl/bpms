# BPMS Backend (template structure)

MVP Business Process Management System backend — NestJS 12, Prisma 7 +
SQLite driver adapter, bpmn-engine, structured per the
`.agents/rules/*.mdc` layout conventions (see `MIGRATION-NOTES.md`).

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run dev

# production mode
$ npm run build
$ npm run start:prod
```

## Database

```bash
$ npm run prisma:migrate      # create/apply dev migrations
$ npm run prisma:generate     # regenerate the client after schema edits
$ npm run prisma:seed         # seed (tsx prisma/seed.ts)
$ npm run prisma:studio
```

## Run tests

```bash
$ npm run test
$ npm run test:e2e
$ npm run test:cov
```

## Lint & format

```bash
$ npm run lint
$ npm run format
```

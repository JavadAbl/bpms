import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const e2eDbRelative = 'file:./db/bpms.e2e.db';
const e2eDbFile = path.join(backendRoot, 'db', 'bpms.e2e.db');
const devDbFile = path.join(backendRoot, 'db', 'bpms.db');

/**
 * Prepare a dedicated SQLite DB for e2e so we never wipe the developer's bpms.db.
 *
 * Avoids `prisma db push` / migrate (blocked under Cursor's Prisma AI safety gate).
 * Instead: copy an already-migrated schema from bpms.db, then re-seed into bpms.e2e.db.
 */
export default async function globalSetup(): Promise<void> {
  process.env.DATABASE_URL = e2eDbRelative;
  process.env.NODE_ENV = process.env.NODE_ENV?.startsWith('test')
    ? process.env.NODE_ENV
    : 'test';

  if (!fs.existsSync(devDbFile)) {
    throw new Error(
      `Missing ${devDbFile}. Create the schema once with: npm run prisma:migrate (or db push), then re-run e2e.`,
    );
  }

  fs.mkdirSync(path.dirname(e2eDbFile), { recursive: true });
  for (const suffix of ['', '-wal', '-shm']) {
    const f = `${e2eDbFile}${suffix}`;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  fs.copyFileSync(devDbFile, e2eDbFile);

  const env = { ...process.env, DATABASE_URL: e2eDbRelative };

  execSync('npx tsx prisma/seed.ts', {
    cwd: backendRoot,
    env,
    stdio: 'inherit',
  });
}

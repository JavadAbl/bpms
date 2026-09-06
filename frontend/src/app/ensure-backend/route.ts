import { NextResponse } from 'next/server';
import net from 'net';
import { spawn } from 'child_process';

/**
 * Sandbox glue (mirror of the backend's FrontendSupervisor in bpms-backend/src/main.ts):
 * the sandbox reaps processes spawned from one-off tool shells, so the backend is
 * spawned from here — a long-lived request inside the Next.js server tree — and
 * detached into its own process group, orphaned to init.
 *
 * Idempotent: probes port 3001 first and only spawns when nothing is listening.
 * Dev-only helper; harmless in production (backend already running → no-op).
 */

const BACKEND_PORT = 3001;

async function probe(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const conn = net.createConnection(port, '127.0.0.1');
    conn.on('connect', () => {
      conn.destroy();
      resolve(true);
    });
    conn.on('error', () => {
      conn.destroy();
      resolve(false);
    });
  });
}

export const dynamic = 'force-dynamic';

export async function GET() {
  if (await probe(BACKEND_PORT)) {
    return NextResponse.json({ ok: true, alreadyRunning: true });
  }
  try {
    const child = spawn(
      'bash',
      [
        '-c',
        'exec node --enable-source-maps dist/main.js >> /home/z/my-project/.zscripts/mini-service-bpms-backend.log 2>&1',
      ],
      {
        cwd: '/home/z/my-project/mini-services/bpms-backend',
        // Pin the backend DB and port explicitly: the sandbox shell may export
        // an unrelated DATABASE_URL, and next dev sets PORT=3000 for children
        // (the backend would try to bind the frontend's port and crash).
        env: {
          ...process.env,
          DATABASE_URL:
            'file:/home/z/my-project/mini-services/bpms-backend/db/bpms.db',
          PORT: '',
          BACKEND_PORT: '',
        },
        stdio: 'ignore',
        detached: true, // own process group — survives request completion
      },
    );
    child.unref();
    return NextResponse.json({ ok: true, spawnedPid: child.pid });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    );
  }
}

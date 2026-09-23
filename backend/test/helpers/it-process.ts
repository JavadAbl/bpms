import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { authHeader, type AuthedUser } from './auth.js';

export const IT_PROCESS_NAME = 'فرآیند درخواست خدمات IT';

export const TASK = {
  submit: 'ثبت درخواست خدمات IT',
  expertReview: 'بررسی کارشناس IT',
  manager: 'تایید مدیر IT',
  expertWork: 'انجام کار کارشناس',
  requesterConfirm: 'تایید درخواست‌دهنده',
} as const;

type Envelope<T> = { items: T[]; totalCount: number };

export type TaskRow = {
  id: string;
  name: string;
  status: string;
  processInstanceId: string;
  assigneeId?: string | null;
  positionId?: string | null;
  selfService?: boolean;
  form?: { id: string } | null;
};

export type InstanceRow = {
  id: string;
  status: string;
  processId: string;
  startedById: string;
};

export async function findItProcessId(
  app: INestApplication<App>,
  user: AuthedUser,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .get('/api/processes')
    .query({ search: IT_PROCESS_NAME, pageSize: 50 })
    .set(authHeader(user))
    .expect(200);

  const items = (res.body as Envelope<{ id: string; name: string }>).items ?? [];
  const match = items.find((p) => p.name === IT_PROCESS_NAME);
  if (!match) {
    throw new Error(
      `Process «${IT_PROCESS_NAME}» not found — run seed against the e2e DATABASE_URL first`,
    );
  }
  return match.id;
}

/** Draft → submit: starts the instance and completes «ثبت درخواست». */
export async function startItRequest(
  app: INestApplication<App>,
  requester: AuthedUser,
  processId: string,
  data: Record<string, unknown> = {
    requestType: 'Hardware',
    description: 'e2e test — مانیتور روشن نمی‌شود',
  },
): Promise<InstanceRow> {
  const created = await request(app.getHttpServer())
    .post('/api/process-drafts')
    .set(authHeader(requester))
    .send({ processId })
    .expect(201);

  const draftId = (created.body as { id: string }).id;

  const submitted = await request(app.getHttpServer())
    .post(`/api/process-drafts/${draftId}/submit`)
    .set(authHeader(requester))
    .send({ data })
    .expect((r) => {
      if (r.status !== 200 && r.status !== 201) {
        throw new Error(`draft submit failed: ${r.status} ${JSON.stringify(r.body)}`);
      }
    });

  return submitted.body as InstanceRow;
}

export async function listMyTasks(
  app: INestApplication<App>,
  user: AuthedUser,
): Promise<TaskRow[]> {
  const res = await request(app.getHttpServer())
    .get('/api/tasks/mine')
    .query({ pageSize: 100 })
    .set(authHeader(user))
    .expect(200);
  return (res.body as Envelope<TaskRow>).items ?? [];
}

export async function findPendingTask(
  app: INestApplication<App>,
  user: AuthedUser,
  instanceId: string,
  taskName: string,
): Promise<TaskRow> {
  const tasks = await listMyTasks(app, user);
  const match = tasks.find(
    (t) => t.processInstanceId === instanceId && t.name === taskName && t.status === 'PENDING',
  );
  if (!match) {
    throw new Error(
        `No PENDING «${taskName}» for ${user.username} on instance ${instanceId}. ` +
        `Mine has: ${tasks.map((t) => `${t.name}(${t.status})`).join(', ') || '(empty)'}`,
    );
  }
  return match;
}

export async function claimTask(
  app: INestApplication<App>,
  user: AuthedUser,
  taskId: string,
  expectStatus?: number,
): Promise<TaskRow> {
  const res = await request(app.getHttpServer())
    .post(`/api/tasks/${taskId}/claim`)
    .set(authHeader(user))
    .expect((r) => {
      if (expectStatus != null) {
        if (r.status !== expectStatus) {
          throw new Error(
            `claim expected ${expectStatus}, got ${r.status}: ${JSON.stringify(r.body)}`,
          );
        }
        return;
      }
      if (r.status !== 200 && r.status !== 201) {
        throw new Error(`claim failed: ${r.status} ${JSON.stringify(r.body)}`);
      }
    });
  return res.body as TaskRow;
}

export async function completeTask(
  app: INestApplication<App>,
  user: AuthedUser,
  taskId: string,
  data: Record<string, unknown>,
  formId?: string | null,
): Promise<TaskRow> {
  const res = await request(app.getHttpServer())
    .post(`/api/tasks/${taskId}/complete`)
    .set(authHeader(user))
    .send({ data, ...(formId ? { formId } : {}) })
    .expect((r) => {
      if (r.status !== 200 && r.status !== 201) {
        throw new Error(`complete ${taskId} failed: ${r.status} ${JSON.stringify(r.body)}`);
      }
    });
  return res.body as TaskRow;
}

export async function claimAndComplete(
  app: INestApplication<App>,
  user: AuthedUser,
  instanceId: string,
  taskName: string,
  data: Record<string, unknown>,
): Promise<TaskRow> {
  const task = await findPendingTask(app, user, instanceId, taskName);
  if (task.selfService) {
    await claimTask(app, user, task.id);
  }
  return completeTask(app, user, task.id, data, task.form?.id);
}

export async function completeAssigned(
  app: INestApplication<App>,
  user: AuthedUser,
  instanceId: string,
  taskName: string,
  data: Record<string, unknown>,
): Promise<TaskRow> {
  const task = await findPendingTask(app, user, instanceId, taskName);
  return completeTask(app, user, task.id, data, task.form?.id);
}

export async function listCases(
  app: INestApplication<App>,
  user: AuthedUser,
): Promise<InstanceRow[]> {
  const res = await request(app.getHttpServer())
    .get('/api/process-instances/cases')
    .query({ pageSize: 100 })
    .set(authHeader(user))
    .expect(200);
  return (res.body as Envelope<InstanceRow>).items ?? [];
}

export async function getInstance(
  app: INestApplication<App>,
  user: AuthedUser,
  instanceId: string,
): Promise<InstanceRow> {
  const res = await request(app.getHttpServer())
    .get(`/api/process-instances/${instanceId}`)
    .set(authHeader(user))
    .expect(200);
  return res.body as InstanceRow;
}

export function caseIds(cases: InstanceRow[]): Set<string> {
  return new Set(cases.map((c) => c.id));
}

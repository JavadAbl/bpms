import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createE2eApp } from './helpers/app.js';
import { login, USERS, type AuthedUser } from './helpers/auth.js';
import {
  caseIds,
  claimAndComplete,
  claimTask,
  completeAssigned,
  findItProcessId,
  findPendingTask,
  getInstance,
  listCases,
  listMyTasks,
  startItRequest,
  TASK,
} from './helpers/it-process.js';

/**
 * End-to-end coverage of the seeded «فرآیند درخواست خدمات IT»:
 *   happy path, manager-reject loop, requester-reject loop, claim exclusivity.
 *
 * Uses DATABASE_URL=file:./db/bpms.e2e.db (seeded in global-setup.e2e.ts).
 */
describe('IT service request process (e2e)', () => {
  let app: INestApplication<App>;
  let processId: string;
  let john: AuthedUser;
  let jane: AuthedUser;
  let ali: AuthedUser;
  let bob: AuthedUser;

  beforeAll(async () => {
    app = await createE2eApp();
    john = await login(app, USERS.john.username, USERS.john.password);
    jane = await login(app, USERS.jane.username, USERS.jane.password);
    ali = await login(app, USERS.ali.username, USERS.ali.password);
    bob = await login(app, USERS.bob.username, USERS.bob.password);
    processId = await findItProcessId(app, john);
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('happy path: submit → expert claim/review → manager approve → work → requester approve → COMPLETED', async () => {
    const instance = await startItRequest(app, john, processId, {
      requestType: 'Software',
      description: 'e2e happy — نصب Office',
    });
    expect(instance.status).toBe('RUNNING');

    await claimAndComplete(app, jane, instance.id, TASK.expertReview, {
      expertNote: 'نرم‌افزار موجود است، تایید می‌شود',
    });

    await completeAssigned(app, bob, instance.id, TASK.manager, {
      managerDecision: 'Approve',
      managerComment: 'موافقم',
    });

    await completeAssigned(app, jane, instance.id, TASK.expertWork, {
      workNote: 'Office نصب و فعال شد',
    });

    await completeAssigned(app, john, instance.id, TASK.requesterConfirm, {
      requesterDecision: 'Approve',
      requesterComment: 'ممنون',
    });

    const done = await getInstance(app, john, instance.id);
    expect(done.status).toBe('COMPLETED');
  });

  it('manager reject: loops back to expert review, then continues to COMPLETED', async () => {
    const instance = await startItRequest(app, john, processId, {
      requestType: 'Network',
      description: 'e2e manager-reject — قطعی اینترنت',
    });

    await claimAndComplete(app, jane, instance.id, TASK.expertReview, {
      expertNote: 'نیاز به تعویض کابل',
    });

    await completeAssigned(app, bob, instance.id, TASK.manager, {
      managerDecision: 'Reject',
      managerComment: 'توضیح فنی ناکافی است',
    });

    // Back to POSITION pool — must claim again
    await claimAndComplete(app, jane, instance.id, TASK.expertReview, {
      expertNote: 'کابل Cat6 تعویض و تست شد',
    });

    await completeAssigned(app, bob, instance.id, TASK.manager, {
      managerDecision: 'Approve',
      managerComment: 'قبول',
    });

    await completeAssigned(app, jane, instance.id, TASK.expertWork, {
      workNote: 'لینک پایدار شد',
    });

    await completeAssigned(app, john, instance.id, TASK.requesterConfirm, {
      requesterDecision: 'Approve',
    });

    const done = await getInstance(app, john, instance.id);
    expect(done.status).toBe('COMPLETED');
  });

  it('requester reject: loops back to expert work for the same expert, then COMPLETED', async () => {
    const instance = await startItRequest(app, john, processId, {
      requestType: 'Access',
      description: 'e2e requester-reject — دسترسی VPN',
    });

    await claimAndComplete(app, jane, instance.id, TASK.expertReview, {
      expertNote: 'حساب ساخته می‌شود',
    });

    await completeAssigned(app, bob, instance.id, TASK.manager, {
      managerDecision: 'Approve',
    });

    await completeAssigned(app, jane, instance.id, TASK.expertWork, {
      workNote: 'VPN فعال شد (گروه اشتباه)',
    });

    await completeAssigned(app, john, instance.id, TASK.requesterConfirm, {
      requesterDecision: 'Reject',
      requesterComment: 'گروه دسترسی اشتباه است',
    });

    // Same expert (TASK_STARTER from بررسی) — no claim needed
    await completeAssigned(app, jane, instance.id, TASK.expertWork, {
      workNote: 'گروه اصلاح و دوباره فعال شد',
    });

    await completeAssigned(app, john, instance.id, TASK.requesterConfirm, {
      requesterDecision: 'Approve',
    });

    const done = await getInstance(app, john, instance.id);
    expect(done.status).toBe('COMPLETED');
  });

  it('claim exclusivity: first claimer wins; peer loses case visibility and cannot claim/complete', async () => {
    const instance = await startItRequest(app, john, processId, {
      requestType: 'Hardware',
      description: 'e2e claim — کیبورد خراب',
    });

    const janeTask = await findPendingTask(app, jane, instance.id, TASK.expertReview);
    const aliTask = await findPendingTask(app, ali, instance.id, TASK.expertReview);
    expect(janeTask.id).toBe(aliTask.id);
    expect(janeTask.selfService).toBe(true);

    const beforeJane = caseIds(await listCases(app, jane));
    const beforeAli = caseIds(await listCases(app, ali));
    expect(beforeJane.has(instance.id)).toBe(true);
    expect(beforeAli.has(instance.id)).toBe(true);

    await claimTask(app, jane, janeTask.id);

    // Peer cannot claim the same task
    await claimTask(app, ali, aliTask.id, 403);

    // Peer no longer sees the case (unclaimed position-pool filter)
    const afterAliCases = caseIds(await listCases(app, ali));
    expect(afterAliCases.has(instance.id)).toBe(false);

    // Peer also loses the task from کارتابل
    const aliMine = await listMyTasks(app, ali);
    expect(
      aliMine.some((t) => t.id === aliTask.id && t.status === 'PENDING'),
    ).toBe(false);

    // Claimer still sees case and can complete
    const afterJaneCases = caseIds(await listCases(app, jane));
    expect(afterJaneCases.has(instance.id)).toBe(true);

    await completeAssigned(app, jane, instance.id, TASK.expertReview, {
      expertNote: 'ادعا شد توسط jane',
    });

    // Finish so leftover RUNNING instances do not clutter later assertions
    await completeAssigned(app, bob, instance.id, TASK.manager, {
      managerDecision: 'Approve',
    });
    await completeAssigned(app, jane, instance.id, TASK.expertWork, {
      workNote: 'کیبورد تعویض شد',
    });
    await completeAssigned(app, john, instance.id, TASK.requesterConfirm, {
      requesterDecision: 'Approve',
    });

    const done = await getInstance(app, john, instance.id);
    expect(done.status).toBe('COMPLETED');
  });
});

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { GetManyReply } from '#common/dto/response/get-many-reply.js';
import { GetManyQueryType } from '#common/dto/request/get-many-query.js';
import { buildFindManyArgs } from '#common/utils/prisma-util.js';
import { BpmnEngineServiceContract } from '#modules/bpmn/contracts/bpmn-engine.contract.js';
import { ProcessInstanceServiceContract } from '#modules/process-instance/contracts/process-instance-service.contract.js';
import { TaskServiceContract } from '#modules/task/contracts/task-service.contract.js';
import type { ProcessInstanceDto } from '#modules/process-instance/dto/response/process-instance.dto.js';
import { ProcessDraftRepository } from '../repositories/process-draft.repository.js';
import { ProcessDraftCreateDto } from '../dto/request/process-draft-create.dto.js';
import { ProcessDraftUpdateDto } from '../dto/request/process-draft-update.dto.js';
import { ProcessDraftSubmitDto } from '../dto/request/process-draft-submit.dto.js';
import { ProcessDraftDto } from '../dto/response/process-draft.dto.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

@Injectable()
export class ProcessDraftService {
  private readonly logger = new Logger(ProcessDraftService.name);

  private readonly detailInclude = {
    process: { select: { id: true, name: true, version: true } },
    form: { select: { id: true, name: true, fields: true } },
  };

  constructor(
    private readonly processDraftRep: ProcessDraftRepository,
    private readonly bpmn: BpmnEngineServiceContract,
    private readonly processInstanceService: ProcessInstanceServiceContract,
    private readonly taskService: TaskServiceContract,
  ) {}

  async processDraftGetMany(
    user: { id: string; role?: string },
    query: GetManyQueryType<'ProcessDraft'>,
  ): Promise<GetManyReply<ProcessDraftDto>> {
    const predicate = buildFindManyArgs(query, {
      searchableFields: [],
    });
    // Non-admins only see their own drafts; default sort newest-first
    if (!predicate.orderBy) {
      predicate.orderBy = { updatedAt: 'desc' } as any;
    }
    if (user.role !== 'ADMIN') {
      predicate.where = { ...(predicate.where || {}), createdById: user.id } as any;
    }
    const { items, totalCount } = await this.processDraftRep.findMany({
      ...predicate,
      include: {
        process: { select: { id: true, name: true, version: true } },
        form: { select: { id: true, name: true } },
      },
    });
    return {
      items: items.map((d) => this.serialize(d)),
      totalCount,
    };
  }

  async processDraftGetById(
    id: string,
    user: { id: string; role?: string },
  ): Promise<ProcessDraftDto> {
    const draft = await this.processDraftRep.findUnique({
      where: { id },
      include: this.detailInclude,
    });
    if (!draft) throw new NotFoundException(`Draft ${id} not found`);
    this.assertOwner(draft.createdById, user);
    return this.serialize(draft, true);
  }

  async processDraftCreate(
    dto: ProcessDraftCreateDto,
    user: { id: string; role?: string },
  ): Promise<ProcessDraftDto> {
    const process = await this.processDraftRep.prismaClient.process.findUnique({
      where: { id: dto.processId },
      include: {
        assignments: true,
        starters: { select: { userId: true } },
      },
    });
    if (!process) throw new NotFoundException(`Process ${dto.processId} not found`);
    if (process.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Process must be ACTIVE to draft-start. Current: ${process.status}`,
      );
    }

    // Same starter ACL as processInstanceStart
    if (
      process.starters.length > 0 &&
      user.role !== 'ADMIN' &&
      !process.starters.some((s) => s.userId === user.id)
    ) {
      throw new ForbiddenException(
        'شما مجاز به شروع این فرآیند نیستید — شروع آن به کاربران مشخصی محدود شده است',
      );
    }

    const userTasks = this.bpmn.bpmnExtractUserTasks(process.bpmnXml);
    const firstTask = userTasks[0];
    const firstTaskName = firstTask?.name || '';
    const assignment = firstTaskName
      ? process.assignments.find((a) => a.taskName === firstTaskName)
      : undefined;

    const draft = await this.processDraftRep.create({
      data: {
        processId: process.id,
        createdById: user.id,
        firstTaskName: firstTaskName || '(no user task)',
        formId: assignment?.formId || null,
        formData: '{}',
      },
      include: this.detailInclude,
    });

    this.logger.log(
      `Draft ${draft.id} created for process ${process.id} (firstTask="${firstTaskName}")`,
    );
    return this.serialize(draft, true);
  }

  async processDraftUpdate(
    id: string,
    dto: ProcessDraftUpdateDto,
    user: { id: string; role?: string },
  ): Promise<ProcessDraftDto> {
    const existing = await this.processDraftRep.findAndCheckExistsBy(
      { where: { id } },
      'id',
      id,
    );
    this.assertOwner(existing.createdById, user);

    const draft = await this.processDraftRep.update({
      where: { id },
      data: { formData: JSON.stringify(dto.data || {}) },
      include: this.detailInclude,
    });
    return this.serialize(draft, true);
  }

  async processDraftSubmit(
    id: string,
    dto: ProcessDraftSubmitDto,
    user: { id: string; role?: string },
  ): Promise<ProcessInstanceDto> {
    const draft = await this.processDraftRep.findUnique({
      where: { id },
      include: { process: { select: { id: true, name: true } } },
    });
    if (!draft) throw new NotFoundException(`Draft ${id} not found`);
    this.assertOwner(draft.createdById, user);

    // Merge final payload over saved draft data
    let saved: Record<string, unknown> = {};
    try {
      saved = JSON.parse(draft.formData || '{}');
    } catch {
      saved = {};
    }
    const data = { ...saved, ...(dto.data || {}) };

    // Persist final values before starting (crash-safe snapshot)
    await this.processDraftRep.update({
      where: { id },
      data: { formData: JSON.stringify(data) },
    });

    // 1. Start the real process instance
    const instance = await this.processInstanceService.processInstanceStart(
      { processId: draft.processId },
      user,
    );

    // 2. Complete the first PENDING task with the draft form data (if any)
    try {
      const firstTask = await this.taskService.taskFindFirstPending(instance.id);
      if (firstTask) {
        await this.taskService.taskComplete(
          firstTask.id,
          { data, formId: draft.formId || undefined },
          user.id,
          user.role,
        );
      } else {
        this.logger.warn(
          `Draft ${id} submit: instance ${instance.id} has no PENDING task to complete`,
        );
      }
    } catch (err: unknown) {
      // Instance already started — leave it running; surface the complete error
      this.logger.error(
        `Draft ${id}: started instance ${instance.id} but failed to complete first task: ${(err as Error).message}`,
      );
      throw err;
    }

    // 3. Delete the draft
    await this.processDraftRep.remove({ where: { id } });

    return this.processInstanceService.processInstanceGetById(instance.id, user);
  }

  async processDraftDelete(id: string, user: { id: string; role?: string }): Promise<void> {
    const existing = await this.processDraftRep.findAndCheckExistsBy(
      { where: { id } },
      'id',
      id,
    );
    this.assertOwner(existing.createdById, user);
    await this.processDraftRep.remove({ where: { id } });
  }

  private assertOwner(createdById: string, user: { id: string; role?: string }): void {
    if (user.role !== 'ADMIN' && createdById !== user.id) {
      throw new ForbiddenException('Only the draft owner or an admin can access this draft');
    }
  }

  private serialize(draft: any, includeFields = false): ProcessDraftDto {
    let formData: Record<string, unknown> = {};
    try {
      formData = JSON.parse(draft.formData || '{}');
    } catch {
      formData = {};
    }

    let form: ProcessDraftDto['form'] = null;
    if (draft.form) {
      form = {
        id: draft.form.id,
        name: draft.form.name,
      };
      if (includeFields && draft.form.fields) {
        try {
          form.fields = JSON.parse(draft.form.fields);
        } catch {
          form.fields = [];
        }
      }
    }

    return {
      id: draft.id,
      processId: draft.processId,
      process: draft.process
        ? { id: draft.process.id, name: draft.process.name, version: draft.process.version }
        : undefined,
      createdById: draft.createdById,
      firstTaskName: draft.firstTaskName,
      formId: draft.formId,
      form,
      formData,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    };
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GetManyReply } from '#common/dto/response/get-many-reply.js';
import { GetManyQueryType } from '#common/dto/request/get-many-query.js';
import { buildFindManyArgs } from '#common/utils/prisma-util.js';
import { BpmnEngineServiceContract } from '#modules/bpmn/contracts/bpmn-engine.contract.js';
import { UserServiceContract } from '#modules/user/contracts/user-service.contract.js';
import { FormServiceContract } from '#modules/form/contracts/form-service.contract.js';
import {
  formatConditionErrors,
  validateConditionExpressions,
} from '#modules/bpmn/utils/condition-validator.js';
import type { Process, TaskAssignment } from '#common/infrastructure/database/generated/prisma/client.js';
import {
  ProcessDto,
  ProcessStarterDto,
  ProcessVersionDto,
  ProcessVersionXmlDto,
  ProcessVariableReplyDto,
} from '../dto/response/process.dto.js';
import { ProcessCreateDto } from '../dto/request/process-create.dto.js';
import { ProcessUpdateDto } from '../dto/request/process-update.dto.js';
import { ProcessAssignmentBulkDto, ProcessAssignmentDto } from '../dto/request/process-assignment-bulk.dto.js';
import { ProcessSetStartersDto } from '../dto/request/process-set-starters.dto.js';
import { ProcessVariableBulkDto } from '../dto/request/process-variable-bulk.dto.js';
import { ProcessRepository } from '../repositories/process.repository.js';
import { ProcessVersionRepository } from '../repositories/process-version.repository.js';
import { TaskAssignmentRepository } from '../repositories/task-assignment.repository.js';
import { ProcessStarterRepository } from '../repositories/process-starter.repository.js';
import { ProcessVariableRepository } from '../repositories/process-variable.repository.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

@Injectable()
export class ProcessService {
  /** Shared include: starters carry the user info the pickers need */
  private readonly startersInclude = {
    starters: {
      orderBy: { createdAt: 'asc' as const },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    },
  };

  constructor(
    private readonly processRep: ProcessRepository,
    private readonly processVersionRep: ProcessVersionRepository,
    private readonly taskAssignmentRep: TaskAssignmentRepository,
    private readonly processStarterRep: ProcessStarterRepository,
    private readonly processVariableRep: ProcessVariableRepository,
    private readonly bpmn: BpmnEngineServiceContract,
    private readonly userService: UserServiceContract,
    private readonly formService: FormServiceContract,
  ) {}

  async processGetMany(query: GetManyQueryType<'Process'>): Promise<GetManyReply<ProcessDto>> {
    const predicate = buildFindManyArgs(query, { searchableFields: ['name', 'description'] });
    predicate.orderBy = predicate.orderBy ?? { createdAt: 'desc' };
    const { items, totalCount } = await this.processRep.findMany({
      ...predicate,
      include: { assignments: true, ...this.startersInclude },
    });
    return { items: items.map((p) => this.serialize(p)), totalCount };
  }

  async processGetById(id: string, includeAssignments = true): Promise<ProcessDto> {
    const process = await this.processRep.findUnique({
      where: { id },
      include: includeAssignments
        ? { assignments: true, ...this.startersInclude }
        : this.startersInclude,
    });
    if (!process) throw new NotFoundException(`Process ${id} not found`);
    return this.serialize(process);
  }

  async processCreate(dto: ProcessCreateDto, userId: string): Promise<ProcessDto> {
    // Save-time gate: reject XML whose gateway conditions the engine would
    // mis-evaluate (invalid JS / missing language attr / missing next() call)
    const conditionErrors = validateConditionExpressions(dto.bpmnXml);
    if (conditionErrors.length) {
      throw new BadRequestException(
        `Invalid gateway condition expressions:\n${formatConditionErrors(conditionErrors)}`,
      );
    }
    // Validate the BPMN XML by extracting user tasks (lightweight validation)
    const userTasks = this.bpmn.bpmnExtractUserTasks(dto.bpmnXml);
    // Starter restriction (START event assignment): validate users exist, then
    // create the ProcessStarter rows alongside the process.
    if (dto.starterIds?.length) {
      const uniqueStarters = [...new Set(dto.starterIds)];
      const found = await this.userService.userCheckManyExist(uniqueStarters);
      if (found.length !== uniqueStarters.length) {
        throw new BadRequestException('starterIds contains unknown user ids');
      }
      const process = await this.processRep.create({
        data: {
          name: dto.name,
          description: dto.description,
          bpmnXml: dto.bpmnXml,
          status: 'DRAFT',
          createdById: userId,
          // First immutable history row (v1) — see ProcessVersion in schema
          versions: {
            create: { version: 1, bpmnXml: dto.bpmnXml, createdById: userId },
          },
          starters: {
            create: uniqueStarters.map((uid) => ({ userId: uid })),
          },
        },
        include: { assignments: true, ...this.startersInclude },
      });
      return this.serialize({ ...process, _userTasks: userTasks });
    }
    const process = await this.processRep.create({
      data: {
        name: dto.name,
        description: dto.description,
        bpmnXml: dto.bpmnXml,
        status: 'DRAFT',
        createdById: userId,
        // First immutable history row (v1) — see ProcessVersion in schema
        versions: {
          create: { version: 1, bpmnXml: dto.bpmnXml, createdById: userId },
        },
      },
      include: { assignments: true, ...this.startersInclude },
    });
    return this.serialize({ ...process, _userTasks: userTasks });
  }

  async processUpdate(id: string, dto: ProcessUpdateDto, userId: string): Promise<ProcessDto> {
    const existing = await this.processGetById(id, false);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.bpmnXml !== undefined && dto.bpmnXml !== existing.bpmnXml) {
      // Save-time gate: never persist XML with engine-breaking conditions
      const conditionErrors = validateConditionExpressions(dto.bpmnXml);
      if (conditionErrors.length) {
        throw new BadRequestException(
          `Invalid gateway condition expressions:\n${formatConditionErrors(conditionErrors)}`,
        );
      }
      // A new immutable version row is appended ONLY when the XML actually
      // changed — name/description/status edits and no-op XML saves never
      // create versions. The Process row keeps the denormalized current XML.
      const nextVersion = existing.version + 1;
      data.bpmnXml = dto.bpmnXml;
      data.version = nextVersion;
      data.versions = {
        create: {
          version: nextVersion,
          bpmnXml: dto.bpmnXml,
          createdById: userId,
          note: dto.note || null,
        },
      };
    }
    if (dto.status !== undefined) {
      // Activation gate: activating a process whose stored XML has broken
      // conditions would hang/misroute instances — block it with the same rules
      if (dto.status === 'ACTIVE') {
        const xmlToCheck = dto.bpmnXml !== undefined ? dto.bpmnXml : existing.bpmnXml;
        const conditionErrors = validateConditionExpressions(xmlToCheck);
        if (conditionErrors.length) {
          throw new BadRequestException(
            `Cannot activate: invalid gateway condition expressions:\n${formatConditionErrors(conditionErrors)}`,
          );
        }
      }
      data.status = dto.status;
    }
    const process = await this.processRep.update({
      where: { id },
      data,
      include: { assignments: true, ...this.startersInclude },
    });
    return this.serialize(process);
  }

  async processDelete(id: string): Promise<void> {
    await this.processGetById(id, false);
    await this.processRep.remove({ where: { id } });
  }

  // -------------------------------------------------------------------------
  // Version history — immutable rows appended on every real XML change.
  // Restore = append-copy: restoring an old version creates a NEW version and
  // never rewrites history. In-flight instances are unaffected (they run on
  // their ProcessInstance.bpmnXmlSnapshot); new instances get the new current.
  // -------------------------------------------------------------------------

  /** Version metadata list (no heavy XML payload), newest first. */
  async processGetVersions(id: string): Promise<ProcessVersionDto[]> {
    const proc = await this.processGetById(id, false);
    const versions = await this.processVersionRep.findMany({
      where: { processId: id },
      orderBy: { version: 'desc' },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
    return versions.items.map((v) => ({
      id: v.id,
      version: v.version,
      note: v.note ?? undefined,
      createdAt: v.createdAt,
      createdBy: v.createdBy,
      xmlSize: v.bpmnXml.length,
      isCurrent: v.version === proc.version,
    }));
  }

  /** Full XML of a specific version (for preview / diff). */
  async processGetVersionXml(id: string, version: number): Promise<ProcessVersionXmlDto> {
    const v = await this.processVersionRep.findUnique({
      where: { processId_version: { processId: id, version } },
    });
    if (!v) {
      throw new NotFoundException(`Version ${version} of process ${id} not found`);
    }
    return {
      id: v.id,
      version: v.version,
      note: v.note ?? undefined,
      createdAt: v.createdAt,
      bpmnXml: v.bpmnXml,
    };
  }

  /**
   * Restore an old version: its XML becomes the CURRENT one by appending a
   * NEW version row (current.version + 1) — history stays immutable.
   */
  async processRestoreVersion(
    id: string,
    version: number,
    userId: string,
    note?: string,
  ): Promise<ProcessDto> {
    const existing = await this.processGetById(id, false);
    const source = await this.processVersionRep.findUnique({
      where: { processId_version: { processId: id, version } },
    });
    if (!source) {
      throw new NotFoundException(`Version ${version} of process ${id} not found`);
    }
    if (source.bpmnXml === existing.bpmnXml) {
      throw new BadRequestException(
        `Version ${version} is already the current version (v${existing.version})`,
      );
    }
    const nextVersion = existing.version + 1;
    const proc = await this.processRep.processRestoreVersion({
      processId: id,
      nextVersion,
      bpmnXml: source.bpmnXml,
      createdById: userId,
      note,
      startersInclude: { assignments: true, ...this.startersInclude },
    });
    return this.serialize(proc);
  }

  /** List the user task definitions found in the BPMN XML. */
  async processGetUserTasks(id: string) {
    const process = await this.processGetById(id, false);
    return this.bpmn.bpmnExtractUserTasks(process.bpmnXml);
  }

  /** Replace ALL task assignments for a process in one shot. */
  async processSetAssignments(id: string, dto: ProcessAssignmentBulkDto): Promise<ProcessAssignmentDto[]> {
    const process = await this.processGetById(id, false);
    const knownTasks = this.bpmn.bpmnExtractUserTasks(process.bpmnXml).map((t) => t.name);
    for (const a of dto.assignments) {
      if (!knownTasks.includes(a.taskName)) {
        throw new BadRequestException(
          `Task "${a.taskName}" not found in BPMN. Available: ${knownTasks.join(', ')}`,
        );
      }
      if (a.formId) {
        const form = await this.formService.formGetById(a.formId);
        if (!form || form.processId !== id) {
          throw new BadRequestException(`Form "${a.formId}" does not belong to this process`);
        }
      }
      // Starter-based strategies resolve relative to another task's performer —
      // the reference task must exist in the BPMN and differ from the task itself
      // (a task cannot be assigned based on its own future performer).
      if (a.strategy === 'TASK_STARTER' || a.strategy === 'TASK_STARTER_MANAGER') {
        if (!a.sourceTaskName || !knownTasks.includes(a.sourceTaskName)) {
          throw new BadRequestException(
            `Assignment for "${a.taskName}" (strategy ${a.strategy}) requires sourceTaskName ` +
              `set to another userTask of this process. Available: ${knownTasks.join(', ')}`,
          );
        }
        if (a.sourceTaskName === a.taskName) {
          throw new BadRequestException(
            `Assignment for "${a.taskName}": sourceTaskName must be a DIFFERENT task — ` +
              `a task's performer is not known when the task itself is created`,
          );
        }
      }
    }
    await this.taskAssignmentRep.taskAssignmentReplaceAll(id, dto.assignments);
    const refreshed = await this.processGetById(id, true);
    return refreshed.assignments || [];
  }

  async processGetAssignments(id: string): Promise<ProcessAssignmentDto[]> {
    const process = await this.processGetById(id, true);
    return (process.assignments || []) as ProcessAssignmentDto[];
  }

  // -------------------------------------------------------------------------
  // Process starters (شروع‌کنندگان مجاز) — the START event's assignment.
  // Empty set = every user may start; non-empty = only those users + admins.
  // -------------------------------------------------------------------------

  async processGetStarters(id: string): Promise<ProcessStarterDto[]> {
    await this.processGetById(id, false);
    const starters = await this.processStarterRep.findMany({
      where: { processId: id },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    return starters.items.map((s) => ({
      id: s.id,
      userId: s.userId,
      user: s.user,
    })) as ProcessStarterDto[];
  }

  async processSetStarters(id: string, dto: ProcessSetStartersDto): Promise<ProcessStarterDto[]> {
    await this.processGetById(id, false);
    const unique = [...new Set(dto.userIds)];
    if (unique.length > 0) {
      const found = await this.userService.userCheckManyExist(unique);
      if (found.length !== unique.length) {
        throw new BadRequestException('userIds contains unknown user ids');
      }
    }
    // Replace-all, transactionally (same pattern as assignments/variables)
    await this.processStarterRep.processStarterReplaceAll(id, unique);
    return this.processGetStarters(id);
  }

  async processGetVariables(id: string): Promise<ProcessVariableReplyDto[]> {
    await this.processGetById(id, false);
    const variables = await this.processVariableRep.findMany({
      where: { processId: id },
      orderBy: { createdAt: 'asc' },
    });
    return variables.items.map((v) => ({
      id: v.id,
      name: v.name,
      label: v.label || undefined,
      type: v.type,
    }));
  }

  async processSetVariables(id: string, dto: ProcessVariableBulkDto): Promise<ProcessVariableReplyDto[]> {
    await this.processGetById(id, false);
    const names = dto.variables.map((v) => v.name);
    const unique = new Set(names);
    if (unique.size !== names.length) {
      throw new BadRequestException('Duplicate variable names in the same process');
    }
    for (const v of dto.variables) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v.name)) {
        throw new BadRequestException(
          `Invalid variable name "${v.name}". Use letters, numbers, and underscores only.`,
        );
      }
    }
    await this.processVariableRep.processVariableReplaceAll(id, dto.variables);
    return this.processGetVariables(id);
  }

  private serialize(p: Process & { assignments?: TaskAssignment[] } & Record<string, any>): ProcessDto {
    const base: ProcessDto = {
      id: p.id,
      name: p.name,
      description: p.description ?? undefined,
      bpmnXml: p.bpmnXml,
      version: p.version,
      status: p.status,
      createdById: p.createdById,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
    if (p.starters) {
      // Declarative starter restriction — empty array means unrestricted
      base.starters = p.starters.map((s: any) => ({
        userId: s.userId,
        user: s.user
          ? { id: s.user.id, name: s.user.name, email: s.user.email, role: s.user.role }
          : undefined,
      }));
    }
    if (p.assignments) {
      base.assignments = p.assignments.map((a: any) => ({
        id: a.id,
        taskName: a.taskName,
        strategy: a.strategy || 'FIXED_USER',
        sourceTaskName: a.sourceTaskName || undefined,
        assigneeId: a.assigneeId || undefined,
        positionId: a.positionId || undefined,
        selfService: a.selfService ?? false,
        formId: a.formId || undefined,
      }));
    }
    if (p._userTasks) base.userTasks = p._userTasks;
    return base;
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BpmnEngineService } from '../bpmn/bpmn.engine';
import {
  formatConditionErrors,
  validateConditionExpressions,
} from '../bpmn/condition-validator';
import {
  BulkTaskAssignmentDto,
  BulkProcessVariablesDto,
  CreateProcessDto,
  TaskAssignmentDto,
  UpdateProcessDto,
} from './dto/process.dto';

@Injectable()
export class ProcessesService {
  constructor(
    private prisma: PrismaService,
    private bpmn: BpmnEngineService,
  ) {}

  async findAll() {
    const processes = await this.prisma.process.findMany({
      include: { assignments: true },
      orderBy: { createdAt: 'desc' },
    });
    return processes.map((p) => this.serialize(p));
  }

  async findOne(id: string, includeAssignments = true) {
    const process = await this.prisma.process.findUnique({
      where: { id },
      include: includeAssignments ? { assignments: true } : undefined,
    });
    if (!process) throw new NotFoundException(`Process ${id} not found`);
    return this.serialize(process);
  }

  async create(dto: CreateProcessDto, userId: string) {
    // Save-time gate: reject XML whose gateway conditions the engine would
    // mis-evaluate (invalid JS / missing language attr / missing next() call)
    const conditionErrors = validateConditionExpressions(dto.bpmnXml);
    if (conditionErrors.length) {
      throw new BadRequestException(
        `Invalid gateway condition expressions:\n${formatConditionErrors(conditionErrors)}`,
      );
    }
    // Validate the BPMN XML by extracting user tasks (lightweight validation)
    const userTasks = this.bpmn.extractUserTasks(dto.bpmnXml);
    if (!userTasks.length) {
      // Not strictly an error (could be all automated), but for BPMS MVP it's suspicious
      // We just warn via the response, not reject.
    }
    const process = await this.prisma.process.create({
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
      include: { assignments: true },
    });
    return this.serialize({ ...process, _userTasks: userTasks });
  }

  async update(id: string, dto: UpdateProcessDto, userId: string) {
    const existing = await this.findOne(id, false);
    const data: any = {};
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
    const process = await this.prisma.process.update({
      where: { id },
      data,
      include: { assignments: true },
    });
    return this.serialize(process);
  }

  async remove(id: string) {
    await this.findOne(id, false);
    await this.prisma.process.delete({ where: { id } });
    return { id, deleted: true };
  }

  // -------------------------------------------------------------------------
  // Version history — immutable rows appended on every real XML change.
  // Restore = append-copy: restoring an old version creates a NEW version and
  // never rewrites history. In-flight instances are unaffected (they run on
  // their ProcessInstance.bpmnXmlSnapshot); new instances get the new current.
  // -------------------------------------------------------------------------

  /**
   * Version metadata list (no heavy XML payload), newest first.
   */
  async getVersions(id: string) {
    const proc = await this.findOne(id, false);
    const versions = await this.prisma.processVersion.findMany({
      where: { processId: id },
      orderBy: { version: 'desc' },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
    return versions.map((v) => ({
      id: v.id,
      version: v.version,
      note: v.note,
      createdAt: v.createdAt,
      createdBy: v.createdBy,
      xmlSize: v.bpmnXml.length,
      isCurrent: v.version === proc.version,
    }));
  }

  /**
   * Full XML of a specific version (for preview / diff).
   */
  async getVersionXml(id: string, version: number) {
    const v = await this.prisma.processVersion.findUnique({
      where: { processId_version: { processId: id, version } },
    });
    if (!v) throw new NotFoundException(`Version ${version} of process ${id} not found`);
    return {
      id: v.id,
      version: v.version,
      note: v.note,
      createdAt: v.createdAt,
      bpmnXml: v.bpmnXml,
    };
  }

  /**
   * Restore an old version: its XML becomes the CURRENT one by appending a
   * NEW version row (current.version + 1) — history stays immutable.
   */
  async restoreVersion(id: string, version: number, userId: string, note?: string) {
    const existing = await this.findOne(id, false);
    const source = await this.prisma.processVersion.findUnique({
      where: { processId_version: { processId: id, version } },
    });
    if (!source) throw new NotFoundException(`Version ${version} of process ${id} not found`);
    if (source.bpmnXml === existing.bpmnXml) {
      throw new BadRequestException(
        `Version ${version} is already the current version (v${existing.version})`,
      );
    }
    const nextVersion = existing.version + 1;
    const proc = await this.prisma.$transaction(async (tx) => {
      await tx.processVersion.create({
        data: {
          processId: id,
          version: nextVersion,
          bpmnXml: source.bpmnXml,
          createdById: userId,
          note: note || `بازگردانی نسخه ${version}`,
        },
      });
      return tx.process.update({
        where: { id },
        data: { bpmnXml: source.bpmnXml, version: nextVersion },
        include: { assignments: true },
      });
    });
    return this.serialize(proc);
  }

  /**
   * List the user task definitions found in the BPMN XML — useful for
   * admins to know which task names they can bind to users/forms.
   */
  async getUserTasks(id: string) {
    const process = await this.findOne(id, false);
    return this.bpmn.extractUserTasks(process.bpmnXml);
  }

  /**
   * Replace ALL task assignments for a process in one shot.
   */
  async setAssignments(id: string, dto: BulkTaskAssignmentDto) {
    const process = await this.findOne(id, false);
    const knownTasks = this.bpmn.extractUserTasks(process.bpmnXml).map((t) => t.name);
    for (const a of dto.assignments) {
      if (!knownTasks.includes(a.taskName)) {
        throw new BadRequestException(
          `Task "${a.taskName}" not found in BPMN. Available: ${knownTasks.join(', ')}`,
        );
      }
      if (a.formId) {
        const form = await this.prisma.form.findUnique({ where: { id: a.formId } });
        if (!form || form.processId !== id) {
          throw new BadRequestException(
            `Form "${a.formId}" does not belong to this process`,
          );
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
    // Replace all in a transaction
    await this.prisma.$transaction([
      this.prisma.taskAssignment.deleteMany({ where: { processId: id } }),
      ...dto.assignments.map((a) =>
        this.prisma.taskAssignment.create({
          data: {
            processId: id,
            taskName: a.taskName,
            strategy: a.strategy || 'FIXED_USER',
            sourceTaskName: a.sourceTaskName || null,
            assigneeId: a.assigneeId || null,
            positionId: a.positionId || null,
            selfService: a.selfService ?? false,
            formId: a.formId || null,
          },
        }),
      ),
    ]);
    const refreshed = await this.findOne(id, true);
    return refreshed.assignments || [];
  }

  async getAssignments(id: string): Promise<TaskAssignmentDto[]> {
    const process = await this.findOne(id, true);
    return (process.assignments || []) as TaskAssignmentDto[];
  }

  async getVariables(id: string) {
    await this.findOne(id, false);
    const variables = await this.prisma.processVariable.findMany({
      where: { processId: id },
      orderBy: { createdAt: 'asc' },
    });
    return variables.map((v) => ({
      id: v.id,
      name: v.name,
      label: v.label || undefined,
      type: v.type,
    }));
  }

  async setVariables(id: string, dto: BulkProcessVariablesDto) {
    await this.findOne(id, false);
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
    await this.prisma.$transaction([
      this.prisma.processVariable.deleteMany({ where: { processId: id } }),
      ...dto.variables.map((v) =>
        this.prisma.processVariable.create({
          data: {
            processId: id,
            name: v.name,
            label: v.label || null,
            type: v.type || 'text',
          },
        }),
      ),
    ]);
    return this.getVariables(id);
  }

  private serialize(p: any) {
    const base: any = {
      id: p.id,
      name: p.name,
      description: p.description,
      bpmnXml: p.bpmnXml,
      version: p.version,
      status: p.status,
      createdById: p.createdById,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
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

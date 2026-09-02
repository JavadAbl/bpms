import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BpmnEngineService } from '../bpmn/bpmn.engine';
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
      },
      include: { assignments: true },
    });
    return this.serialize({ ...process, _userTasks: userTasks });
  }

  async update(id: string, dto: UpdateProcessDto) {
    await this.findOne(id, false);
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.bpmnXml !== undefined) {
      data.bpmnXml = dto.bpmnXml;
      data.version = { increment: 1 };
    }
    if (dto.status !== undefined) data.status = dto.status;
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
    }
    // Replace all in a transaction
    await this.prisma.$transaction([
      this.prisma.taskAssignment.deleteMany({ where: { processId: id } }),
      ...dto.assignments.map((a) =>
        this.prisma.taskAssignment.create({
          data: {
            processId: id,
            taskName: a.taskName,
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

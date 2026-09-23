import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GetManyReply } from '#common/dto/response/get-many-reply.js';
import { GetManyQueryType } from '#common/dto/request/get-many-query.js';
import { buildFindManyArgs } from '#common/utils/prisma-util.js';
import type { ReportDefinition } from '#common/infrastructure/database/generated/prisma/client.js';
import {
  ReportDto,
  type CatalogVariable,
  type ReportResultColumn,
} from '../dto/response/report.dto.js';
import { ReportCreateDto } from '../dto/request/report-create.dto.js';
import { ReportUpdateDto } from '../dto/request/report-update.dto.js';
import { ReportPreviewDto } from '../dto/request/report-preview.dto.js';
import type { ReportColumnDto } from '../dto/request/report-column.dto.js';
import type { ReportFilterDto } from '../dto/request/report-filter.dto.js';
import { ReportDefinitionRepository } from '../repositories/report-definition.repository.js';
import { ProcessRepository } from '../repositories/process.repository.js';
import { ProcessInstanceRepository } from '../repositories/process-instance.repository.js';
import { ProcessVariableRepository } from '../repositories/process-variable.repository.js';
import { FormRepository } from '../repositories/form.repository.js';
import { CategoryRepository } from '../repositories/category.repository.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Fixed ProcessInstance fields every report can select as columns.
 * `type` drives client-side rendering (chip / Persian date / duration / …).
 */
export const INSTANCE_FIELDS: { key: string; label: string; type: string }[] = [
  { key: 'status', label: 'وضعیت', type: 'status' },
  { key: 'startedBy', label: 'شروع‌کننده', type: 'user' },
  { key: 'startedAt', label: 'تاریخ شروع', type: 'date' },
  { key: 'completedAt', label: 'تاریخ تکمیل', type: 'date' },
  { key: 'currentStep', label: 'گام جاری', type: 'text' },
  { key: 'durationDays', label: 'مدت اجرا (روز)', type: 'duration' },
  { key: 'taskCount', label: 'تعداد وظایف', type: 'number' },
  { key: 'completedTaskCount', label: 'وظایف تکمیل‌شده', type: 'number' },
];

const INSTANCE_FIELD_KEYS = INSTANCE_FIELDS.map((f) => f.key);

const INSTANCE_STATUSES = ['RUNNING', 'COMPLETED', 'FAILED', 'TERMINATED'];

/** select/radio/checkbox/… form-field types → report column type */
const FIELD_TYPE_MAP: Record<string, string> = {
  text: 'text',
  textarea: 'text',
  number: 'number',
  date: 'date',
  select: 'select',
  radio: 'select',
  checkbox: 'checkbox',
  file: 'file',
};

@Injectable()
export class ReportService {
  constructor(
    private readonly reportRep: ReportDefinitionRepository,
    private readonly processRep: ProcessRepository,
    private readonly processInstanceRep: ProcessInstanceRepository,
    private readonly processVariableRep: ProcessVariableRepository,
    private readonly formRep: FormRepository,
    private readonly categoryRep: CategoryRepository,
  ) {}

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  async reportGetMany(query: GetManyQueryType<'ReportDefinition'>): Promise<GetManyReply<ReportDto>> {
    const predicate = buildFindManyArgs(query, { searchableFields: ['name', 'description'] });
    predicate.orderBy = predicate.orderBy ?? { createdAt: 'desc' };
    const { items, totalCount } = await this.reportRep.findMany({
      ...predicate,
      include: {
        process: { select: { id: true, name: true, status: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    return { items: items.map((r) => this.serialize(r)), totalCount };
  }

  async reportGetById(id: string): Promise<ReportDto> {
    const report = await this.reportRep.findUnique({
      where: { id },
      include: {
        process: { select: { id: true, name: true, status: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (!report) throw new NotFoundException(`Report ${id} not found`);
    return this.serialize(report);
  }

  async reportCreate(dto: ReportCreateDto, userId: string): Promise<ReportDto> {
    const process = await this.processRep.findUnique({
      where: { id: dto.processId },
      select: { id: true },
    });
    if (!process) throw new NotFoundException(`Process ${dto.processId} not found`);

    const columns = this.parseColumns(dto.columns);
    const filters = this.parseFilters(dto.filters);
    await this.validateColumns(dto.processId, columns);
    this.validateFilters(filters);

    const report = await this.reportRep.create({
      data: {
        name: dto.name,
        description: dto.description || null,
        processId: dto.processId,
        columns: JSON.stringify(columns),
        filters: JSON.stringify(filters),
        createdById: userId,
      },
      include: {
        process: { select: { id: true, name: true, status: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    return this.serialize(report);
  }

  async reportUpdate(id: string, dto: ReportUpdateDto): Promise<ReportDto> {
    const existing = await this.reportRep.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Report ${id} not found`);

    const processId = dto.processId ?? existing.processId;
    const columns =
      dto.columns !== undefined ? this.parseColumns(dto.columns) : this.parseJsonArray(existing.columns);
    const filters =
      dto.filters !== undefined ? this.parseFilters(dto.filters) : this.parseJsonArray(existing.filters);

    if (dto.processId !== undefined && dto.processId !== existing.processId) {
      const process = await this.processRep.findUnique({
        where: { id: dto.processId },
        select: { id: true },
      });
      if (!process) throw new NotFoundException(`Process ${dto.processId} not found`);
    }
    await this.validateColumns(processId, columns);
    this.validateFilters(filters);

    const report = await this.reportRep.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name : undefined,
        description: dto.description !== undefined ? dto.description || null : undefined,
        processId: dto.processId !== undefined ? dto.processId : undefined,
        columns: JSON.stringify(columns),
        filters: JSON.stringify(filters),
      },
      include: {
        process: { select: { id: true, name: true, status: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    return this.serialize(report);
  }

  async reportDelete(id: string): Promise<void> {
    const existing = await this.reportRep.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException(`Report ${id} not found`);
    await this.reportRep.remove({ where: { id } });
  }

  // -------------------------------------------------------------------------
  // Field catalog — what the builder offers for a process
  // -------------------------------------------------------------------------

  async reportGetFieldCatalog(processId: string) {
    await this.assertProcess(processId);
    const variables = await this.loadVariableCatalog(processId);
    return {
      instanceFields: INSTANCE_FIELDS,
      variables: Array.from(variables.values()),
    };
  }

  // -------------------------------------------------------------------------
  // Execution — saved report and unsaved preview share one code path
  // -------------------------------------------------------------------------

  async reportExecute(id: string) {
    const report = await this.reportRep.findUnique({
      where: { id },
      include: { process: { select: { id: true, name: true } } },
    });
    if (!report) throw new NotFoundException(`Report ${id} not found`);

    const columns = this.parseJsonArray(report.columns) as ReportColumnDto[];
    const filters = this.parseJsonArray(report.filters) as ReportFilterDto[];
    const result = await this.runReport(report.processId, columns, filters);
    return {
      report: {
        id: report.id,
        name: report.name,
        description: report.description ?? undefined,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      },
      process: { id: report.processId, name: report.process.name },
      ...result,
    };
  }

  /** Runs an unsaved config (the builder's «پیش‌نمایش»). */
  async reportPreview(dto: ReportPreviewDto) {
    await this.assertProcess(dto.processId);
    const columns = this.parseColumns(dto.columns);
    const filters = this.parseFilters(dto.filters);
    await this.validateColumns(dto.processId, columns);
    this.validateFilters(filters);
    const process = await this.processRep.findUnique({
      where: { id: dto.processId },
      select: { id: true, name: true },
    });
    const result = await this.runReport(dto.processId, columns, filters);
    return {
      report: null,
      process: { id: process!.id, name: process!.name },
      ...result,
    };
  }

  /**
   * Shared execution: loads the instances of the process, merges each
   * instance's variables (same semantics as TaskService's prefill chain),
   * evaluates the configured filters and produces typed columns + rows.
   */
  private async runReport(processId: string, columns: ReportColumnDto[], filters: ReportFilterDto[]) {
    const catalog = await this.loadVariableCatalog(processId);

    const instances = await this.processInstanceRep.findMany({
      where: { processId },
      include: {
        startedBy: { select: { id: true, name: true } },
        tasks: {
          select: {
            name: true,
            status: true,
            createdAt: true,
            completedAt: true,
            form: { select: { fields: true } },
            submissions: {
              select: { data: true, submittedAt: true },
              orderBy: { submittedAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    // Resolve column meta (labels/types/options) up-front for the client
    const resultColumns: ReportResultColumn[] = columns.map((col) => {
      if (col.source === 'INSTANCE') {
        const field = INSTANCE_FIELDS.find((f) => f.key === col.fieldKey);
        return {
          key: col.key,
          source: col.source,
          fieldKey: col.fieldKey,
          label: col.label || field?.label || col.fieldKey,
          type: field?.type || 'text',
        };
      }
      const v = catalog.get(col.fieldKey);
      return {
        key: col.key,
        source: col.source,
        fieldKey: col.fieldKey,
        label: col.label || v?.label || col.fieldKey,
        type: v?.type || 'text',
        ...(v?.options ? { options: v.options } : {}),
      };
    });

    const rows: Record<string, unknown>[] = [];
    for (const inst of instances.items) {
      const vars = this.mergeInstanceVariables(inst.tasks as any[]);
      if (!this.matchFilters(filters, inst, vars)) continue;
      const values: Record<string, unknown> = {};
      for (const col of columns) {
        if (col.source === 'INSTANCE') {
          values[col.key] = this.computeInstanceField(col.fieldKey, inst);
        } else {
          const raw = vars[col.fieldKey];
          values[col.key] = raw === undefined ? null : raw;
        }
      }
      rows.push({
        id: inst.id,
        status: inst.status,
        startedAt: inst.startedAt,
        completedAt: inst.completedAt,
        values,
      });
    }

    const byStatus: Record<string, number> = { RUNNING: 0, COMPLETED: 0, FAILED: 0, TERMINATED: 0 };
    for (const row of rows) byStatus[String(row.status)] = (byStatus[String(row.status)] || 0) + 1;

    return {
      columns: resultColumns,
      rows,
      total: rows.length,
      byStatus,
      generatedAt: new Date(),
    };
  }

  // -------------------------------------------------------------------------
  // Instance variable merge — mirrors TaskService instance variables
  // (prefill-chain semantics) so report values always match what the runtime
  // forms see. Kept private/local: task forms and reports must agree.
  // -------------------------------------------------------------------------

  private mergeInstanceVariables(tasks: any[]): Record<string, unknown> {
    const vars: Record<string, unknown> = {};
    for (const t of tasks || []) {
      let fields: any[] = [];
      if (t.form?.fields) {
        try {
          fields = typeof t.form.fields === 'string' ? JSON.parse(t.form.fields) : t.form.fields;
        } catch {
          fields = [];
        }
      }
      const keyToVar = new Map<string, string>();
      for (const f of fields || []) {
        if (f?.name) keyToVar.set(f.name, f.variable || f.name);
      }
      for (const sub of t.submissions || []) {
        let data: Record<string, unknown>;
        try {
          data = typeof sub.data === 'string' ? JSON.parse(sub.data) : sub.data;
        } catch {
          continue;
        }
        for (const [key, value] of Object.entries(data || {})) {
          const varName = keyToVar.get(key) || key;
          if (value === undefined) continue;
          vars[varName] = value;
          if (varName !== key) vars[key] = value;
        }
      }
    }
    return vars;
  }

  private computeInstanceField(fieldKey: string, inst: any): unknown {
    switch (fieldKey) {
      case 'status':
        return inst.status;
      case 'startedBy':
        return inst.startedBy?.name ?? null;
      case 'startedAt':
        return inst.startedAt;
      case 'completedAt':
        return inst.completedAt ?? null;
      case 'currentStep': {
        const pending = (inst.tasks || []).filter((tk: any) => tk.status === 'PENDING').map((tk: any) => tk.name);
        return pending.length ? pending.join('، ') : null;
      }
      case 'durationDays': {
        const end = inst.completedAt ? new Date(inst.completedAt) : new Date();
        const ms = end.getTime() - new Date(inst.startedAt).getTime();
        return Math.max(0, Math.round(ms / 86400000));
      }
      case 'taskCount':
        return (inst.tasks || []).length;
      case 'completedTaskCount':
        return (inst.tasks || []).filter((tk: any) => tk.status === 'COMPLETED').length;
      default:
        return null;
    }
  }

  // -------------------------------------------------------------------------
  // Filters
  // -------------------------------------------------------------------------

  private matchFilters(filters: ReportFilterDto[], inst: any, vars: Record<string, unknown>): boolean {
    for (const f of filters) {
      if (f.type === 'STATUS') {
        const allowed = (f.statuses || []).filter(Boolean);
        if (allowed.length && !allowed.includes(inst.status)) return false;
      } else if (f.type === 'DATE_RANGE') {
        const startedAt = new Date(inst.startedAt);
        if (f.from) {
          const from = new Date(f.from);
          if (!isNaN(from.getTime()) && startedAt < from) return false;
        }
        if (f.to) {
          // pure "YYYY-MM-DD" bounds are inclusive of the whole day
          const to = /^\d{4}-\d{2}-\d{2}$/.test(f.to.trim())
            ? new Date(f.to + 'T23:59:59.999')
            : new Date(f.to);
          if (!isNaN(to.getTime()) && startedAt > to) return false;
        }
      } else if (f.type === 'VARIABLE') {
        if (!f.name || !f.op) continue;
        const raw = vars[f.name];
        const actual =
          raw === null || raw === undefined
            ? ''
            : typeof raw === 'object'
              ? JSON.stringify(raw)
              : String(raw);
        const expected = f.value ?? '';
        if (f.op === 'eq' && actual !== expected) return false;
        if (f.op === 'neq' && actual === expected) return false;
        if (f.op === 'contains' && !actual.includes(expected)) return false;
      }
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // Catalog / validation helpers
  // -------------------------------------------------------------------------

  private async assertProcess(processId: string): Promise<void> {
    const process = await this.processRep.findUnique({
      where: { id: processId },
      select: { id: true },
    });
    if (!process) throw new NotFoundException(`Process ${processId} not found`);
  }

  /**
   * Variable catalog for a process: declared ProcessVariables (authoritative
   * labels) ∪ variables discovered from form fields, enriched with select
   * options resolved from categories (Persian labels) or inline options.
   */
  private async loadVariableCatalog(processId: string): Promise<Map<string, CatalogVariable>> {
    const declared = await this.processVariableRep.findMany({
      where: { processId },
      orderBy: { createdAt: 'asc' },
    });
    const forms = await this.formRep.findMany({
      where: { processId },
      orderBy: { createdAt: 'asc' },
    });

    // Parse form fields + collect category ids referenced by select fields
    const formFields: { formName: string; field: any }[] = [];
    const categoryIds = new Set<string>();
    for (const form of forms.items) {
      let fields: any[] = [];
      try {
        fields = typeof form.fields === 'string' ? JSON.parse(form.fields) : form.fields;
      } catch {
        fields = [];
      }
      for (const field of fields || []) {
        if (!field?.name) continue;
        formFields.push({ formName: form.name, field });
        if (field.categoryId) categoryIds.add(field.categoryId);
      }
    }

    // Category items → value/label option lists (same resolution as runtime)
    const optionCache = new Map<string, { value: string; label: string }[]>();
    if (categoryIds.size) {
      const categories = await this.categoryRep.findMany({
        where: { id: { in: Array.from(categoryIds) } },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
      for (const cat of categories.items) {
        optionCache.set(
          cat.id,
          cat.items.map((i) => ({ value: i.value, label: i.label })),
        );
      }
    }

    const resolveOptions = (field: any): { value: string; label: string }[] | undefined => {
      if (field.type !== 'select' && field.type !== 'radio') return undefined;
      if (field.categoryId && optionCache.has(field.categoryId)) {
        return optionCache.get(field.categoryId);
      }
      if (Array.isArray(field.options) && field.options.length) {
        return field.options.map((o: any) => ({ value: String(o), label: String(o) }));
      }
      return undefined;
    };

    const catalog = new Map<string, CatalogVariable>();
    // 1) Declared process variables — authoritative labels, declaration order
    for (const v of declared.items) {
      catalog.set(v.name, {
        name: v.name,
        label: v.label || v.name,
        type: FIELD_TYPE_MAP[v.type] || v.type || 'text',
      });
    }
    // 2) Form-field variables — fill gaps and enrich types/options
    for (const { field } of formFields) {
      const name = field.variable || field.name;
      const type = FIELD_TYPE_MAP[field.type] || 'text';
      const options = resolveOptions(field);
      const existing = catalog.get(name);
      if (!existing) {
        catalog.set(name, { name, label: field.label || name, type, options });
      } else {
        // declared label wins; enrich missing type info/options
        if (existing.label === existing.name && field.label) existing.label = field.label;
        if (options && !existing.options) existing.options = options;
        if (existing.type === 'text' && type !== 'text') existing.type = type;
      }
    }
    return catalog;
  }

  private parseColumns(raw: ReportColumnDto[] | undefined): ReportColumnDto[] {
    const columns = Array.isArray(raw) ? raw : [];
    if (!columns.length) {
      throw new BadRequestException('گزارش باید حداقل یک ستون داشته باشد');
    }
    const keys = new Set<string>();
    for (const col of columns) {
      if (keys.has(col.key)) {
        throw new BadRequestException(`کلید ستون تکراری است: ${col.key}`);
      }
      keys.add(col.key);
    }
    return columns;
  }

  private parseFilters(raw: ReportFilterDto[] | undefined): ReportFilterDto[] {
    return Array.isArray(raw) ? raw : [];
  }

  private async validateColumns(processId: string, columns: ReportColumnDto[]): Promise<void> {
    void processId;
    for (const col of columns) {
      if (col.source === 'INSTANCE' && !INSTANCE_FIELD_KEYS.includes(col.fieldKey)) {
        throw new BadRequestException(
          `فیلد نمونه نامعتبر است: "${col.fieldKey}". موارد مجاز: ${INSTANCE_FIELD_KEYS.join('، ')}`,
        );
      }
      if (col.source === 'VARIABLE' && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col.fieldKey)) {
        throw new BadRequestException(`نام متغیر نامعتبر است: ${col.fieldKey}`);
      }
    }
  }

  private validateFilters(filters: ReportFilterDto[]): void {
    for (const f of filters) {
      if (f.type === 'STATUS') {
        for (const s of f.statuses || []) {
          if (!INSTANCE_STATUSES.includes(s)) {
            throw new BadRequestException(`وضعیت نامعتبر در فیلتر: ${s}`);
          }
        }
      } else if (f.type === 'VARIABLE') {
        if (!f.name) {
          throw new BadRequestException('فیلتر متغیر نیاز به نام متغیر دارد');
        }
        if (!f.op) {
          throw new BadRequestException(`فیلتر متغیر «${f.name}» نیاز به عملگر دارد`);
        }
      } else if (f.type === 'DATE_RANGE') {
        if (f.from && isNaN(new Date(f.from).getTime())) {
          throw new BadRequestException(`تاریخ «از» نامعتبر است: ${f.from}`);
        }
        if (f.to && isNaN(new Date(f.to).getTime())) {
          throw new BadRequestException(`تاریخ «تا» نامعتبر است: ${f.to}`);
        }
        if (
          f.from &&
          f.to &&
          !isNaN(new Date(f.from).getTime()) &&
          !isNaN(new Date(f.to).getTime()) &&
          new Date(f.from) > new Date(f.to)
        ) {
          throw new BadRequestException('بازه تاریخ معتبر نیست — «از» بعد از «تا» است');
        }
      }
    }
  }

  private parseJsonArray(value: string): any[] {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private serialize(r: ReportDefinition & Record<string, any>): ReportDto {
    return {
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      processId: r.processId,
      process: r.process
        ? { id: r.process.id, name: r.process.name, status: r.process.status }
        : undefined,
      columns: this.parseJsonArray(r.columns),
      filters: this.parseJsonArray(r.filters),
      columnCount: this.parseJsonArray(r.columns).length,
      filterCount: this.parseJsonArray(r.filters).length,
      createdBy: r.createdBy
        ? { id: r.createdBy.id, name: r.createdBy.name, email: r.createdBy.email }
        : undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}

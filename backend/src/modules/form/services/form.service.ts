import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GetManyReply } from '#common/dto/response/get-many-reply.js';
import { GetManyQueryType } from '#common/dto/request/get-many-query.js';
import { buildFindManyArgs } from '#common/utils/prisma-util.js';
import type { Form } from '#common/infrastructure/database/generated/prisma/client.js';
import { FormDto } from '../dto/response/form.dto.js';
import { FormCreateDto } from '../dto/request/form-create.dto.js';
import { FormUpdateDto } from '../dto/request/form-update.dto.js';
import { FormRepository } from '../repositories/form.repository.js';
import { ProcessRepository } from '../repositories/process.repository.js';

@Injectable()
export class FormService {
  constructor(
    private readonly formRep: FormRepository,
    private readonly processRep: ProcessRepository,
  ) {}

  /** List forms for a process. processId is required — forms are never global. */
  async formGetMany(query: GetManyQueryType<'Form'> & { processId: string }): Promise<GetManyReply<FormDto>> {
    if (!query.processId) {
      throw new BadRequestException('processId query parameter is required');
    }
    const predicate = buildFindManyArgs(query as GetManyQueryType<'Form'>, {
      searchableFields: ['name'],
    });
    predicate.orderBy = predicate.orderBy ?? { createdAt: 'desc' };
    predicate.where = { ...predicate.where, processId: query.processId } as typeof predicate.where;
    const { items, totalCount } = await this.formRep.findMany(predicate);
    return { items: items.map((form) => this.serialize(form)), totalCount };
  }

  async formGetById(id: string): Promise<FormDto> {
    const form = await this.formRep.findAndCheckExistsBy({ where: { id } }, 'id', id);
    return this.serialize(form);
  }

  async formCreate(payload: FormCreateDto): Promise<string> {
    await this.assertProcessExists(payload.processId);
    const form = await this.formRep.create({
      data: {
        name: payload.name,
        description: payload.description,
        processId: payload.processId,
        fields: JSON.stringify(payload.fields),
      },
    });
    return form.id;
  }

  async formUpdate(id: string, payload: FormUpdateDto): Promise<void> {
    const existing = await this.formRep.findAndCheckExistsBy({ where: { id } }, 'id', id);
    if (payload.processId && payload.processId !== existing.processId) {
      throw new BadRequestException('Cannot move a form to a different process');
    }
    await this.formRep.update({
      where: { id },
      data: {
        name: payload.name,
        description: payload.description,
        ...(payload.fields !== undefined ? { fields: JSON.stringify(payload.fields) } : {}),
      },
    });
  }

  async formDelete(id: string): Promise<void> {
    await this.formGetById(id);
    await this.formRep.remove({ where: { id } });
  }

  private async assertProcessExists(processId: string): Promise<void> {
    const process = await this.processRep.findUnique({ where: { id: processId } });
    if (!process) throw new BadRequestException(`Process ${processId} not found`);
  }

  private serialize(form: Form): FormDto {
    return {
      id: form.id,
      name: form.name,
      description: form.description ?? undefined,
      processId: form.processId ?? '',
      fields: typeof form.fields === 'string' ? (JSON.parse(form.fields) as FormDto['fields']) : [],
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
    };
  }
}

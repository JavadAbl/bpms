import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFormDto, UpdateFormDto } from './dto/form.dto';

@Injectable()
export class FormsService {
  constructor(private prisma: PrismaService) {}

  /** List forms for a process. processId is required — forms are never global. */
  async findAll(processId: string) {
    if (!processId) {
      throw new BadRequestException('processId query parameter is required');
    }
    const forms = await this.prisma.form.findMany({
      where: { processId },
      orderBy: { createdAt: 'desc' },
    });
    return forms.map(this.serialize);
  }

  async findOne(id: string) {
    const form = await this.prisma.form.findUnique({ where: { id } });
    if (!form) throw new NotFoundException(`Form ${id} not found`);
    return this.serialize(form);
  }

  async create(dto: CreateFormDto) {
    await this.assertProcessExists(dto.processId);
    const form = await this.prisma.form.create({
      data: {
        name: dto.name,
        description: dto.description,
        processId: dto.processId,
        fields: JSON.stringify(dto.fields),
      },
    });
    return this.serialize(form);
  }

  async update(id: string, dto: UpdateFormDto) {
    const existing = await this.prisma.form.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Form ${id} not found`);
    if (dto.processId && dto.processId !== existing.processId) {
      throw new BadRequestException('Cannot move a form to a different process');
    }
    const form = await this.prisma.form.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        fields: JSON.stringify(dto.fields),
      },
    });
    return this.serialize(form);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.form.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async assertProcessExists(processId: string) {
    const process = await this.prisma.process.findUnique({ where: { id: processId } });
    if (!process) throw new BadRequestException(`Process ${processId} not found`);
  }

  private serialize(form: any) {
    return {
      id: form.id,
      name: form.name,
      description: form.description,
      processId: form.processId,
      fields: typeof form.fields === 'string' ? JSON.parse(form.fields) : form.fields,
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
    };
  }
}

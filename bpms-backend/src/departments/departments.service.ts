import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.department.findMany({
      include: {
        positions: {
          include: {
            userPositions: { include: { user: { select: { id: true, email: true, name: true } } } },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: {
        positions: {
          include: {
            userPositions: { include: { user: { select: { id: true, email: true, name: true } } } },
          },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!dept) throw new NotFoundException(`Department ${id} not found`);
    return dept;
  }

  async create(dto: CreateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Department name already exists');

    return this.prisma.department.create({
      data: { name: dto.name, description: dto.description },
      include: { positions: true },
    });
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.findOne(id);
    if (dto.name) {
      const existing = await this.prisma.department.findUnique({ where: { name: dto.name } });
      if (existing && existing.id !== id) throw new ConflictException('Department name already in use');
    }
    return this.prisma.department.update({
      where: { id },
      data: { name: dto.name, description: dto.description },
      include: { positions: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.department.delete({ where: { id } });
    return { id, deleted: true };
  }
}

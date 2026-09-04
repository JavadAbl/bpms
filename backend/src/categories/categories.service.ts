import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  /** Item ordering applied everywhere. */
  private static readonly ITEM_ORDER: Prisma.CategoryItemOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { createdAt: 'asc' },
  ];

  /**
   * List all categories with their items, plus a `usage` summary describing
   * how many forms reference the category from a select field (fields JSON
   * scan). Read by form fillers too — needed to render category-backed
   * dropdowns at runtime.
   */
  async findAll() {
    const [categories, forms] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        include: { items: { orderBy: CategoriesService.ITEM_ORDER } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.form.findMany({ select: { id: true, name: true, fields: true } }),
    ]);

    const usage = this.scanUsage(categories.map((c) => c.id), forms);

    return categories.map((category) => ({
      ...category,
      usage: usage.get(category.id) ?? { formCount: 0, formNames: [] as string[] },
    }));
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { items: { orderBy: CategoriesService.ITEM_ORDER } },
    });
    if (!category) throw new NotFoundException(`Category ${id} not found`);
    return category;
  }

  async create(dto: CreateCategoryDto) {
    await this.assertKeyAvailable(dto.key);
    this.assertUniqueItemValues(dto.items);

    return this.prisma.category.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        items: {
          create: this.withSortOrder(dto.items),
        },
      },
      include: { items: { orderBy: CategoriesService.ITEM_ORDER } },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Category ${id} not found`);

    if (dto.key && dto.key !== existing.key) {
      await this.assertKeyAvailable(dto.key);
    }
    if (dto.items) {
      this.assertUniqueItemValues(dto.items);
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        // Nested write runs in an implicit transaction — replace list atomically
        ...(dto.items ? { items: { deleteMany: {}, create: this.withSortOrder(dto.items) } } : {}),
      },
      include: { items: { orderBy: CategoriesService.ITEM_ORDER } },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Category ${id} not found`);
    // Items cascade-delete (FK onDelete: Cascade); forms keep their field JSON
    // and simply fall back to inline options — no hard block on delete.
    await this.prisma.category.delete({ where: { id } });
    return { id, deleted: true };
  }

  // -------------------------------------------------------------------------

  private async assertKeyAvailable(key: string) {
    const existing = await this.prisma.category.findUnique({ where: { key } });
    if (existing) throw new ConflictException(`Category key "${key}" is already in use`);
  }

  private assertUniqueItemValues(items?: { value: string }[]) {
    if (!items) return;
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.value)) {
        throw new ConflictException(`Duplicate item value "${item.value}" in items list`);
      }
      seen.add(item.value);
    }
  }

  private withSortOrder(items?: { value: string; label: string }[]) {
    return (items ?? []).map((item, index) => ({
      value: item.value,
      label: item.label,
      sortOrder: index,
    }));
  }

  /**
   * Scan form field JSON for select fields referencing a category, producing
   * categoryId -> { formCount, formNames }.
   */
  private scanUsage(
    categoryIds: string[],
    forms: { id: string; name: string; fields: string }[],
  ) {
    const idSet = new Set(categoryIds);
    const perCategory = new Map<string, { formCount: number; formNames: string[] }>();

    for (const form of forms) {
      let fields: any[] = [];
      try {
        const parsed = JSON.parse(form.fields);
        if (Array.isArray(parsed)) fields = parsed;
      } catch {
        continue; // malformed form JSON — skip
      }
      const hitCategories = new Set<string>();
      for (const field of fields) {
        const ref = field?.categoryId;
        if (field?.type === 'select' && typeof ref === 'string' && idSet.has(ref)) {
          hitCategories.add(ref);
        }
      }
      for (const catId of hitCategories) {
        const entry = perCategory.get(catId) ?? { formCount: 0, formNames: [] };
        entry.formCount += 1;
        entry.formNames.push(form.name);
        perCategory.set(catId, entry);
      }
    }
    return perCategory;
  }
}

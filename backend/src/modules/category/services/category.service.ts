import { ConflictException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { GetManyReply } from '#common/dto/response/get-many-reply.js';
import { GetManyQueryType } from '#common/dto/request/get-many-query.js';
import { buildFindManyArgs } from '#common/utils/prisma-util.js';
import { CategoryDto } from '../dto/response/category.dto.js';
import { CategoryCreateDto } from '../dto/request/category-create.dto.js';
import { CategoryUpdateDto } from '../dto/request/category-update.dto.js';
import { CategoryRepository } from '../repositories/category.repository.js';
import { FormRepository } from '../repositories/form.repository.js';

@Injectable()
export class CategoryService {
  /** Item ordering applied everywhere. */
  private static readonly ITEM_ORDER = [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }];

  constructor(
    private readonly categoryRep: CategoryRepository,
    private readonly formRep: FormRepository,
  ) {}

  /**
   * List all categories with their items, plus a `usage` summary describing
   * how many forms reference the category from a select field (fields JSON
   * scan). Read by form fillers too — needed to render category-backed
   * dropdowns at runtime.
   */
  async categoryGetMany(query: GetManyQueryType<'Category'>): Promise<GetManyReply<CategoryDto>> {
    const predicate = buildFindManyArgs(query, { searchableFields: ['name', 'key'] });
    predicate.orderBy = predicate.orderBy ?? { name: 'asc' };

    const [categories, forms] = await Promise.all([
      this.categoryRep.findMany({
        ...predicate,
        include: { items: { orderBy: CategoryService.ITEM_ORDER } },
      }),
      this.formRep.findMany({ select: { id: true, name: true, fields: true } }),
    ]);

    const usage = this.scanUsage(
      categories.items.map((category) => category.id),
      forms.items,
    );

    return {
      items: categories.items.map((category) =>
        plainToInstance(CategoryDto, {
          ...category,
          usage: usage.get(category.id) ?? { formCount: 0, formNames: [] },
        }),
      ),
      totalCount: categories.totalCount,
    };
  }

  async categoryGetById(id: string): Promise<CategoryDto> {
    const category = await this.categoryRep.findAndCheckExistsBy(
      { where: { id }, include: { items: { orderBy: CategoryService.ITEM_ORDER } } },
      'id',
      id,
    );
    return plainToInstance(CategoryDto, category);
  }

  async categoryCreate(payload: CategoryCreateDto): Promise<string> {
    await this.assertKeyAvailable(payload.key);
    this.assertUniqueItemValues(payload.items);

    const category = await this.categoryRep.create({
      data: {
        key: payload.key,
        name: payload.name,
        description: payload.description,
        items: {
          create: this.withSortOrder(payload.items),
        },
      },
      include: { items: { orderBy: CategoryService.ITEM_ORDER } },
    });
    return category.id;
  }

  async categoryUpdate(id: string, payload: CategoryUpdateDto): Promise<void> {
    const existing = await this.categoryRep.findAndCheckExistsBy({ where: { id } }, 'id', id);

    if (payload.key && payload.key !== existing.key) {
      await this.assertKeyAvailable(payload.key);
    }
    if (payload.items) {
      this.assertUniqueItemValues(payload.items);
    }

    await this.categoryRep.update({
      where: { id },
      data: {
        key: payload.key,
        name: payload.name,
        description: payload.description,
        // Nested write runs in an implicit transaction — replace list atomically
        ...(payload.items
          ? { items: { deleteMany: {}, create: this.withSortOrder(payload.items) } }
          : {}),
      },
    });
  }

  async categoryDelete(id: string): Promise<void> {
    await this.categoryRep.findAndCheckExistsBy({ where: { id } }, 'id', id);
    // Items cascade-delete (FK onDelete: Cascade); forms keep their field JSON
    // and simply fall back to inline options — no hard block on delete.
    await this.categoryRep.remove({ where: { id } });
  }

  // -------------------------------------------------------------------------

  private async assertKeyAvailable(key: string): Promise<void> {
    const existing = await this.categoryRep.findUnique({ where: { key } });
    if (existing) {
      throw new ConflictException(`Category key "${key}" is already in use`);
    }
  }

  private assertUniqueItemValues(items?: { value: string }[]): void {
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
  ): Map<string, { formCount: number; formNames: string[] }> {
    const idSet = new Set(categoryIds);
    const perCategory = new Map<string, { formCount: number; formNames: string[] }>();

    for (const form of forms) {
      let fields: unknown[] = [];
      try {
        const parsed: unknown = JSON.parse(form.fields);
        if (Array.isArray(parsed)) fields = parsed;
      } catch {
        continue; // malformed form JSON — skip
      }
      const hitCategories = new Set<string>();
      for (const field of fields) {
        const ref = (field as { categoryId?: unknown })?.categoryId;
        if (
          (field as { type?: string })?.type === 'select' &&
          typeof ref === 'string' &&
          idSet.has(ref)
        ) {
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

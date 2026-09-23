import { Module } from '@nestjs/common';
import { CategoryController } from './controllers/category.controller.js';
import { CategoryService } from './services/category.service.js';
import { CategoryRepository } from './repositories/category.repository.js';
import { FormRepository } from './repositories/form.repository.js';

@Module({
  imports: [],
  controllers: [CategoryController],
  providers: [CategoryService, CategoryRepository, FormRepository],
  exports: [],
})
export class CategoryModule {}

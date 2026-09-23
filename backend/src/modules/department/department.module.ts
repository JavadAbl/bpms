import { Module } from '@nestjs/common';
import { DepartmentController } from './controllers/department.controller.js';
import { DepartmentService } from './services/department.service.js';
import { DepartmentRepository } from './repositories/department.repository.js';

@Module({
  imports: [],
  controllers: [DepartmentController],
  providers: [DepartmentService, DepartmentRepository],
  exports: [],
})
export class DepartmentModule {}

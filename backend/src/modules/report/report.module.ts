import { Module } from '@nestjs/common';
import { ReportController } from './controllers/report.controller.js';
import { ReportService } from './services/report.service.js';
import { ReportDefinitionRepository } from './repositories/report-definition.repository.js';
import { ProcessRepository } from './repositories/process.repository.js';
import { ProcessInstanceRepository } from './repositories/process-instance.repository.js';
import { ProcessVariableRepository } from './repositories/process-variable.repository.js';
import { FormRepository } from './repositories/form.repository.js';
import { CategoryRepository } from './repositories/category.repository.js';

@Module({
  imports: [],
  controllers: [ReportController],
  providers: [
    ReportService,
    ReportDefinitionRepository,
    ProcessRepository,
    ProcessInstanceRepository,
    ProcessVariableRepository,
    FormRepository,
    CategoryRepository,
  ],
  exports: [],
})
export class ReportModule {}

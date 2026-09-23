import { Module } from '@nestjs/common';
import { BpmnModule } from '#modules/bpmn/bpmn.module.js';
import { UserModule } from '#modules/user/user.module.js';
import { FormModule } from '#modules/form/form.module.js';
import { ProcessController } from './controllers/process.controller.js';
import { ProcessService } from './services/process.service.js';
import { ProcessRepository } from './repositories/process.repository.js';
import { ProcessVersionRepository } from './repositories/process-version.repository.js';
import { TaskAssignmentRepository } from './repositories/task-assignment.repository.js';
import { ProcessStarterRepository } from './repositories/process-starter.repository.js';
import { ProcessVariableRepository } from './repositories/process-variable.repository.js';

@Module({
  imports: [BpmnModule, UserModule, FormModule],
  controllers: [ProcessController],
  providers: [
    ProcessService,
    ProcessRepository,
    ProcessVersionRepository,
    TaskAssignmentRepository,
    ProcessStarterRepository,
    ProcessVariableRepository,
  ],
  exports: [],
})
export class ProcessModule {}

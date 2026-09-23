import { Module } from '@nestjs/common';
import { BpmnModule } from '#modules/bpmn/bpmn.module.js';
import { TaskModule } from '#modules/task/task.module.js';
import { ProcessInstanceController } from './controllers/process-instance.controller.js';
import { ProcessInstanceService } from './services/process-instance.service.js';
import { ProcessInstanceRepository } from './repositories/process-instance.repository.js';
import { TaskRepository } from './repositories/task.repository.js';
import { FormSubmissionRepository } from './repositories/form-submission.repository.js';
import { UserRepository } from './repositories/user.repository.js';
import { UserPositionRepository } from './repositories/user-position.repository.js';
import { PositionRepository } from './repositories/position.repository.js';
import { ProcessInstanceServiceContract } from './contracts/process-instance-service.contract.js';
import { ProcessInstanceProvider } from './providers/process-instance.service.provider.js';

@Module({
  imports: [BpmnModule, TaskModule],
  controllers: [ProcessInstanceController],
  providers: [
    ProcessInstanceService,
    ProcessInstanceRepository,
    TaskRepository,
    FormSubmissionRepository,
    UserRepository,
    UserPositionRepository,
    PositionRepository,
    { provide: ProcessInstanceServiceContract, useClass: ProcessInstanceProvider },
  ],
  exports: [ProcessInstanceServiceContract],
})
export class ProcessInstanceModule {}

import { Module } from '@nestjs/common';
import { BpmnModule } from '#modules/bpmn/bpmn.module.js';
import { FileModule } from '#modules/file/file.module.js';
import { TaskController } from './controllers/task.controller.js';
import { TaskService } from './services/task.service.js';
import { TaskRepository } from './repositories/task.repository.js';
import { FormSubmissionRepository } from './repositories/form-submission.repository.js';
import { UserPositionRepository } from './repositories/user-position.repository.js';
import { TaskServiceContract } from './contracts/task-service.contract.js';
import { TaskProvider } from './providers/task.service.provider.js';

@Module({
  imports: [BpmnModule, FileModule],
  controllers: [TaskController],
  providers: [
    TaskService,
    TaskRepository,
    FormSubmissionRepository,
    UserPositionRepository,
    { provide: TaskServiceContract, useClass: TaskProvider },
  ],
  exports: [TaskServiceContract],
})
export class TaskModule {}

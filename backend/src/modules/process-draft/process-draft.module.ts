import { Module } from '@nestjs/common';
import { BpmnModule } from '#modules/bpmn/bpmn.module.js';
import { ProcessInstanceModule } from '#modules/process-instance/process-instance.module.js';
import { TaskModule } from '#modules/task/task.module.js';
import { ProcessDraftController } from './controllers/process-draft.controller.js';
import { ProcessDraftService } from './services/process-draft.service.js';
import { ProcessDraftRepository } from './repositories/process-draft.repository.js';

@Module({
  imports: [BpmnModule, ProcessInstanceModule, TaskModule],
  controllers: [ProcessDraftController],
  providers: [ProcessDraftService, ProcessDraftRepository],
  exports: [],
})
export class ProcessDraftModule {}

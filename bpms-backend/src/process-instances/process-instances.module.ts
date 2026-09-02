import { Module } from '@nestjs/common';
import { ProcessInstancesService } from './process-instances.service';
import { ProcessInstancesController } from './process-instances.controller';
import { BpmnModule } from '../bpmn/bpmn.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [BpmnModule, TasksModule],
  providers: [ProcessInstancesService],
  controllers: [ProcessInstancesController],
  exports: [ProcessInstancesService],
})
export class ProcessInstancesModule {}

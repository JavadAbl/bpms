import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { BpmnModule } from '../bpmn/bpmn.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [BpmnModule, FilesModule],
  providers: [TasksService],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}

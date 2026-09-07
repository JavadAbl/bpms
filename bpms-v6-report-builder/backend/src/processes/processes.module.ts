import { Module } from '@nestjs/common';
import { ProcessesService } from './processes.service';
import { ProcessesController } from './processes.controller';
import { BpmnModule } from '../bpmn/bpmn.module';

@Module({
  imports: [BpmnModule],
  providers: [ProcessesService],
  controllers: [ProcessesController],
  exports: [ProcessesService],
})
export class ProcessesModule {}

import { Module } from '@nestjs/common';
import { BpmnEngineService } from './bpmn.engine';

@Module({
  providers: [BpmnEngineService],
  exports: [BpmnEngineService],
})
export class BpmnModule {}

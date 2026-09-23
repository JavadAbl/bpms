import { Module } from '@nestjs/common';
import { BpmnEngineService } from './services/bpmn-engine.service.js';
import { BpmnEngineServiceContract } from './contracts/bpmn-engine.contract.js';
import { BpmnEngineProvider } from './providers/bpmn-engine.provider.js';

@Module({
  imports: [],
  controllers: [],
  providers: [BpmnEngineService, { provide: BpmnEngineServiceContract, useClass: BpmnEngineProvider }],
  exports: [BpmnEngineServiceContract],
})
export class BpmnModule {}

import { Injectable } from '@nestjs/common';
import { BpmnEngineService } from '../services/bpmn-engine.service.js';
import {
  BpmnEngineServiceContract,
  type BpmnStartInstanceOptions,
  type BpmnResumeInstanceOptions,
  type UserTaskDefinition,
} from '../contracts/bpmn-engine.contract.js';

/** Contract implementation consumed by other modules (process, process-instance, task). */
@Injectable()
export class BpmnEngineProvider implements BpmnEngineServiceContract {
  constructor(private readonly bpmnEngineService: BpmnEngineService) {}

  bpmnExtractUserTasks(bpmnXml: string): UserTaskDefinition[] {
    return this.bpmnEngineService.bpmnExtractUserTasks(bpmnXml);
  }

  bpmnStartInstance(opts: BpmnStartInstanceOptions): Promise<void> {
    return this.bpmnEngineService.bpmnStartInstance(opts);
  }

  bpmnResumeInstance(opts: BpmnResumeInstanceOptions): Promise<void> {
    return this.bpmnEngineService.bpmnResumeInstance(opts);
  }

  bpmnSignalTask(instanceId: string, executionId: string, data: unknown): Promise<void> {
    return this.bpmnEngineService.bpmnSignalTask(instanceId, executionId, data);
  }

  bpmnTerminateInstance(instanceId: string): Promise<void> {
    return this.bpmnEngineService.bpmnTerminateInstance(instanceId);
  }

  bpmnIsRunning(instanceId: string): boolean {
    return this.bpmnEngineService.bpmnIsRunning(instanceId);
  }
}

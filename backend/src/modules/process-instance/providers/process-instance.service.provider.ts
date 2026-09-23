import { Injectable } from '@nestjs/common';
import { ProcessInstanceService } from '../services/process-instance.service.js';
import { ProcessInstanceServiceContract } from '../contracts/process-instance-service.contract.js';
import type { ProcessInstanceDto } from '../dto/response/process-instance.dto.js';
import type { ProcessInstanceStartDto } from '../dto/request/process-instance-start.dto.js';

/** Contract implementation consumed by other modules (process-draft). */
@Injectable()
export class ProcessInstanceProvider implements ProcessInstanceServiceContract {
  constructor(private readonly processInstanceService: ProcessInstanceService) {}

  processInstanceStart(
    dto: ProcessInstanceStartDto,
    user: { id: string; role?: string },
  ): Promise<ProcessInstanceDto> {
    return this.processInstanceService.processInstanceStart(dto, user);
  }

  processInstanceGetById(
    id: string,
    user?: { id: string; role?: string },
  ): Promise<ProcessInstanceDto> {
    return this.processInstanceService.processInstanceGetById(id, user);
  }
}

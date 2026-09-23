import type { ProcessInstanceDto } from '../dto/response/process-instance.dto.js';
import type { ProcessInstanceStartDto } from '../dto/request/process-instance-start.dto.js';

/**
 * Cross-module API of the process-instance domain.
 * Consumed by process-draft (submit → start instance).
 */
export abstract class ProcessInstanceServiceContract {
  abstract processInstanceStart(
    dto: ProcessInstanceStartDto,
    user: { id: string; role?: string },
  ): Promise<ProcessInstanceDto>;

  abstract processInstanceGetById(
    id: string,
    user?: { id: string; role?: string },
  ): Promise<ProcessInstanceDto>;
}

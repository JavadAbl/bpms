import { Injectable } from '@nestjs/common';
import { FormRepository } from '../repositories/form.repository.js';
import { FormServiceContract } from '../contracts/form-service.contract.js';
import type { Form } from '#common/infrastructure/database/generated/prisma/client.js';

/** Contract implementation consumed by other modules (process, ...). */
@Injectable()
export class FormProvider implements FormServiceContract {
  constructor(private readonly formRep: FormRepository) {}

  formGetById(id: string): Promise<Form | null> {
    return this.formRep.findUnique({ where: { id } });
  }
}

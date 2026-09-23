import { Module } from '@nestjs/common';
import { FormController } from './controllers/form.controller.js';
import { FormService } from './services/form.service.js';
import { FormRepository } from './repositories/form.repository.js';
import { ProcessRepository } from './repositories/process.repository.js';
import { FormServiceContract } from './contracts/form-service.contract.js';
import { FormProvider } from './providers/form.service.provider.js';

@Module({
  imports: [],
  controllers: [FormController],
  providers: [
    FormService,
    FormRepository,
    ProcessRepository,
    { provide: FormServiceContract, useClass: FormProvider },
  ],
  exports: [FormServiceContract],
})
export class FormModule {}

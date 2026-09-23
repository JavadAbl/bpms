import { Module } from '@nestjs/common';
import { DashboardController } from './controllers/dashboard.controller.js';
import { DashboardService } from './services/dashboard.service.js';
import { TaskRepository } from './repositories/task.repository.js';
import { ProcessInstanceRepository } from './repositories/process-instance.repository.js';
import { ProcessRepository } from './repositories/process.repository.js';
import { UserPositionRepository } from './repositories/user-position.repository.js';

@Module({
  imports: [],
  controllers: [DashboardController],
  providers: [DashboardService, TaskRepository, ProcessInstanceRepository, ProcessRepository, UserPositionRepository],
  exports: [],
})
export class DashboardModule {}

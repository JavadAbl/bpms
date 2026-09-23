import { Module } from '@nestjs/common';
import { PositionController } from './controllers/position.controller.js';
import { PositionService } from './services/position.service.js';
import { PositionRepository } from './repositories/position.repository.js';
import { UserPositionRepository } from './repositories/user-position.repository.js';

@Module({
  imports: [],
  controllers: [PositionController],
  providers: [PositionService, PositionRepository, UserPositionRepository],
  exports: [],
})
export class PositionModule {}

import { Module } from '@nestjs/common';
import { HealthService } from './health.service.js';
import { HealthController } from './health.controller.js';

@Module({
  providers: [HealthService],
  controllers: [HealthController],
})
export class HealthModule {}

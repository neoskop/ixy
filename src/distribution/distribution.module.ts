import { Module } from '@nestjs/common';
import { DistributionService } from './distribution.service.js';

@Module({
  providers: [DistributionService],
  exports: [DistributionService],
})
export class DistributionModule {}

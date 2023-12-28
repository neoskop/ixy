import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { HealthService } from './health.service.js';
import { FastifyReply } from 'fastify';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('readiness')
  public async readiness(@Res() res: FastifyReply) {
    const isReady = this.healthService.isReady();
    res
      .status(isReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
      .send({ status: `${isReady ? '' : 'un'}ready` });
  }

  @Get('liveness')
  public liveness() {
    return { status: 'ok' };
  }

  @Get('startup')
  public async startup(@Res() res: FastifyReply) {
    return this.readiness(res);
  }
}

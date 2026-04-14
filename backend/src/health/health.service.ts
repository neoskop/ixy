import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  public ready = true;

  public isReady(): boolean {
    return this.ready;
  }
}

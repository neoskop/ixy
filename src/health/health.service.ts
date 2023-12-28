import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  public ready = true; // set to false later and set upon init

  public setReady() {
    this.ready = true;
  }

  public async isReady(): Promise<boolean> {
    return this.ready;
  }
}

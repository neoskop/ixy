import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import etag from '@fastify/etag';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({}),
  );
  app.register(etag as any);
  const configService = app.get(ConfigService);
  await app.listen(configService.get<number>('PORT') || 8080, '0.0.0.0');
}
bootstrap();

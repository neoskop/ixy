import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import etag from '@fastify/etag';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';

async function bootstrap() {
  sharp.cache({ memory: 50, files: 10, items: 50 });
  sharp.concurrency(1);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({}),
  );
  app.register(etag as any, {
    algorithm: 'md5',
  });
  const configService = app.get(ConfigService);
  await app.listen(configService.get<number>('PORT') || 8080, '0.0.0.0');
}
bootstrap();

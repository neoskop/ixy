import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import etag from '@fastify/etag';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({}),
  );
  app.register(etag);
  await app.listen(process.env.PORT || 8080, '0.0.0.0');
}
bootstrap();

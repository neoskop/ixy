import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Req,
  Res,
} from '@nestjs/common';
import chalk from 'chalk';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ImageService } from './image.service.js';
import { ConfigService } from '@nestjs/config';

@Controller('*')
export class ImageController {
  constructor(
    private readonly imageService: ImageService,
    private readonly configService: ConfigService,
  ) {}

  private getParams(request: FastifyRequest) {
    const urlRegex = /\/(?<width>\d{1,4})\/(?<height>\d{1,4})(?<path>\/(.+))/;
    const {
      groups: { width, height, path },
    } = RegExp(urlRegex).exec(request.url) || {
      groups: { width: null, height: null, path: null },
    };

    const parsedWidth = parseInt(width);
    const parsedHeight = parseInt(height);

    const maxWidth = this.configService.getOrThrow('MAX_WIDTH');
    const maxHeight = this.configService.getOrThrow('MAX_HEIGHT');

    if (isNaN(parsedWidth) || isNaN(parsedHeight) || !path) {
      throw new BadRequestException(
        'Width or height is not a number or path is missing.',
      );
    }

    if (
      (parsedWidth && parsedWidth > maxWidth) ||
      (parsedHeight && parsedHeight > maxHeight)
    ) {
      throw new BadRequestException(
        `Width and height must not exceed ${maxWidth}x${maxHeight} pixels.`,
      );
    }

    return {
      parsedWidth,
      parsedHeight,
      path,
    };
  }

  @Get()
  public async resize(
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const { parsedWidth, parsedHeight, path } = this.getParams(request);

    try {
      const resizedImage = await this.imageService.getResizedImage(
        path,
        parsedWidth,
        parsedHeight,
      );

      reply.header('Content-Type', 'image/webp');
      reply.header(
        'Cache-Control',
        `public, max-age=${
          60 *
          60 *
          24 *
          Number(this.configService.getOrThrow<string>('CACHE_CONTROL_MAX_AGE'))
        }`,
      );
      reply.send(resizedImage);
    } catch (err) {
      if (err.name === 'AbortError') {
        Logger.error(`Request for ${chalk.bold(path)} timed out`);
        reply.code(504).send('Request timed out');
      } else if (err instanceof BadRequestException) {
        reply.code(400).send(err.message);
      } else if (err instanceof NotFoundException) {
        reply.code(404).send(err.message);
      } else {
        Logger.error(err.message);
        reply.status(500).send('Internal Server Error');
      }
    }
  }
}
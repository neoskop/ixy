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

@Controller('*')
export class ImageController {
  constructor(private readonly imageService: ImageService) {}

  MAX_IMAGE_DIMENSION = 5000;
  private getParams(request: FastifyRequest) {
    const urlRegex = /\/(?<width>\d{1,4})\/(?<height>\d{1,4})(?<path>\/(.+))/;
    const {
      groups: { width, height, path },
    } = RegExp(urlRegex).exec(request.url) || {
      groups: { width: null, height: null, path: null },
    };

    const parsedWidth = parseInt(width) || undefined;
    const parsedHeight = parseInt(height) || undefined;

    if (isNaN(parsedWidth) || isNaN(parsedHeight) || !path) {
      throw new BadRequestException(
        'Width or height is not a number or path is missing.',
      );
    }

    if (
      (parsedWidth && parsedWidth > this.MAX_IMAGE_DIMENSION) ||
      (parsedHeight && parsedHeight > this.MAX_IMAGE_DIMENSION)
    ) {
      throw new BadRequestException(
        `Width and height must not exceed ${this.MAX_IMAGE_DIMENSION} pixels.`,
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
          60 * 60 * 24 * Number(process.env.CACHE_CONTROL_MAX_AGE)
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

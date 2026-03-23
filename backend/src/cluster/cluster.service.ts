import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createHash } from 'node:crypto';
import { KubernetesService } from '../kubernetes/kubernetes.service.js';

type ClusterNode = {
  name: string;
  ip?: string;
  isCurrent: boolean;
};

@Injectable()
export class ClusterRoutingService {
  private readonly replicationFactor = 2;
  private readonly podCacheTtlMs = 5_000;
  private podCache?: { expiresAt: number; pods: ClusterNode[] };

  constructor(
    private readonly configService: ConfigService,
    private readonly kubernetesService: KubernetesService,
  ) {}

  public isEnabled(): boolean {
    const explicit = this.configService.get<string>('CLUSTER_MODE');
    return explicit === 'true' || explicit === '1';
  }

  public async maybeForwardRequest(
    key: string,
    requestPath: string,
    forwardedBy?: string,
  ): Promise<Buffer | null> {
    if (!this.isEnabled()) {
      return null;
    }

    if (forwardedBy) {
      Logger.debug(
        `Request for ${key} already forwarded by ${forwardedBy}. Handling locally.`,
      );
      return null;
    }

    const { owners, isOwner } = await this.getOwnersForKey(key);

    if (owners.length === 0 || isOwner) {
      return null;
    }

    try {
      return await this.fetchFromOwners(owners, requestPath);
    } catch (error) {
      Logger.warn(
        `Failed to forward ${key} to owners. Handling locally instead.`,
        error,
      );
      return null;
    }
  }

  public async getOwnersForKey(
    key: string,
  ): Promise<{ owners: ClusterNode[]; isOwner: boolean }> {
    const pods = await this.getReadyPods();

    if (pods.length === 0) {
      Logger.warn(`No ready pods available for ${key}. Handling locally.`);
      return { owners: [], isOwner: true };
    }

    const currentInList = pods.some((pod) => pod.isCurrent);
    if (!currentInList) {
      Logger.warn(
        `Current pod is missing from ready list. Handling ${key} locally.`,
      );
      return { owners: [], isOwner: true };
    }

    const scored = pods.map((pod) => ({
      pod,
      score: this.scoreNode(key, pod.name),
    }));

    scored.sort((a, b) => {
      if (a.score === b.score) {
        return 0;
      }
      return a.score > b.score ? -1 : 1;
    });

    const owners = scored
      .slice(0, Math.min(this.replicationFactor, scored.length))
      .map((entry) => entry.pod);

    return { owners, isOwner: owners.some((pod) => pod.isCurrent) };
  }

  private async getReadyPods(): Promise<ClusterNode[]> {
    const now = Date.now();
    if (this.podCache && this.podCache.expiresAt > now) {
      return this.podCache.pods;
    }

    try {
      const pods = await this.kubernetesService.findReadyPods();
      const mapped = pods.map((pod) => ({
        name: pod.name,
        ip: pod.ip,
        isCurrent: pod.name === this.kubernetesService.currentPodName,
      }));

      this.podCache = {
        expiresAt: now + this.podCacheTtlMs,
        pods: mapped,
      };

      return mapped;
    } catch (error) {
      Logger.warn('Failed to load ready pods for cluster routing.', error);
      return [];
    }
  }

  private scoreNode(key: string, nodeName: string): bigint {
    const hash = createHash('sha256')
      .update(`${key}:${nodeName}`)
      .digest();
    return hash.readBigUInt64BE(0);
  }

  private async fetchFromOwners(
    owners: ClusterNode[],
    requestPath: string,
  ): Promise<Buffer> {
    let lastError: Error;

    for (const owner of owners) {
      if (owner.isCurrent) {
        continue;
      }

      if (!owner.ip) {
        Logger.warn(`Owner ${owner.name} has no IP. Skipping.`);
        continue;
      }

      try {
        return await this.fetchFromOwner(owner, requestPath);
      } catch (error) {
        lastError = error;
        Logger.warn(
          `Owner ${owner.name} failed to handle ${requestPath}. Trying next owner.`,
          error,
        );
      }
    }

    if (lastError) {
      throw lastError;
    }

    throw new Error('No reachable owners available.');
  }

  private async fetchFromOwner(
    owner: ClusterNode,
    requestPath: string,
  ): Promise<Buffer> {
    const port = this.configService.get<string>('PORT') || '8080';
    const timeoutMs =
      Number(this.configService.get<string>('TIMEOUT')) * 1000;
    const forwardedBy = this.kubernetesService.currentPodName || 'unknown';

    const response = await axios.get(
      `http://${owner.ip}:${port}${requestPath}`,
      {
        responseType: 'arraybuffer',
        timeout: timeoutMs,
        validateStatus: () => true,
        headers: {
          'X-Ixy-Forwarded-By': forwardedBy,
        },
      },
    );

    if (response.status >= 200 && response.status < 300) {
      return Buffer.from(response.data);
    }

    const message = this.getResponseMessage(response.data);

    if (response.status === 400) {
      throw new BadRequestException(message || 'Bad Request');
    }

    if (response.status === 404) {
      throw new NotFoundException(message || 'Not Found');
    }

    if (response.status === 504) {
      const error = new Error(message || 'Request timed out');
      error.name = 'AbortError';
      throw error;
    }

    throw new Error(
      `Owner ${owner.name} responded with ${response.status} for ${requestPath}`,
    );
  }

  private getResponseMessage(data: unknown) {
    if (Buffer.isBuffer(data)) {
      return data.toString();
    }

    if (typeof data === 'string') {
      return data;
    }

    return '';
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PartnerChannelCode } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedPartnerChannel } from './types/partner-channel.type';

const API_KEY_PREFIX_LENGTH = 12;

@Injectable()
export class PartnerChannelsService {
  constructor(private prisma: PrismaService) {}

  async authenticate(rawKey: string): Promise<AuthenticatedPartnerChannel | null> {
    if (rawKey.length < API_KEY_PREFIX_LENGTH) return null;
    const prefix = rawKey.slice(0, API_KEY_PREFIX_LENGTH);
    const channel = await this.prisma.partnerChannel.findFirst({
      where: { apiKeyPrefix: prefix, isActive: true },
    });
    if (!channel) return null;
    const valid = await bcrypt.compare(rawKey, channel.apiKeyHash);
    return valid ? channel : null;
  }

  listChannels() {
    return this.prisma.partnerChannel.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        apiKeyPrefix: true,
        isActive: true,
        commissionPercent: true,
        webhookUrl: true,
        createdAt: true,
        updatedAt: true,
        systemUser: { select: { id: true, email: true, fullName: true } },
        _count: { select: { bookings: true } },
      },
    });
  }

  async updateChannel(
    id: string,
    data: { isActive?: boolean; commissionPercent?: number | null; webhookUrl?: string | null },
  ) {
    const existing = await this.prisma.partnerChannel.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Partner channel not found');
    return this.prisma.partnerChannel.update({
      where: { id },
      data: {
        isActive: data.isActive,
        commissionPercent: data.commissionPercent,
        webhookUrl: data.webhookUrl,
      },
      select: {
        id: true,
        code: true,
        name: true,
        apiKeyPrefix: true,
        isActive: true,
        commissionPercent: true,
        webhookUrl: true,
        updatedAt: true,
      },
    });
  }

  async rotateApiKey(id: string) {
    const existing = await this.prisma.partnerChannel.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Partner channel not found');
    const { rawKey, prefix, hash } = await this.generateApiKey(existing.code);
    await this.prisma.partnerChannel.update({
      where: { id },
      data: { apiKeyPrefix: prefix, apiKeyHash: hash },
    });
    return { id, code: existing.code, apiKey: rawKey, apiKeyPrefix: prefix };
  }

  async generateApiKey(code: PartnerChannelCode) {
    const suffix = randomBytes(24).toString('hex');
    const rawKey = `sk_${code.toLowerCase()}_${suffix}`;
    const prefix = rawKey.slice(0, API_KEY_PREFIX_LENGTH);
    const hash = await bcrypt.hash(rawKey, 12);
    return { rawKey, prefix, hash };
  }

  async ensureChannel(params: {
    code: PartnerChannelCode;
    name: string;
    systemUserId: string;
    rawKey?: string;
  }) {
    const { rawKey, prefix, hash } = params.rawKey
      ? {
          rawKey: params.rawKey,
          prefix: params.rawKey.slice(0, API_KEY_PREFIX_LENGTH),
          hash: await bcrypt.hash(params.rawKey, 12),
        }
      : await this.generateApiKey(params.code);

    const channel = await this.prisma.partnerChannel.upsert({
      where: { code: params.code },
      create: {
        code: params.code,
        name: params.name,
        apiKeyPrefix: prefix,
        apiKeyHash: hash,
        systemUserId: params.systemUserId,
        isActive: true,
      },
      update: {
        name: params.name,
        systemUserId: params.systemUserId,
      },
    });

    return { channel, apiKey: rawKey };
  }
}

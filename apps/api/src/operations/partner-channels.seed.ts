import { PartnerChannelCode, PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

const API_KEY_PREFIX_LENGTH = 12;

const PARTNER_USERS = [
  {
    code: PartnerChannelCode.REDBUS,
    name: 'RedBus',
    email: 'partner-redbus@system.shivasakti.in',
    fullName: 'RedBus Integration',
  },
  {
    code: PartnerChannelCode.ABHIBUS,
    name: 'AbhiBus',
    email: 'partner-abhibus@system.shivasakti.in',
    fullName: 'AbhiBus Integration',
  },
] as const;

async function generateApiKey(code: PartnerChannelCode) {
  const suffix = randomBytes(24).toString('hex');
  const rawKey = `sk_${code.toLowerCase()}_${suffix}`;
  const prefix = rawKey.slice(0, API_KEY_PREFIX_LENGTH);
  const hash = await bcrypt.hash(rawKey, 12);
  return { rawKey, prefix, hash };
}

export async function seedPartnerChannels(prisma: PrismaClient) {
  const devPassword = await bcrypt.hash(`partner-system-${randomBytes(8).toString('hex')}`, 12);
  const createdKeys: { code: string; apiKey: string }[] = [];

  for (const partner of PARTNER_USERS) {
    let user = await prisma.user.findUnique({ where: { email: partner.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: partner.email,
          fullName: partner.fullName,
          passwordHash: devPassword,
          role: UserRole.CUSTOMER,
          isActive: true,
        },
      });
    }

    const existing = await prisma.partnerChannel.findUnique({ where: { code: partner.code } });
    if (existing) {
      await prisma.partnerChannel.update({
        where: { code: partner.code },
        data: { name: partner.name, systemUserId: user.id },
      });
      continue;
    }

    const { rawKey, prefix, hash } = await generateApiKey(partner.code);
    await prisma.partnerChannel.create({
      data: {
        code: partner.code,
        name: partner.name,
        apiKeyPrefix: prefix,
        apiKeyHash: hash,
        systemUserId: user.id,
        isActive: true,
        commissionPercent: 12,
      },
    });
    createdKeys.push({ code: partner.code, apiKey: rawKey });
  }

  if (createdKeys.length) {
    console.log('Partner API keys (store securely — shown once):');
    for (const row of createdKeys) {
      console.log(`  ${row.code}: ${row.apiKey}`);
    }
  } else {
    console.log('Partner channels already seeded (rotate keys in admin to get new keys).');
  }
}

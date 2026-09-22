import { PrismaClient, UserRole, CouponDiscountType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  COMPANY_LEGAL_NAME,
  DEFAULT_COMMISSION_CAP_PERCENT,
  DEFAULT_TIMEZONE,
} from '@shiva-sakti/shared';
import { seedFirstBus } from '../src/operations/launch-route.seed';
import { deactivateLegacyRoutes } from '../src/operations/return-routes.seed';
import { seedPartnerChannels } from '../src/operations/partner-channels.seed';

const prisma = new PrismaClient();

const isProduction = process.env.NODE_ENV === 'production';
const allowDevUsers = process.env.SEED_DEV_USERS === 'true';

/** Dev-only default admin — never used in production unless SEED_DEV_USERS=true */
const DEV_ADMIN_EMAIL = 'admin@shivasakti.in';
const DEV_ADMIN_PASSWORD = 'ShivaSakti@Dev2026';
const DEV_AGENT_EMAIL = 'agent@shivasakti.in';
const DEV_AGENT_PASSWORD = 'ShivaSakti@Dev2026';

async function ensureAdminUser() {
  if (isProduction && !allowDevUsers) {
    const prodEmail = process.env.PROD_ADMIN_EMAIL?.trim();
    const prodPassword = process.env.PROD_ADMIN_PASSWORD?.trim();
    if (prodEmail && prodPassword) {
      const existing = await prisma.user.findUnique({ where: { email: prodEmail } });
      if (!existing) {
        const passwordHash = await bcrypt.hash(prodPassword, 12);
        await prisma.user.create({
          data: {
            email: prodEmail,
            fullName: 'Shiv Shakti Admin',
            passwordHash,
            role: UserRole.ADMIN,
            isActive: true,
          },
        });
        console.log(`Production admin created: ${prodEmail} (password from PROD_ADMIN_PASSWORD)`);
      }
    } else {
      console.log('Production seed: skipping dev admin. Set PROD_ADMIN_EMAIL + PROD_ADMIN_PASSWORD to bootstrap admin.');
    }
    return;
  }

  const adminExists = await prisma.user.findUnique({ where: { email: DEV_ADMIN_EMAIL } });
  if (!adminExists) {
    const passwordHash = await bcrypt.hash(DEV_ADMIN_PASSWORD, 12);
    await prisma.user.create({
      data: {
        email: DEV_ADMIN_EMAIL,
        fullName: 'Shiv Shakti Admin',
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      },
    });
    console.log(`Dev admin created: ${DEV_ADMIN_EMAIL} / ${DEV_ADMIN_PASSWORD}`);
  }

  const agentExists = await prisma.user.findUnique({ where: { email: DEV_AGENT_EMAIL } });
  if (!agentExists) {
    const passwordHash = await bcrypt.hash(DEV_AGENT_PASSWORD, 12);
    await prisma.user.create({
      data: {
        email: DEV_AGENT_EMAIL,
        fullName: 'Shiv Shakti Agent',
        phone: '9437012345',
        passwordHash,
        role: UserRole.AGENT,
        isActive: true,
        agent: {
          create: {
            employeeCode: 'SSAG001',
            salaryMonthly: 15000,
            commissionRatePercent: 3,
            joinedAt: new Date(),
            isActive: true,
          },
        },
      },
    });
    console.log(`Dev agent created: ${DEV_AGENT_EMAIL} / ${DEV_AGENT_PASSWORD}`);
  }
}

async function main() {
  const company = await prisma.companySettings.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      legalName: COMPANY_LEGAL_NAME,
      displayName: COMPANY_LEGAL_NAME,
      timezone: DEFAULT_TIMEZONE,
      defaultCommissionCapPercent: DEFAULT_COMMISSION_CAP_PERCENT,
      supportEmail: 'support@shivasakti.in',
      supportPhone: '+91 94370 12345',
      seatLockTtlSeconds: 600,
      paymentPendingTtlSeconds: 900,
      gstin: '21AABCS1234F1Z5',
      pan: 'AABCS1234F',
      registeredAddress: 'Plot 12, Sector 5, Rourkela, Odisha 769001',
      stateCode: '21',
      invoicePrefix: 'SS',
      defaultGstPercent: 5,
    },
    update: {
      legalName: COMPANY_LEGAL_NAME,
      displayName: COMPANY_LEGAL_NAME,
      defaultCommissionCapPercent: DEFAULT_COMMISSION_CAP_PERCENT,
      gstin: '21AABCS1234F1Z5',
    },
  });

  const policies = [
    {
      name: 'Early cancellation',
      minHoursBeforeDeparture: 24,
      maxHoursBeforeDeparture: null as number | null,
      refundPercent: 80,
      priority: 30,
    },
    {
      name: 'Standard cancellation',
      minHoursBeforeDeparture: 12,
      maxHoursBeforeDeparture: 24,
      refundPercent: 50,
      priority: 20,
    },
    {
      name: 'Late cancellation',
      minHoursBeforeDeparture: 0,
      maxHoursBeforeDeparture: 12,
      refundPercent: 0,
      priority: 10,
    },
  ];

  for (const p of policies) {
    const existing = await prisma.cancellationPolicy.findFirst({
      where: { name: p.name },
    });
    if (!existing) {
      await prisma.cancellationPolicy.create({ data: p });
    }
  }

  await ensureAdminUser();

  console.log('Seed complete:', { company: company.legalName, policies: policies.length });

  if (!isProduction) {
    const sampleCoupons = [
      { code: 'WELCOME10', discountType: CouponDiscountType.PERCENT, discountValue: 10, description: '10% off first booking' },
      { code: 'FLAT50', discountType: CouponDiscountType.FLAT, discountValue: 50, description: 'Flat ₹50 off' },
    ];
    for (const c of sampleCoupons) {
      await prisma.coupon.upsert({
        where: { code: c.code },
        create: { ...c, minOrderAmount: 200, isActive: true },
        update: { isActive: true, description: c.description },
      });
    }
  }

  await seedFirstBus(prisma);
  await deactivateLegacyRoutes(prisma);
  if (!isProduction) {
    await seedPartnerChannels(prisma);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

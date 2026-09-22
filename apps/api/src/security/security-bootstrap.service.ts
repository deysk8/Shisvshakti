import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEV_SECRET_MARKERS = ['dev_', 'change_in_production', 'change_me', 'dev-partner-webhook-secret'];

@Injectable()
export class SecurityBootstrapService {
  private readonly logger = new Logger(SecurityBootstrapService.name);

  validateProductionConfig(config: ConfigService) {
    if (config.get('NODE_ENV') !== 'production') return;

    const required = [
      'DATABASE_URL',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'CORS_ORIGINS',
      'APP_PUBLIC_URL',
      'API_PUBLIC_URL',
      'GPS_INGEST_SECRET',
      'PARTNER_WEBHOOK_HMAC_SECRET',
    ] as const;

    const missing = required.filter((key) => !config.get<string>(key)?.trim());
    if (missing.length) {
      throw new Error(`Missing required production env: ${missing.join(', ')}`);
    }

    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'GPS_INGEST_SECRET', 'PARTNER_WEBHOOK_HMAC_SECRET'] as const) {
      this.assertStrongSecret(key, config.get<string>(key) ?? '');
    }

    const cors = config.get<string>('CORS_ORIGINS') ?? '';
    if (cors.includes('localhost')) {
      this.logger.warn('CORS_ORIGINS includes localhost — use your live site URL only in production');
    }

    const cashfreeAppId = config.get<string>('CASHFREE_APP_ID');
    const cashfreeSecret = config.get<string>('CASHFREE_SECRET_KEY');
    if (!cashfreeAppId?.trim() || !cashfreeSecret?.trim()) {
      this.logger.warn(
        'Cashfree keys missing — online card/UPI checkout will fail. Agent cash bookings still work.',
      );
    }

    this.logger.log('Production security configuration validated');
  }

  private assertStrongSecret(name: string, value: string) {
    if (value.length < 32) {
      throw new Error(`${name} must be at least 32 characters in production`);
    }
    const lower = value.toLowerCase();
    for (const marker of DEV_SECRET_MARKERS) {
      if (lower.includes(marker)) {
        throw new Error(`${name} must not use development defaults in production`);
      }
    }
  }
}

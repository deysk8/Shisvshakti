import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export type MobileSendResult = {
  sent: boolean;
  provider: 'twilio' | 'dev';
  devFile?: string;
  waMeLink?: string;
};

export type WhatsAppSendOptions = {
  mediaUrl?: string | null;
  contentSid?: string | null;
  contentVariables?: Record<string, string>;
};

@Injectable()
export class MobileMessagingService {
  private readonly logger = new Logger(MobileMessagingService.name);
  private readonly smsDevDir: string;
  private readonly whatsappDevDir: string;

  constructor(private config: ConfigService) {
    this.smsDevDir = path.join(process.cwd(), 'storage', 'sms');
    this.whatsappDevDir = path.join(process.cwd(), 'storage', 'whatsapp');
    fs.mkdirSync(this.smsDevDir, { recursive: true });
    fs.mkdirSync(this.whatsappDevDir, { recursive: true });
  }

  normalizeIndianPhone(phone: string): string | null {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return null;
    const local = digits.length === 10 ? digits : digits.slice(-10);
    return `+91${local}`;
  }

  formatWhatsAppRecipient(phone: string): string {
    const normalized = this.normalizeIndianPhone(phone);
    if (!normalized) {
      throw new Error('Invalid phone number for WhatsApp');
    }
    return normalized.startsWith('whatsapp:') ? normalized : `whatsapp:${normalized}`;
  }

  private hasTwilioCredentials(): boolean {
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const apiKeySid = this.config.get<string>('TWILIO_API_KEY_SID');
    const apiKeySecret = this.config.get<string>('TWILIO_API_KEY_SECRET');
    return Boolean(authToken || (apiKeySid && apiKeySecret));
  }

  private twilioAuthHeader(): string {
    const apiKeySid = this.config.get<string>('TWILIO_API_KEY_SID');
    const apiKeySecret = this.config.get<string>('TWILIO_API_KEY_SECRET');
    if (apiKeySid && apiKeySecret) {
      return Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString('base64');
    }
    const accountSid = this.config.getOrThrow<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.getOrThrow<string>('TWILIO_AUTH_TOKEN');
    return Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  }

  async sendSms(to: string, body: string): Promise<MobileSendResult> {
    const normalized = this.normalizeIndianPhone(to);
    if (!normalized) {
      throw new Error('Invalid phone number for SMS');
    }

    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const from = this.config.get<string>('TWILIO_SMS_FROM');

    if (sid && this.hasTwilioCredentials() && from) {
      await this.sendTwilioMessage({ to: normalized, from, body });
      return { sent: true, provider: 'twilio' };
    }

    const devFile = this.saveDevMessage(this.smsDevDir, 'sms', normalized, body);
    this.logger.log(`[DEV SMS] Saved to ${devFile}`);
    return { sent: false, provider: 'dev', devFile: path.relative(process.cwd(), devFile) };
  }

  async sendWhatsApp(
    to: string,
    body: string,
    options?: WhatsAppSendOptions,
  ): Promise<MobileSendResult> {
    const normalized = this.normalizeIndianPhone(to);
    if (!normalized) {
      throw new Error('Invalid phone number for WhatsApp');
    }

    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const from = this.config.get<string>('TWILIO_WHATSAPP_FROM');
    const contentSid = options?.contentSid ?? this.config.get<string>('TWILIO_WHATSAPP_CONTENT_SID');

    if (sid && this.hasTwilioCredentials() && from) {
      await this.sendTwilioMessage({
        to: this.formatWhatsAppRecipient(normalized),
        from,
        body: contentSid ? undefined : body,
        mediaUrl: contentSid ? undefined : (options?.mediaUrl ?? undefined),
        contentSid: contentSid ?? undefined,
        contentVariables: options?.contentVariables,
      });
      return { sent: true, provider: 'twilio' };
    }

    const digits = normalized.replace(/\D/g, '');
    const waMeLink = `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
    const devFile = this.saveDevMessage(
      this.whatsappDevDir,
      'whatsapp',
      normalized,
      body,
      waMeLink,
      options?.mediaUrl,
      contentSid,
      options?.contentVariables,
    );
    this.logger.log(`[DEV WHATSAPP] Saved to ${devFile}`);
    return {
      sent: false,
      provider: 'dev',
      devFile: path.relative(process.cwd(), devFile),
      waMeLink,
    };
  }

  private async sendTwilioMessage(input: {
    to: string;
    from: string;
    body?: string;
    mediaUrl?: string;
    contentSid?: string;
    contentVariables?: Record<string, string>;
  }) {
    const sid = this.config.getOrThrow<string>('TWILIO_ACCOUNT_SID');
    const auth = this.twilioAuthHeader();

    const params = new URLSearchParams({
      To: input.to,
      From: input.from,
    });

    if (input.contentSid) {
      params.append('ContentSid', input.contentSid);
      if (input.contentVariables && Object.keys(input.contentVariables).length) {
        params.append('ContentVariables', JSON.stringify(input.contentVariables));
      }
    } else {
      params.append('Body', input.body ?? '');
      if (input.mediaUrl) {
        params.append('MediaUrl', input.mediaUrl);
      }
    }

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Twilio error ${res.status}: ${text}`);
    }
  }

  private saveDevMessage(
    dir: string,
    kind: string,
    to: string,
    body: string,
    waMeLink?: string,
    mediaUrl?: string | null,
    contentSid?: string | null,
    contentVariables?: Record<string, string>,
  ) {
    const safe = `${Date.now()}-${to.replace(/\D/g, '')}.txt`;
    const filePath = path.join(dir, safe);
    const lines = [
      `Channel: ${kind}`,
      `To: ${to}`,
      `Time: ${new Date().toISOString()}`,
      '',
      body,
    ];
    if (contentSid) {
      lines.push('', `ContentSid: ${contentSid}`);
      if (contentVariables) {
        lines.push(`ContentVariables: ${JSON.stringify(contentVariables)}`);
      }
    }
    if (mediaUrl) lines.push('', `Ticket PDF: ${mediaUrl}`);
    if (waMeLink) lines.push('', `Dev WhatsApp link: ${waMeLink}`);
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    return filePath;
  }
}

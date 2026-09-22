import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PartnerChannelsService } from '../partner-channels.service';
import { PARTNER_CHANNEL_KEY } from '../../common/constants';

@Injectable()
export class PartnerAuthGuard implements CanActivate {
  constructor(private partnerChannels: PartnerChannelsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const apiKey = this.extractApiKey(request.headers);
    if (!apiKey) {
      throw new UnauthorizedException('Missing partner API key');
    }

    const channel = await this.partnerChannels.authenticate(apiKey);
    if (!channel) {
      throw new UnauthorizedException('Invalid partner API key');
    }

    (request as Record<string, unknown>)[PARTNER_CHANNEL_KEY] = channel;
    return true;
  }

  private extractApiKey(headers: Record<string, string | undefined>): string | null {
    const direct = headers['x-partner-key']?.trim();
    if (direct) return direct;

    const auth = headers.authorization?.trim();
    if (!auth) return null;
    const [scheme, token] = auth.split(/\s+/, 2);
    if (scheme?.toLowerCase() === 'bearer' && token) return token;
    return null;
  }
}

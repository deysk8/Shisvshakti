import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PARTNER_CHANNEL_KEY } from '../../common/constants';
import { AuthenticatedPartnerChannel } from '../types/partner-channel.type';

export const PartnerChannelCtx = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedPartnerChannel => {
    const request = ctx.switchToHttp().getRequest<{ [PARTNER_CHANNEL_KEY]: AuthenticatedPartnerChannel }>();
    return request[PARTNER_CHANNEL_KEY];
  },
);

import { PartnerChannel, PartnerChannelCode } from '@prisma/client';

export type AuthenticatedPartnerChannel = PartnerChannel & {
  code: PartnerChannelCode;
};

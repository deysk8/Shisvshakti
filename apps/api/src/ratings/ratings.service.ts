import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RatingsService {
  constructor(private prisma: PrismaService) {}

  async submit(userId: string, bookingReference: string, rating: number, comment?: string) {
    if (rating < 1 || rating > 5) throw new BadRequestException('Rating must be 1–5');
    const booking = await this.prisma.booking.findFirst({
      where: { bookingReference, customerUserId: userId, status: 'CONFIRMED' },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    const existing = await this.prisma.tripRating.findUnique({ where: { bookingId: booking.id } });
    if (existing) throw new BadRequestException('You already rated this trip');

    return this.prisma.tripRating.create({
      data: {
        bookingId: booking.id,
        userId,
        rating,
        comment: comment?.trim() || null,
      },
    });
  }

  async listPublic(limit = 10) {
    const rows = await this.prisma.tripRating.findMany({
      where: { rating: { gte: 4 } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { fullName: true } },
        booking: {
          select: {
            trip: { select: { route: { select: { name: true } } } },
          },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      author: r.user.fullName.split(' ')[0] + ' ***',
      routeName: r.booking.trip.route.name,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

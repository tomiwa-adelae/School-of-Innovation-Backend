import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SubmitReviewDto } from './dto/submit-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async getCourseReviews(courseId: string) {
    const reviews = await this.prisma.courseReview.findMany({
      where: { courseId },
      include: {
        user: { select: { firstName: true, lastName: true, image: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const avgRating =
      reviews.length
        ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
        : null;

    return { reviews, avgRating, total: reviews.length };
  }

  async submitReview(userId: string, courseId: string, dto: SubmitReviewDto) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true },
    });
    if (!enrollment) {
      throw new ForbiddenException('You must be enrolled to leave a review');
    }

    return this.prisma.courseReview.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId, rating: dto.rating, body: dto.body },
      update: { rating: dto.rating, body: dto.body },
      include: {
        user: { select: { firstName: true, lastName: true, image: true, username: true } },
      },
    });
  }

  async deleteReview(userId: string, reviewId: string) {
    const review = await this.prisma.courseReview.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId) throw new ForbiddenException('Not your review');

    await this.prisma.courseReview.delete({ where: { id: reviewId } });
    return { success: true };
  }
}

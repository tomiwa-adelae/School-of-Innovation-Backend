import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { Public } from 'src/decorators/public.decorator';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  @Public()
  @UseGuards(JwtAuthGuard)
  @Get(':courseId')
  getCourseReviews(@Param('courseId') courseId: string) {
    return this.service.getCourseReviews(courseId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':courseId')
  submitReview(
    @CurrentUser() user: any,
    @Param('courseId') courseId: string,
    @Body() dto: SubmitReviewDto,
  ) {
    return this.service.submitReview(user.id, courseId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':reviewId')
  deleteReview(@CurrentUser() user: any, @Param('reviewId') reviewId: string) {
    return this.service.deleteReview(user.id, reviewId);
  }
}

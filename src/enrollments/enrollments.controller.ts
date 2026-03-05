import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

class VerifyPaymentDto {
  @IsString() transactionId: string;
  @IsString() txRef: string;
}

class ManualEnrollDto {
  @IsString() userEmail: string;
  @IsString() @IsOptional() notes?: string;
}

class UpdateEnrollmentDto {
  @IsBoolean() @IsOptional() paymentVerified?: boolean;
  @IsString() @IsOptional() adminNotes?: string;
  @IsString() @IsOptional() paidAt?: string;
  @IsNumber() @IsOptional() amountPaid?: number;
  @IsString() @IsOptional() flwTransactionId?: string;
}

@Controller('enrollments')
@UseGuards(JwtAuthGuard)
export class EnrollmentsController {
  constructor(private readonly service: EnrollmentsService) {}

  /** GET /enrollments/my — all enrolled courses */
  @Get('my')
  getMyEnrollments(@CurrentUser() user: any) {
    return this.service.getMyEnrollments(user.id);
  }

  /** POST /enrollments/:courseId/free — instant free enrollment */
  @Post(':courseId/free')
  enrollFree(@CurrentUser() user: any, @Param('courseId') courseId: string) {
    return this.service.enrollFree(user.id, courseId);
  }

  /** GET /enrollments/check/:courseId — is user enrolled? */
  @Get('check/:courseId')
  checkEnrollment(@CurrentUser() user: any, @Param('courseId') courseId: string) {
    return this.service.checkEnrollment(user.id, courseId);
  }

  /** GET /enrollments/learn/:courseId — full course content (requires enrollment) */
  @Get('learn/:courseId')
  getEnrolledCourse(@CurrentUser() user: any, @Param('courseId') courseId: string) {
    return this.service.getEnrolledCourse(user.id, courseId);
  }

  /**
   * POST /enrollments/:courseId/verify-payment
   * Called after Flutterwave payment modal closes with "successful".
   * Verifies with Flutterwave API, then creates the enrollment.
   */
  @Post(':courseId/verify-payment')
  verifyAndEnroll(
    @CurrentUser() user: any,
    @Param('courseId') courseId: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.service.verifyAndEnroll(
      user.id,
      courseId,
      dto.transactionId,
      dto.txRef,
    );
  }

  // ─── Progress endpoints ───────────────────────────────────────────────────────

  /** POST /enrollments/progress/:lessonId — toggle lesson complete/incomplete */
  @Post('progress/:lessonId')
  toggleLessonCompletion(
    @CurrentUser() user: any,
    @Param('lessonId') lessonId: string,
  ) {
    return this.service.toggleLessonCompletion(user.id, lessonId);
  }

  /**
   * GET /enrollments/progress/overview
   * MUST be declared before progress/course/:courseId so "overview"
   * is not matched as a courseId param.
   */
  @Get('progress/overview')
  getProgressOverview(@CurrentUser() user: any) {
    return this.service.getProgressOverview(user.id);
  }

  /** GET /enrollments/progress/course/:courseId — completion data for one course */
  @Get('progress/course/:courseId')
  getCourseProgress(
    @CurrentUser() user: any,
    @Param('courseId') courseId: string,
  ) {
    return this.service.getCourseProgress(user.id, courseId);
  }

  // ─── Admin endpoints ─────────────────────────────────────────────────────────

  /**
   * GET /enrollments/admin/list
   * List all enrollments. Filter by courseId, userId, or search by name/email.
   */
  @Get('admin/list')
  adminList(
    @CurrentUser() user: any,
    @Query('courseId') courseId?: string,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (user.role !== 'ADMINISTRATOR') throw new ForbiddenException();
    return this.service.adminListEnrollments({
      courseId,
      userId,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  /**
   * POST /enrollments/admin/manual/:courseId
   * Manually enroll a user by email (bypass payment).
   */
  @Post('admin/manual/:courseId')
  adminManualEnroll(
    @CurrentUser() user: any,
    @Param('courseId') courseId: string,
    @Body() dto: ManualEnrollDto,
  ) {
    if (user.role !== 'ADMINISTRATOR') throw new ForbiddenException();
    return this.service.adminManualEnroll(
      user.id,
      courseId,
      dto.userEmail,
      dto.notes,
    );
  }

  /**
   * PATCH /enrollments/admin/:enrollmentId
   * Update enrollment: verify payment, add notes, correct amount, etc.
   */
  @Patch('admin/:enrollmentId')
  adminUpdate(
    @CurrentUser() user: any,
    @Param('enrollmentId') enrollmentId: string,
    @Body() dto: UpdateEnrollmentDto,
  ) {
    if (user.role !== 'ADMINISTRATOR') throw new ForbiddenException();
    return this.service.adminUpdateEnrollment(user.id, enrollmentId, dto);
  }

  /**
   * DELETE /enrollments/admin/:enrollmentId
   * Revoke a user's enrollment (remove access).
   */
  @Delete('admin/:enrollmentId')
  adminRevoke(
    @CurrentUser() user: any,
    @Param('enrollmentId') enrollmentId: string,
  ) {
    if (user.role !== 'ADMINISTRATOR') throw new ForbiddenException();
    return this.service.adminRevokeEnrollment(enrollmentId);
  }
}

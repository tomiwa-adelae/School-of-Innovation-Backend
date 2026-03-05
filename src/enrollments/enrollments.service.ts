import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

const FLW_BASE = 'https://api.flutterwave.com/v3';

@Injectable()
export class EnrollmentsService {
  constructor(private prisma: PrismaService) {}

  /** Enroll in a free course immediately */
  async enrollFree(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId, status: 'PUBLISHED', isDeleted: false },
      select: { id: true, pricingType: true, title: true },
    });

    if (!course) throw new NotFoundException('Course not found');
    if (course.pricingType !== 'FREE') {
      throw new ForbiddenException('This course requires payment');
    }

    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) throw new ConflictException('Already enrolled');

    return this.prisma.enrollment.create({
      data: { userId, courseId },
      select: { id: true, courseId: true, createdAt: true },
    });
  }

  /** Check if a user is enrolled in a course */
  async checkEnrollment(userId: string, courseId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true, createdAt: true },
    });
    return { enrolled: !!enrollment, enrollment: enrollment ?? null };
  }

  /** Get all courses the user is enrolled in */
  async getMyEnrollments(userId: string) {
    return this.prisma.enrollment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            shortDescription: true,
            thumbnail: true,
            level: true,
            pricingType: true,
            duration: true,
            instructor: {
              select: { id: true, firstName: true, lastName: true },
            },
            _count: {
              select: { chapters: { where: { isDeleted: false } } },
            },
          },
        },
      },
    });
  }

  /** Get enrolled course with full content (for the course player) */
  async getEnrolledCourse(userId: string, courseId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment)
      throw new ForbiddenException('Not enrolled in this course');

    const course = await this.prisma.course.findUnique({
      where: { id: courseId, isDeleted: false },
      select: {
        id: true,
        title: true,
        slug: true,
        shortDescription: true,
        description: true,
        thumbnail: true,
        level: true,
        language: true,
        duration: true,
        instructor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            image: true,
            bio: true,
          },
        },
        chapters: {
          where: { isDeleted: false },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            order: true,
            lessons: {
              where: { isDeleted: false },
              orderBy: { order: 'asc' },
              select: {
                id: true,
                title: true,
                duration: true,
                videoUrl: true,
                thumbnailUrl: true,
                description: true,
                isFree: true,
                isDownloadable: true,
                resources: {
                  select: {
                    id: true,
                    name: true,
                    url: true,
                    type: true,
                    size: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  /**
   * Verify a Flutterwave transaction and enroll the user in the paid course.
   * Called by the frontend after the payment modal closes with status "successful".
   */
  async verifyAndEnroll(
    userId: string,
    courseId: string,
    transactionId: string,
    txRef: string,
  ) {
    // 1. Load the course
    const course = await this.prisma.course.findUnique({
      where: { id: courseId, status: 'PUBLISHED', isDeleted: false },
      select: {
        id: true,
        pricingType: true,
        price: true,
        currency: true,
        title: true,
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    if (course.pricingType === 'FREE') {
      throw new BadRequestException(
        'This course is free — use the free enrollment endpoint',
      );
    }

    // 2. Already enrolled?
    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) throw new ConflictException('Already enrolled');

    // 3. Verify with Flutterwave
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;

    const flwRes = await fetch(
      `${FLW_BASE}/transactions/${transactionId}/verify`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );

    if (!flwRes.ok) {
      throw new BadRequestException(
        'Could not verify transaction with Flutterwave',
      );
    }

    const flwData: any = await flwRes.json();
    const tx = flwData?.data;

    if (!tx || tx.status !== 'successful') {
      throw new BadRequestException('Payment was not successful');
    }

    // 4. Guard: tx_ref must match what we generated on the frontend
    if (tx.tx_ref !== txRef) {
      throw new BadRequestException('Transaction reference mismatch');
    }

    // 5. Guard: amount must be >= course price (allow small rounding delta)
    const expectedAmount = course.price ?? 0;
    if (tx.amount < expectedAmount - 1) {
      throw new BadRequestException(
        'Payment amount does not match course price',
      );
    }

    // 6. Create enrollment with payment details
    return this.prisma.enrollment.create({
      data: {
        userId,
        courseId,
        paidAt: new Date(),
        amountPaid: tx.amount,
        currency: tx.currency,
        flwTransactionId: String(transactionId),
        paymentVerified: true,
      },
      select: { id: true, courseId: true, paidAt: true, amountPaid: true },
    });
  }

  // ─── Progress methods ─────────────────────────────────────────────────────────

  /**
   * Toggle a lesson's completion status for the current user.
   * Verifies enrollment before touching the completion record.
   * Returns { completed: boolean }.
   */
  async toggleLessonCompletion(userId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId, isDeleted: false },
      select: { id: true, chapter: { select: { courseId: true } } },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const courseId = lesson.chapter.courseId;

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true },
    });
    if (!enrollment) throw new ForbiddenException('Not enrolled in this course');

    const existing = await this.prisma.lessonCompletion.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });

    if (existing) {
      await this.prisma.lessonCompletion.delete({
        where: { userId_lessonId: { userId, lessonId } },
      });
      return { completed: false, certificateIssued: false };
    }

    await this.prisma.lessonCompletion.create({
      data: { userId, lessonId, enrollmentId: enrollment.id },
    });

    // Check if course is now 100% complete → auto-issue certificate
    const allLessons = await this.prisma.lesson.findMany({
      where: { isDeleted: false, chapter: { courseId, isDeleted: false } },
      select: { id: true },
    });
    const completionCount = await this.prisma.lessonCompletion.count({
      where: { userId, lessonId: { in: allLessons.map((l) => l.id) } },
    });
    let certificateIssued = false;
    if (allLessons.length > 0 && completionCount === allLessons.length) {
      const certNumber = `CERT-${userId.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      await this.prisma.certificate.upsert({
        where: { userId_courseId: { userId, courseId } },
        create: { userId, courseId, certificateNumber: certNumber },
        update: {},
      });
      certificateIssued = true;
    }

    return { completed: true, certificateIssued };
  }

  /** Returns completion data for one enrolled course. */
  async getCourseProgress(userId: string, courseId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true },
    });
    if (!enrollment) throw new ForbiddenException('Not enrolled in this course');

    const lessons = await this.prisma.lesson.findMany({
      where: { isDeleted: false, chapter: { courseId, isDeleted: false } },
      select: { id: true },
    });

    const lessonIds = lessons.map((l) => l.id);

    const completions = await this.prisma.lessonCompletion.findMany({
      where: { userId, lessonId: { in: lessonIds } },
      select: { lessonId: true },
    });

    const completedLessonIds = completions.map((c) => c.lessonId);
    const completedCount = completedLessonIds.length;
    const totalLessons = lessons.length;
    const percent =
      totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

    return { completedLessonIds, totalLessons, completedCount, percent };
  }

  /** Returns progress across all enrolled courses — used by the Progress page. */
  async getProgressOverview(userId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        courseId: true,
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnail: true,
            instructor: { select: { id: true, firstName: true, lastName: true } },
            chapters: {
              where: { isDeleted: false },
              select: {
                lessons: {
                  where: { isDeleted: false },
                  select: { id: true, duration: true },
                },
              },
            },
          },
        },
        lessonCompletions: {
          orderBy: { completedAt: 'desc' },
          select: { lessonId: true, completedAt: true },
        },
      },
    });

    const courses = enrollments.map((enrollment) => {
      const allLessons = enrollment.course.chapters.flatMap((ch) => ch.lessons);
      const totalLessons = allLessons.length;
      const completedSet = new Set(
        enrollment.lessonCompletions.map((c) => c.lessonId),
      );
      const completedLessons = completedSet.size;
      const percent =
        totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      const lastActivityAt =
        enrollment.lessonCompletions.length > 0
          ? enrollment.lessonCompletions[0].completedAt
          : null;
      const watchedSeconds = allLessons
        .filter((l) => completedSet.has(l.id))
        .reduce((sum, l) => sum + (l.duration ?? 0), 0);

      return {
        courseId: enrollment.courseId,
        title: enrollment.course.title,
        slug: enrollment.course.slug,
        thumbnail: enrollment.course.thumbnail,
        instructor: enrollment.course.instructor,
        totalLessons,
        completedLessons,
        percent,
        lastActivityAt,
        watchedSeconds,
      };
    });

    return {
      courses,
      totalEnrolled: courses.length,
      totalCompletedLessons: courses.reduce((s, c) => s + c.completedLessons, 0),
      totalWatchedSeconds: courses.reduce((s, c) => s + c.watchedSeconds, 0),
    };
  }

  // ─── Admin methods ───────────────────────────────────────────────────────────

  private ENROLLMENT_SELECT = {
    id: true,
    createdAt: true,
    paidAt: true,
    amountPaid: true,
    currency: true,
    flwTransactionId: true,
    manuallyEnrolled: true,
    manuallyEnrolledBy: true,
    adminNotes: true,
    paymentVerified: true,
    user: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        image: true,
        phoneNumber: true,
      },
    },
    course: {
      select: {
        id: true,
        title: true,
        slug: true,
        pricingType: true,
        price: true,
        currency: true,
      },
    },
  };

  /** Admin: list all enrollments, filterable by courseId or userId */
  async adminListEnrollments(params: {
    courseId?: string;
    userId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const { courseId, userId, search, limit = 50, offset = 0 } = params;

    const where: any = {};
    if (courseId) where.courseId = courseId;
    if (userId) where.userId = userId;
    if (search) {
      where.user = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [enrollments, total] = await Promise.all([
      this.prisma.enrollment.findMany({
        where,
        select: this.ENROLLMENT_SELECT,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.enrollment.count({ where }),
    ]);

    return { enrollments, total };
  }

  /** Admin: manually enroll a user (by email) in a course, bypassing payment */
  async adminManualEnroll(
    adminId: string,
    courseId: string,
    userEmail: string,
    notes?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (!user) throw new NotFoundException(`No user found with email: ${userEmail}`);

    const course = await this.prisma.course.findUnique({
      where: { id: courseId, isDeleted: false },
      select: { id: true, title: true },
    });
    if (!course) throw new NotFoundException('Course not found');

    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
    });
    if (existing) throw new ConflictException(`${userEmail} is already enrolled`);

    return this.prisma.enrollment.create({
      data: {
        userId: user.id,
        courseId,
        manuallyEnrolled: true,
        manuallyEnrolledBy: adminId,
        paymentVerified: true,
        adminNotes: notes ?? null,
      },
      select: this.ENROLLMENT_SELECT,
    });
  }

  /** Admin: update an enrollment (verify payment, add notes, revoke access) */
  async adminUpdateEnrollment(
    adminId: string,
    enrollmentId: string,
    data: {
      paymentVerified?: boolean;
      adminNotes?: string;
      paidAt?: string;
      amountPaid?: number;
      flwTransactionId?: string;
    },
  ) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    return this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        ...(data.paymentVerified !== undefined && {
          paymentVerified: data.paymentVerified,
          manuallyEnrolledBy: adminId,
        }),
        ...(data.adminNotes !== undefined && { adminNotes: data.adminNotes }),
        ...(data.paidAt && { paidAt: new Date(data.paidAt) }),
        ...(data.amountPaid !== undefined && { amountPaid: data.amountPaid }),
        ...(data.flwTransactionId !== undefined && {
          flwTransactionId: data.flwTransactionId,
        }),
      },
      select: this.ENROLLMENT_SELECT,
    });
  }

  /** Admin: remove/revoke an enrollment */
  async adminRevokeEnrollment(enrollmentId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    await this.prisma.enrollment.delete({ where: { id: enrollmentId } });
    return { success: true };
  }
}

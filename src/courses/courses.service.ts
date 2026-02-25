import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { ReorderItemsDto } from './dto/reorder-items.dto';
import slugify from 'slugify';
import { randomBytes } from 'crypto';

// ─── Shared select projections ────────────────────────────────────────────────

const LESSON_SELECT = {
  id: true,
  title: true,
  shortDescription: true,
  description: true,
  order: true,
  duration: true,
  videoUrl: true,
  thumbnailUrl: true,
  isPublished: true,
  isFree: true,
  isDownloadable: true,
  resources: {
    select: { id: true, name: true, url: true, type: true, size: true },
  },
  createdAt: true,
  updatedAt: true,
};

const CHAPTER_SELECT = {
  id: true,
  title: true,
  shortDescription: true,
  description: true,
  order: true,
  isPublished: true,
  isFree: true,
  lessons: {
    where: { isDeleted: false },
    select: LESSON_SELECT,
    orderBy: { order: 'asc' as const },
  },
  createdAt: true,
  updatedAt: true,
};

const COURSE_SELECT = {
  id: true,
  title: true,
  slug: true,
  shortDescription: true,
  description: true,
  thumbnail: true,
  previewVideo: true,
  level: true,
  language: true,
  status: true,
  pricingType: true,
  price: true,
  currency: true,
  tags: true,
  learningOutcomes: true,
  requirements: true,
  targetAudience: true,
  duration: true,
  publishedAt: true,
  categoryId: true,
  category: { select: { id: true, name: true, slug: true, icon: true } },
  chapters: {
    where: { isDeleted: false },
    select: CHAPTER_SELECT,
    orderBy: { order: 'asc' as const },
  },
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  // ─── Courses ────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateCourseDto) {
    const instructor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { instructorStatus: true, role: true },
    });

    if (
      !instructor ||
      instructor.role !== 'INSTRUCTOR' ||
      instructor.instructorStatus !== 'APPROVED'
    ) {
      throw new ForbiddenException(
        'Only approved instructors can create courses',
      );
    }

    const baseSlug = slugify(dto.title, { lower: true, strict: true });
    const slug = await this.uniqueSlug(baseSlug);

    return this.prisma.course.create({
      data: {
        ...dto,
        slug,
        instructorId: userId,
        tags: dto.tags ?? [],
        learningOutcomes: dto.learningOutcomes ?? [],
        requirements: dto.requirements ?? [],
        targetAudience: dto.targetAudience ?? [],
      },
      select: COURSE_SELECT,
    });
  }

  findMyCourses(userId: string) {
    return this.prisma.course.findMany({
      where: { instructorId: userId, isDeleted: false },
      select: {
        id: true,
        title: true,
        slug: true,
        shortDescription: true,
        thumbnail: true,
        status: true,
        pricingType: true,
        price: true,
        level: true,
        duration: true,
        category: { select: { id: true, name: true } },
        _count: {
          select: {
            chapters: { where: { isDeleted: false } },
          },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(courseId: string, userId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId, isDeleted: false },
      select: { ...COURSE_SELECT, instructorId: true },
    });

    if (!course) throw new NotFoundException('Course not found');
    if (course.instructorId !== userId)
      throw new ForbiddenException('Access denied');

    return course;
  }

  async update(courseId: string, userId: string, dto: UpdateCourseDto) {
    await this.verifyCourseOwnership(courseId, userId);
    return this.prisma.course.update({
      where: { id: courseId },
      data: dto,
      select: COURSE_SELECT,
    });
  }

  async softDelete(courseId: string, userId: string) {
    await this.verifyCourseOwnership(courseId, userId);
    return this.prisma.course.update({
      where: { id: courseId },
      data: { isDeleted: true },
      select: { id: true },
    });
  }

  async publish(courseId: string, userId: string) {
    await this.verifyCourseOwnership(courseId, userId);
    return this.prisma.course.update({
      where: { id: courseId },
      data: { status: 'UNDER_REVIEW' },
      select: { id: true, status: true },
    });
  }

  // ─── Admin ──────────────────────────────────────────────────────────────────

  async findAllForAdmin(status?: string) {
    return this.prisma.course.findMany({
      where: {
        isDeleted: false,
        ...(status ? { status: status as any } : {}),
      },
      select: {
        id: true,
        title: true,
        slug: true,
        shortDescription: true,
        thumbnail: true,
        status: true,
        pricingType: true,
        price: true,
        level: true,
        language: true,
        duration: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { id: true, name: true } },
        instructor: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        _count: {
          select: {
            chapters: { where: { isDeleted: false } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async adminFindOne(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId, isDeleted: false },
      select: {
        ...COURSE_SELECT,
        instructorId: true,
        instructor: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async approveCourse(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId, isDeleted: false },
    });
    if (!course) throw new NotFoundException('Course not found');
    return this.prisma.course.update({
      where: { id: courseId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
      select: { id: true, status: true },
    });
  }

  async rejectCourse(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId, isDeleted: false },
    });
    if (!course) throw new NotFoundException('Course not found');
    return this.prisma.course.update({
      where: { id: courseId },
      data: { status: 'DRAFT' },
      select: { id: true, status: true },
    });
  }

  async archiveCourse(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId, isDeleted: false },
    });
    if (!course) throw new NotFoundException('Course not found');
    return this.prisma.course.update({
      where: { id: courseId },
      data: { status: 'ARCHIVED' },
      select: { id: true, status: true },
    });
  }

  // ─── Chapters ───────────────────────────────────────────────────────────────

  async createChapter(courseId: string, userId: string, dto: CreateChapterDto) {
    await this.verifyCourseOwnership(courseId, userId);

    const count = await this.prisma.chapter.count({
      where: { courseId, isDeleted: false },
    });

    return this.prisma.chapter.create({
      data: { ...dto, courseId, order: count },
      select: CHAPTER_SELECT,
    });
  }

  async reorderChapters(
    courseId: string,
    userId: string,
    dto: ReorderItemsDto,
  ) {
    await this.verifyCourseOwnership(courseId, userId);

    await this.prisma.$transaction(
      dto.ids.map((id, index) =>
        this.prisma.chapter.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );

    return { success: true };
  }

  async updateChapter(
    chapterId: string,
    userId: string,
    dto: UpdateChapterDto,
  ) {
    await this.verifyChapterOwnership(chapterId, userId);
    return this.prisma.chapter.update({
      where: { id: chapterId },
      data: dto,
      select: CHAPTER_SELECT,
    });
  }

  async deleteChapter(chapterId: string, userId: string) {
    await this.verifyChapterOwnership(chapterId, userId);
    return this.prisma.chapter.update({
      where: { id: chapterId },
      data: { isDeleted: true },
      select: { id: true },
    });
  }

  // ─── Lessons ────────────────────────────────────────────────────────────────

  async createLesson(
    chapterId: string,
    userId: string,
    dto: CreateLessonDto,
  ) {
    const chapter = await this.verifyChapterOwnership(chapterId, userId);

    const count = await this.prisma.lesson.count({
      where: { chapterId, isDeleted: false },
    });

    const lesson = await this.prisma.lesson.create({
      data: { ...dto, chapterId, order: count, duration: dto.duration ?? 0 },
      select: LESSON_SELECT,
    });

    await this.recomputeCourseDuration(chapter.courseId);
    return lesson;
  }

  async reorderLessons(
    chapterId: string,
    userId: string,
    dto: ReorderItemsDto,
  ) {
    await this.verifyChapterOwnership(chapterId, userId);

    await this.prisma.$transaction(
      dto.ids.map((id, index) =>
        this.prisma.lesson.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );

    return { success: true };
  }

  async updateLesson(lessonId: string, userId: string, dto: UpdateLessonDto) {
    const { courseId } = await this.verifyLessonOwnership(lessonId, userId);

    const lesson = await this.prisma.lesson.update({
      where: { id: lessonId },
      data: dto,
      select: LESSON_SELECT,
    });

    await this.recomputeCourseDuration(courseId);
    return lesson;
  }

  async deleteLesson(lessonId: string, userId: string) {
    const { courseId } = await this.verifyLessonOwnership(lessonId, userId);

    const lesson = await this.prisma.lesson.update({
      where: { id: lessonId },
      data: { isDeleted: true },
      select: { id: true },
    });

    await this.recomputeCourseDuration(courseId);
    return lesson;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async verifyCourseOwnership(courseId: string, userId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, instructorId: true, isDeleted: true },
    });
    if (!course || course.isDeleted) throw new NotFoundException('Course not found');
    if (course.instructorId !== userId) throw new ForbiddenException('Access denied');
    return course;
  }

  private async verifyChapterOwnership(chapterId: string, userId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: {
        id: true,
        courseId: true,
        isDeleted: true,
        course: { select: { instructorId: true } },
      },
    });
    if (!chapter || chapter.isDeleted) throw new NotFoundException('Chapter not found');
    if (chapter.course.instructorId !== userId) throw new ForbiddenException('Access denied');
    return chapter;
  }

  private async verifyLessonOwnership(lessonId: string, userId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        isDeleted: true,
        chapter: {
          select: {
            courseId: true,
            course: { select: { instructorId: true } },
          },
        },
      },
    });
    if (!lesson || lesson.isDeleted) throw new NotFoundException('Lesson not found');
    if (lesson.chapter.course.instructorId !== userId)
      throw new ForbiddenException('Access denied');
    return { courseId: lesson.chapter.courseId };
  }

  private async recomputeCourseDuration(courseId: string) {
    const lessons = await this.prisma.lesson.findMany({
      where: { chapter: { courseId }, isDeleted: false },
      select: { duration: true },
    });
    const total = lessons.reduce((sum, l) => sum + l.duration, 0);
    await this.prisma.course.update({
      where: { id: courseId },
      data: { duration: total },
    });
  }

  private async uniqueSlug(base: string): Promise<string> {
    const existing = await this.prisma.course.findUnique({
      where: { slug: base },
    });
    if (!existing) return base;
    const suffix = randomBytes(2).toString('hex');
    return `${base}-${suffix}`;
  }
}

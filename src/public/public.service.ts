import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

const PUBLIC_COURSE_LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  shortDescription: true,
  thumbnail: true,
  level: true,
  language: true,
  pricingType: true,
  price: true,
  currency: true,
  duration: true,
  publishedAt: true,
  category: { select: { id: true, name: true, slug: true } },
  instructor: { select: { id: true, firstName: true, lastName: true, image: true } },
  _count: {
    select: {
      chapters: { where: { isDeleted: false } },
      enrollments: true,
    },
  },
};

@Injectable()
export class PublicCoursesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    categorySlug?: string;
    level?: string;
    pricingType?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const { categorySlug, level, pricingType, search, limit = 20, offset = 0 } = params;

    const where: any = {
      status: 'PUBLISHED',
      isDeleted: false,
    };

    if (categorySlug) {
      where.category = { slug: categorySlug };
    }
    if (level) {
      where.level = level;
    }
    if (pricingType) {
      where.pricingType = pricingType;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { shortDescription: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [courses, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        select: PUBLIC_COURSE_LIST_SELECT,
        orderBy: { publishedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.course.count({ where }),
    ]);

    return { courses, total, limit, offset };
  }

  async findBySlug(slug: string) {
    const course = await this.prisma.course.findUnique({
      where: { slug, status: 'PUBLISHED', isDeleted: false },
      select: {
        id: true,
        title: true,
        slug: true,
        shortDescription: true,
        description: true,
        thumbnail: true,
        previewVideo: true,
        level: true,
        language: true,
        pricingType: true,
        price: true,
        currency: true,
        duration: true,
        tags: true,
        learningOutcomes: true,
        requirements: true,
        targetAudience: true,
        publishedAt: true,
        category: { select: { id: true, name: true, slug: true } },
        instructor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            image: true,
            bio: true,
          },
        },
        _count: {
          select: {
            enrollments: true,
            chapters: { where: { isDeleted: false } },
          },
        },
        chapters: {
          where: { isDeleted: false },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            shortDescription: true,
            isFree: true,
            order: true,
            lessons: {
              where: { isDeleted: false },
              orderBy: { order: 'asc' },
              select: {
                id: true,
                title: true,
                duration: true,
                isFree: true,
                // videoUrl only for free lessons
                videoUrl: true,
              },
            },
          },
        },
      },
    });

    if (!course) throw new NotFoundException('Course not found');

    // Hide videoUrl for paid lessons
    const chaptersWithAccess = course.chapters.map((chapter) => ({
      ...chapter,
      lessons: chapter.lessons.map((lesson) => ({
        ...lesson,
        videoUrl: lesson.isFree ? lesson.videoUrl : null,
      })),
    }));

    return { ...course, chapters: chaptersWithAccess };
  }
}

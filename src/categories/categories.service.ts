import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import slugify from 'slugify';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.courseCategory.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, icon: true },
    });
  }

  async create(dto: CreateCategoryDto) {
    const slug = slugify(dto.name, { lower: true, strict: true });

    const existing = await this.prisma.courseCategory.findUnique({
      where: { slug },
    });
    if (existing) throw new ConflictException('Category already exists');

    return this.prisma.courseCategory.create({
      data: { name: dto.name, slug, icon: dto.icon },
    });
  }
}

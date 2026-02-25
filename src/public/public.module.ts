import { Module } from '@nestjs/common';
import { PublicCoursesController } from './public.controller';
import { PublicCoursesService } from './public.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [PublicCoursesController],
  providers: [PublicCoursesService, PrismaService],
})
export class PublicModule {}

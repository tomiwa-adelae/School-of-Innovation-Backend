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
import { CoursesService } from './courses.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { ReorderItemsDto } from './dto/reorder-items.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  // ─── Admin ──────────────────────────────────────────────────────────────────

  @Get('admin/courses')
  adminFindAll(@CurrentUser() user: any, @Query('status') status?: string) {
    if (user.role !== 'ADMINISTRATOR') throw new ForbiddenException();
    return this.coursesService.findAllForAdmin(status);
  }

  @Get('admin/courses/:id')
  adminFindOne(@CurrentUser() user: any, @Param('id') id: string) {
    if (user.role !== 'ADMINISTRATOR') throw new ForbiddenException();
    return this.coursesService.adminFindOne(id);
  }

  @Patch('admin/courses/:id/approve')
  adminApprove(@CurrentUser() user: any, @Param('id') id: string) {
    if (user.role !== 'ADMINISTRATOR') throw new ForbiddenException();
    return this.coursesService.approveCourse(id);
  }

  @Patch('admin/courses/:id/reject')
  adminReject(@CurrentUser() user: any, @Param('id') id: string) {
    if (user.role !== 'ADMINISTRATOR') throw new ForbiddenException();
    return this.coursesService.rejectCourse(id);
  }

  @Patch('admin/courses/:id/archive')
  adminArchive(@CurrentUser() user: any, @Param('id') id: string) {
    if (user.role !== 'ADMINISTRATOR') throw new ForbiddenException();
    return this.coursesService.archiveCourse(id);
  }

  // ─── Courses ────────────────────────────────────────────────────────────────

  @Post('courses')
  create(@CurrentUser() user: any, @Body() dto: CreateCourseDto) {
    return this.coursesService.create(user.id, dto);
  }

  @Get('courses/my')
  findMyCourses(@CurrentUser() user: any) {
    return this.coursesService.findMyCourses(user.id);
  }

  @Get('courses/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.coursesService.findOne(id, user.id);
  }

  @Patch('courses/:id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.coursesService.update(id, user.id, dto);
  }

  @Delete('courses/:id')
  softDelete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.coursesService.softDelete(id, user.id);
  }

  @Patch('courses/:id/publish')
  publish(@Param('id') id: string, @CurrentUser() user: any) {
    return this.coursesService.publish(id, user.id);
  }

  // ─── Chapters ───────────────────────────────────────────────────────────────

  @Post('courses/:courseId/chapters')
  createChapter(
    @Param('courseId') courseId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateChapterDto,
  ) {
    return this.coursesService.createChapter(courseId, user.id, dto);
  }

  @Patch('courses/:courseId/chapters/reorder')
  reorderChapters(
    @Param('courseId') courseId: string,
    @CurrentUser() user: any,
    @Body() dto: ReorderItemsDto,
  ) {
    return this.coursesService.reorderChapters(courseId, user.id, dto);
  }

  @Patch('chapters/:id')
  updateChapter(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateChapterDto,
  ) {
    return this.coursesService.updateChapter(id, user.id, dto);
  }

  @Delete('chapters/:id')
  deleteChapter(@Param('id') id: string, @CurrentUser() user: any) {
    return this.coursesService.deleteChapter(id, user.id);
  }

  // ─── Lessons ────────────────────────────────────────────────────────────────

  @Post('chapters/:chapterId/lessons')
  createLesson(
    @Param('chapterId') chapterId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateLessonDto,
  ) {
    return this.coursesService.createLesson(chapterId, user.id, dto);
  }

  @Patch('chapters/:chapterId/lessons/reorder')
  reorderLessons(
    @Param('chapterId') chapterId: string,
    @CurrentUser() user: any,
    @Body() dto: ReorderItemsDto,
  ) {
    return this.coursesService.reorderLessons(chapterId, user.id, dto);
  }

  @Patch('lessons/:id')
  updateLesson(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.coursesService.updateLesson(id, user.id, dto);
  }

  @Delete('lessons/:id')
  deleteLesson(@Param('id') id: string, @CurrentUser() user: any) {
    return this.coursesService.deleteLesson(id, user.id);
  }
}

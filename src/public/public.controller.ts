import { Controller, Get, Param, Query } from '@nestjs/common';
import { PublicCoursesService } from './public.service';
import { Public } from 'src/decorators/public.decorator';

@Controller('public')
@Public()
export class PublicCoursesController {
  constructor(private readonly service: PublicCoursesService) {}

  @Get('courses')
  findAll(
    @Query('category') categorySlug?: string,
    @Query('level') level?: string,
    @Query('pricingType') pricingType?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.findAll({
      categorySlug,
      level,
      pricingType,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('courses/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }
}

import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UploadService } from './upload.service';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('presigned-url')
  getPresignedUrl(@Body() dto: PresignedUrlDto) {
    return this.uploadService.getPresignedUrl(
      dto.filename,
      dto.contentType,
      dto.folder,
    );
  }
}

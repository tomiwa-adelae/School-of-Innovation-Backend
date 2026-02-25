import { IsIn, IsString } from 'class-validator';

export class PresignedUrlDto {
  @IsString()
  filename: string;

  @IsString()
  contentType: string;

  @IsIn(['thumbnails', 'videos', 'resources', 'previews'])
  folder: 'thumbnails' | 'videos' | 'resources' | 'previews';
}

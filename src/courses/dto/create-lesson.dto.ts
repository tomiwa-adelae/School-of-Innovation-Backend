import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateLessonDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  title: string;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  shortDescription?: string;

  @IsString()
  @IsOptional()
  description?: string; // TipTap JSON (notes / transcript)

  @IsString()
  @IsOptional()
  videoUrl?: string;

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  duration?: number; // seconds

  @IsBoolean()
  @IsOptional()
  isFree?: boolean;

  @IsBoolean()
  @IsOptional()
  isDownloadable?: boolean;
}

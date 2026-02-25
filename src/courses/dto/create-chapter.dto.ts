import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateChapterDto {
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
  description?: string; // TipTap JSON string

  @IsBoolean()
  @IsOptional()
  isFree?: boolean;
}

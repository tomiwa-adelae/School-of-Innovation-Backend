import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CompleteOnboardingDto {
  @IsString()
  @IsIn(['USER', 'INSTRUCTOR'], {
    message: 'Role must be either USER or INSTRUCTOR',
  })
  role: 'USER' | 'INSTRUCTOR';

  @IsString()
  @IsOptional()
  @MinLength(7, { message: 'Phone number too short' })
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Bio must not exceed 500 characters' })
  bio?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  interests?: string[];
}

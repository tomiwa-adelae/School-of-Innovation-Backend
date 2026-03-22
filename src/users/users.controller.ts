import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { TokenPayload } from 'src/auth/token.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Complete onboarding — any authenticated user */
  @Patch('onboarding')
  completeOnboarding(
    @CurrentUser() user: any,
    @Body() dto: CompleteOnboardingDto,
  ) {
    return this.usersService.completeOnboarding(user.id, dto);
  }

  /** Admin: list all users with optional filters */
  @Get()
  findAll(
    @CurrentUser() user: TokenPayload,
    @Query('role') role?: string,
    @Query('instructorStatus') instructorStatus?: string,
  ) {
    if (user.role !== 'ADMINISTRATOR') {
      throw new ForbiddenException('Admin access required');
    }
    return this.usersService.findAll({ role, instructorStatus });
  }

  /** Admin: get dashboard stats */
  @Get('stats')
  getStats(@CurrentUser() user: TokenPayload) {
    if (user.role !== 'ADMINISTRATOR') {
      throw new ForbiddenException('Admin access required');
    }
    return this.usersService.getDashboardStats();
  }

  /** Admin: approve instructor */
  @Patch(':id/approve')
  approveInstructor(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
  ) {
    if (user.role !== 'ADMINISTRATOR') {
      throw new ForbiddenException('Admin access required');
    }
    return this.usersService.updateInstructorStatus(id, 'APPROVED');
  }

  /** Admin: reject instructor */
  @Patch(':id/reject')
  rejectInstructor(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    if (user.role !== 'ADMINISTRATOR') {
      throw new ForbiddenException('Admin access required');
    }
    return this.usersService.updateInstructorStatus(id, 'REJECTED');
  }
}

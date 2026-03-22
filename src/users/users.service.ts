import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { notDeleted } from 'src/utils/prismaFilters';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async completeOnboarding(
    userId: string,
    dto: CompleteOnboardingDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, ...notDeleted() },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.onboardingCompleted) {
      throw new BadRequestException('Onboarding already completed');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: dto.role,
        onboardingCompleted: true,
        instructorStatus: dto.role === 'INSTRUCTOR' ? 'PENDING' : null,
        phoneNumber: dto.phoneNumber,
        bio: dto.bio,
        interests: dto.interests ?? [],
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
        image: true,
        phoneNumber: true,
        bio: true,
        interests: true,
        role: true,
        onboardingCompleted: true,
        instructorStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { user: updated, message: 'Onboarding completed successfully' };
  }

  async findAll(params?: { role?: string; instructorStatus?: string }) {
    return this.prisma.user.findMany({
      where: {
        ...notDeleted(),
        ...(params?.role ? { role: params.role } : {}),
        ...(params?.instructorStatus
          ? { instructorStatus: params.instructorStatus }
          : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
        image: true,
        role: true,
        onboardingCompleted: true,
        instructorStatus: true,
        bio: true,
        interests: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateInstructorStatus(
    userId: string,
    status: 'APPROVED' | 'REJECTED',
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, ...notDeleted() },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.role !== 'INSTRUCTOR') {
      throw new BadRequestException('User is not an instructor');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { instructorStatus: status },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        instructorStatus: true,
      },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, ...notDeleted() },
    });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.dob !== undefined && { dob: dto.dob }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
        image: true,
        phoneNumber: true,
        gender: true,
        dob: true,
        city: true,
        state: true,
        country: true,
        address: true,
        bio: true,
        interests: true,
        role: true,
        onboardingCompleted: true,
        instructorStatus: true,
        createdAt: true,
      },
    });

    return { user: updated, message: 'Profile updated successfully' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId, ...notDeleted() },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.password) {
      throw new BadRequestException('This account uses social login and has no password to update');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) throw new UnauthorizedException('Current password is incorrect');

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    return { message: 'Password changed successfully' };
  }

  async getDashboardStats() {
    const [totalUsers, totalInstructors, pendingInstructors, approvedInstructors] =
      await Promise.all([
        this.prisma.user.count({ where: { ...notDeleted(), role: 'USER' } }),
        this.prisma.user.count({ where: { ...notDeleted(), role: 'INSTRUCTOR' } }),
        this.prisma.user.count({
          where: { ...notDeleted(), role: 'INSTRUCTOR', instructorStatus: 'PENDING' },
        }),
        this.prisma.user.count({
          where: { ...notDeleted(), role: 'INSTRUCTOR', instructorStatus: 'APPROVED' },
        }),
      ]);

    return { totalUsers, totalInstructors, pendingInstructors, approvedInstructors };
  }
}

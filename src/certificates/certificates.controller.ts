import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CertificatesService } from './certificates.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/decorators/current-user.decorator';

@Controller('certificates')
@UseGuards(JwtAuthGuard)
export class CertificatesController {
  constructor(private readonly service: CertificatesService) {}

  @Get()
  getMyCertificates(@CurrentUser() user: any) {
    return this.service.getMyCertificates(user.id);
  }

  @Get(':id/download')
  downloadCertificate(
    @CurrentUser() user: any,
    @Param('id') certId: string,
    @Res() res: Response,
  ) {
    return this.service.downloadCertificate(user.id, certId, res);
  }
}

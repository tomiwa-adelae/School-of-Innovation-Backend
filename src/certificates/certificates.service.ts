import { Injectable, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import PDFDocument from 'pdfkit'; // ✅ The correct way for modern TS/PDFKit

@Injectable()
export class CertificatesService {
  constructor(private prisma: PrismaService) {}

  async getMyCertificates(userId: string) {
    return this.prisma.certificate.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnail: true,
            instructor: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async downloadCertificate(userId: string, certId: string, res: Response) {
    const cert = await this.prisma.certificate.findUnique({
      where: { id: certId },
      include: {
        course: {
          select: {
            title: true,
            instructor: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!cert || cert.userId !== userId) {
      throw new NotFoundException('Certificate not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    const studentName = `${user!.firstName} ${user!.lastName}`;
    const courseTitle = cert.course.title;
    const instructorName = `${cert.course.instructor.firstName} ${cert.course.instructor.lastName}`;
    const issuedDate = cert.issuedAt.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="certificate-${cert.certificateNumber}.pdf"`,
    );

    // A4 landscape: 841.89 x 595.28 pt
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
    doc.pipe(res);

    const W = 841.89;
    const H = 595.28;
    const BLUE = '#2563eb';
    const GRAY = '#6b7280';
    const LIGHT_GRAY = '#9ca3af';

    // Top accent bar
    doc.rect(0, 0, W, 8).fill(BLUE);

    // Bottom accent bar
    doc.rect(0, H - 8, W, 8).fill(BLUE);

    // Content area starts at y=80
    let y = 80;

    // Title
    doc
      .font('Helvetica-Bold')
      .fontSize(36)
      .fillColor(BLUE)
      .text('Certificate of Completion', 0, y, { align: 'center', width: W });

    y += 60;

    // Subtitle
    doc
      .font('Helvetica')
      .fontSize(14)
      .fillColor(GRAY)
      .text('This is to certify that', 0, y, { align: 'center', width: W });

    y += 36;

    // Student name
    doc
      .font('Helvetica-Bold')
      .fontSize(28)
      .fillColor('#111827')
      .text(studentName, 0, y, { align: 'center', width: W });

    y += 48;

    // "has successfully completed"
    doc
      .font('Helvetica')
      .fontSize(14)
      .fillColor(GRAY)
      .text('has successfully completed the course', 0, y, {
        align: 'center',
        width: W,
      });

    y += 36;

    // Course title
    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor('#111827')
      .text(courseTitle, 60, y, { align: 'center', width: W - 120 });

    y += 48;

    // Instructor
    doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor(GRAY)
      .text(`Instructed by: ${instructorName}`, 0, y, {
        align: 'center',
        width: W,
      });

    y += 24;

    // Issue date
    doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor(GRAY)
      .text(`Issued on: ${issuedDate}`, 0, y, { align: 'center', width: W });

    // Certificate number — bottom right
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(LIGHT_GRAY)
      .text(`Certificate No: ${cert.certificateNumber}`, W - 220, H - 28, {
        width: 200,
        align: 'right',
      });

    // Brand — bottom left
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor(BLUE)
      .text('School of Innovation', 20, H - 28, { width: 220 });

    doc.end();
  }
}

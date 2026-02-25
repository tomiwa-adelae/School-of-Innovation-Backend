import * as bcrypt from 'bcryptjs';
import { PrismaClient } from 'generated/prisma/client';

const prisma = new PrismaClient({
  accelerateUrl: process.env.PRISMA_ACCELERATE_URL!,
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  const email = 'admin@gmail.com';
  const password = 'Password';

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(
      `Admin user already exists (id: ${existing.id}). Skipping seed.`,
    );
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      username: 'superadmin',
      role: 'ADMINISTRATOR',
      onboardingCompleted: true,
      emailVerified: true,
    },
  });

  await prisma.admin.create({
    data: {
      userId: user.id,
      position: 'SUPER_ADMIN',
    },
  });

  console.log(`✅ Admin user created: ${user.email} (id: ${user.id})`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

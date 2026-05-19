import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the DocAI seed script.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

async function main() {
  const users = [
    { email: 'superadmin@docai.local', displayName: 'Super Admin', role: UserRole.SUPER_ADMIN },
    { email: 'admin@docai.local', displayName: 'Admin User', role: UserRole.ADMIN },
    { email: 'reviewer@docai.local', displayName: 'Reviewer User', role: UserRole.REVIEWER },
    { email: 'analyst@docai.local', displayName: 'Analyst User', role: UserRole.ANALYST },
    { email: 'viewer@docai.local', displayName: 'Viewer User', role: UserRole.VIEWER },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { displayName: user.displayName, role: user.role },
      create: user,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
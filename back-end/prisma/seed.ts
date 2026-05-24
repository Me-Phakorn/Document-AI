import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the DocAI seed script.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `${hash}:${salt}`;
}

async function main() {
  const users: Array<{ username: string; email: string; displayName: string; role: UserRole; passwordHash?: string }> = [
    { username: 'admin', email: 'admin@docai.local', displayName: 'Admin User', role: UserRole.ADMIN, passwordHash: hashPassword('admin') },
    { username: 'superadmin', email: 'superadmin@docai.local', displayName: 'Super Admin', role: UserRole.SUPER_ADMIN },
    { username: 'reviewer', email: 'reviewer@docai.local', displayName: 'Reviewer User', role: UserRole.REVIEWER },
    { username: 'analyst', email: 'analyst@docai.local', displayName: 'Analyst User', role: UserRole.ANALYST },
    { username: 'viewer', email: 'viewer@docai.local', displayName: 'Viewer User', role: UserRole.VIEWER },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { username: user.username, displayName: user.displayName, role: user.role },
      create: user,
    });
  }

  console.log(`Seeded ${users.length} users. Admin login: username=admin password=admin`);
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
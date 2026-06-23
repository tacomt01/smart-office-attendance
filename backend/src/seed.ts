import bcrypt from 'bcryptjs';
import { prisma } from './config/database.js';

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@smartoffice.com' },
    update: {},
    create: {
      email: 'admin@smartoffice.com',
      passwordHash,
      role: 'admin',
    },
  });

  console.log('Seed completed: admin@smartoffice.com / admin123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

import { PrismaClient } from '../../generated/prisma';

let prisma: PrismaClient;

export const getTestPrisma = () => {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL,
        },
      },
    });
  }
  return prisma;
};

export const cleanupDatabase = async () => {
  const testPrisma = getTestPrisma();

  // Delete all leads in reverse order to avoid foreign key constraints
  await testPrisma.lead.deleteMany();
};

export const seedTestData = async () => {
  const testPrisma = getTestPrisma();

  // Create test leads
  const testLeads = [
    {
      name: 'Test User 1',
      email: 'test1@example.com',
      phone: '1234567890',
      notes: 'Test lead 1',
    },
    {
      name: 'Test User 2',
      email: 'test2@example.com',
      phone: '0987654321',
      notes: 'Test lead 2',
    },
  ];

  for (const lead of testLeads) {
    await testPrisma.lead.create({ data: lead });
  }
};

export const closeTestDatabase = async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
};

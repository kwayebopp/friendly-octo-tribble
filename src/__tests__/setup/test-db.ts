import { PrismaClient } from "../../generated/prisma";
import { purgeQueue, dropQueue } from "../../lib/queue";

let prisma: PrismaClient;

export const getTestPrisma = () => {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
};

export const cleanupDatabase = async () => {
  const testPrisma = getTestPrisma();

  // Delete all leads in reverse order to avoid foreign key constraints
  await testPrisma.lead.deleteMany();
};

export const cleanupQueues = async () => {
  try {
    // Get today's date for queue names
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    // List of common queue names to clean up
    const queueNames = [
      `test-drip-messages-${dateStr}`,
      `drip-messages-${dateStr}`,
      // Add more dates if needed (yesterday, tomorrow, etc.)
      `test-drip-messages-${new Date(today.getTime() - 86400000).toISOString().split('T')[0]}`,
      `test-drip-messages-${new Date(today.getTime() + 86400000).toISOString().split('T')[0]}`,
    ];

    // Try to purge and drop each queue with timeout
    const cleanupPromises = queueNames.map(async (queueName) => {
      try {
        // Set a timeout for each operation
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 2000)
        );

        // First try to purge the queue (removes all messages)
        await Promise.race([purgeQueue(queueName), timeoutPromise]);
        console.log(`Purged queue: ${queueName}`);
      } catch (error) {
        // Queue might not exist or timeout, that's okay
        console.log(`Queue ${queueName} not found, already empty, or timeout`);
      }

      try {
        // Set a timeout for drop operation
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 2000)
        );

        // Then try to drop the queue completely
        await Promise.race([dropQueue(queueName), timeoutPromise]);
        console.log(`Dropped queue: ${queueName}`);
      } catch (error) {
        // Queue might not exist or timeout, that's okay
        console.log(`Queue ${queueName} not found, already dropped, or timeout`);
      }
    });

    // Wait for all cleanup operations with a global timeout
    await Promise.race([
      Promise.allSettled(cleanupPromises),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Global timeout')), 10000))
    ]);
  } catch (error) {
    console.error('Error cleaning up queues:', error);
    // Don't throw - queue cleanup is best effort
  }
};

export const seedTestData = async () => {
  const testPrisma = getTestPrisma();

  // Create test leads
  const testLeads = [
    {
      name: "Test User 1",
      email: "test1@example.com",
      phone: "1234567890",
      notes: "Test lead 1",
    },
    {
      name: "Test User 2",
      email: "test2@example.com",
      phone: "0987654321",
      notes: "Test lead 2",
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

import { prisma } from './prisma';
import { readMessagesWithPoll, archiveMessage, dropQueue, createQueue, QueueMessage } from './queue';

let isRunning = false;
let workerInterval: NodeJS.Timeout | null = null;

/**
 * Get today's queue name in format: drip-messages-YYYY-MM-DD
 * In test mode, prefix with "test-"
 */
function getTodayQueueName(): string {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
  const queueName = `drip-messages-${dateStr}`;

  // Prefix with "test-" when in test mode
  if (process.env.NODE_ENV === 'test' || process.env.NEXT_PHASE === 'test') {
    return `test-${queueName}`;
  }

  return queueName;
}

/**
 * Create today's queue if it doesn't exist
 */
async function ensureTodayQueueExists(): Promise<void> {
  try {
    const queueName = getTodayQueueName();
    console.log(`Ensuring queue exists: ${queueName}`);

    await createQueue(queueName);
    console.log(`Queue ${queueName} is ready`);
  } catch (error) {
    console.error('Error creating today\'s queue:', error);
    // Don't throw - queue creation is idempotent, so this might be expected
  }
}

/**
 * Clean up old queues from previous days
 */
async function cleanupOldQueues(): Promise<void> {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Clean up queues from the last 7 days (except today)
    const queueNames = [];
    for (let i = 1; i < 7; i++) {
      const date = new Date(today.getTime() - (i * 86400000)); // i days ago
      const dateStr = date.toISOString().split('T')[0];

      // Add both test and production queue names
      queueNames.push(`drip-messages-${dateStr}`);
      queueNames.push(`test-drip-messages-${dateStr}`);
    }

    console.log('Cleaning up old queues...');

    // Drop each queue (best effort - don't fail if queue doesn't exist)
    const dropPromises = queueNames.map(async (queueName) => {
      try {
        await dropQueue(queueName);
        console.log(`Dropped old queue: ${queueName}`);
      } catch (error) {
        // Queue might not exist, that's okay
        console.log(`Queue ${queueName} not found or already dropped`);
      }
    });

    // Wait for all drops to complete (with timeout)
    await Promise.race([
      Promise.allSettled(dropPromises),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Cleanup timeout')), 10000))
    ]);

    console.log('Old queue cleanup completed');
  } catch (error) {
    console.error('Error cleaning up old queues:', error);
    // Don't throw - cleanup is best effort
  }
}

/**
 * Process a single message with duplicate prevention
 */
async function processMessage(
  queueName: string,
  msgId: string,
  message: QueueMessage
): Promise<void> {
  const { leadId, email, messageNumber, scheduledDate } = message;

  try {
    // Use Prisma transaction for atomic updates
    await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({
        where: { id: leadId }
      });

      if (!lead) {
        console.log(`Lead ${leadId} not found, archiving message`);
        await archiveMessage(queueName, msgId);
        return;
      }

      // Duplicate check: messageCount should be messageNumber - 1
      if (lead.messageCount === messageNumber - 1) {
        // Send message
        console.log(`Sending message #${messageNumber} to ${email} (scheduled for ${scheduledDate})`);

        // Update lead
        const newMessageCount = lead.messageCount + 1;
        const isCompleted = newMessageCount >= lead.maxMessages;

        await tx.lead.update({
          where: { id: leadId },
          data: {
            messageCount: newMessageCount,
            lastSentAt: new Date(),
            nextScheduledFor: isCompleted
              ? null
              : new Date(Date.now() + 86400000), // tomorrow
            status: isCompleted ? 'COMPLETED' : 'ACTIVE'
          }
        });

        if (isCompleted) {
          console.log(`Lead ${email} completed drip campaign (${newMessageCount}/${lead.maxMessages} messages)`);
        }

        // Archive message only after successful DB update
        await archiveMessage(queueName, msgId);
      } else {
        // Already processed by another worker, just archive
        console.log(`Message ${messageNumber} for ${email} already processed (current count: ${lead.messageCount}), archiving`);
        await archiveMessage(queueName, msgId);
      }
    });
  } catch (error) {
    console.error(`Error processing message ${messageNumber} for ${email}:`, error);
    // DO NOT archive message on error - let visibility timeout expire for retry
    throw error;
  }
}

/**
 * Process messages from today's queue
 */
async function processTodayMessages(): Promise<void> {
  const queueName = getTodayQueueName();

  try {
    // Use readMessagesWithPoll for efficient polling
    const messages = await readMessagesWithPoll(queueName, 30, 1);

    if (messages.length === 0) {
      return; // No messages, will poll again
    }

    for (const [msgId, readCt, enqueuedAt, vt, message, extra] of messages) {
      try {
        await processMessage(queueName, msgId, message);

        // Add delay between message sends for spacing
        const delay = parseInt(process.env.WORKER_MESSAGE_DELAY || '2000');
        await new Promise(resolve => setTimeout(resolve, delay));

      } catch (error) {
        console.error(`Failed to process message ${msgId}:`, error);
        // Message will remain in queue due to visibility timeout
      }
    }
  } catch (error) {
    // Handle specific error cases gracefully
    if (error instanceof Error) {
      if (error.message.includes('HTTP error! status: 500')) {
        // Queue doesn't exist yet or PGMQ service is starting up
        console.log(`Queue ${queueName} not ready yet, will retry...`);
        return;
      } else if (error.message.includes('HTTP error! status: 404')) {
        // Queue doesn't exist - this is normal when no leads have been created yet
        console.log(`Queue ${queueName} doesn't exist yet, will retry...`);
        return;
      }
    }

    console.error(`Error reading from queue ${queueName}:`, error);
  }
}

/**
 * Start the drip worker
 */
export async function startWorker(): Promise<void> {
  if (isRunning) {
    console.log('Drip worker is already running');
    return;
  }

  console.log('Starting drip worker...');

  // Clean up old queues first
  await cleanupOldQueues();

  // Create today's queue
  await ensureTodayQueueExists();

  isRunning = true;

  // Process messages immediately, then continue polling
  processTodayMessages().catch((error) => {
    // Handle initial errors gracefully - worker will continue polling
    if (error instanceof Error && error.message.includes('HTTP error! status: 500')) {
      console.log('Queue not ready yet, worker will continue polling...');
    } else {
      console.error('Error in initial message processing:', error);
    }
  });

  // Set up continuous polling
  const pollInterval = parseInt(process.env.WORKER_POLL_INTERVAL || '5000');
  workerInterval = setInterval(async () => {
    if (isRunning) {
      await processTodayMessages();
    }
  }, pollInterval);

  console.log(`Drip worker started - polling every ${pollInterval}ms`);
}

/**
 * Stop the drip worker gracefully
 */
export function stopWorker(): void {
  if (!isRunning) {
    console.log('Drip worker is not running');
    return;
  }

  console.log('Stopping drip worker...');
  isRunning = false;

  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }

  console.log('Drip worker stopped');
}

/**
 * Check if worker is running
 */
export function isWorkerRunning(): boolean {
  return isRunning;
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, stopping drip worker...');
  stopWorker();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, stopping drip worker...');
  stopWorker();
  process.exit(0);
});

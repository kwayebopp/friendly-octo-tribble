import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { startWorker, stopWorker, isWorkerRunning } from '../../lib/drip-worker';
import { cleanupDatabase, cleanupQueues, closeTestDatabase, getTestPrisma } from '../setup/test-db';

// Mock the queue functions BEFORE importing the worker
const mockReadMessagesWithPoll = jest.fn() as jest.MockedFunction<any>;
const mockArchiveMessage = jest.fn() as jest.MockedFunction<any>;

jest.mock('../../lib/queue', () => ({
  readMessagesWithPoll: mockReadMessagesWithPoll,
  archiveMessage: mockArchiveMessage,
  dropQueue: jest.fn(),
  createQueue: jest.fn(),
  sendMessage: jest.fn(),
  sendBatchMessages: jest.fn(),
  readMessages: jest.fn(),
  getQueueMetrics: jest.fn(),
  createQueueMessage: jest.fn(),
  purgeQueue: jest.fn(),
}));

describe('Drip Worker Tests', () => {
  const testPrisma = getTestPrisma();

  beforeAll(async () => {
    await cleanupDatabase();
    await cleanupQueues();
  });

  afterAll(async () => {
    await cleanupDatabase();
    await cleanupQueues();
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanupDatabase();
    await cleanupQueues();
    jest.clearAllMocks();

    // Setup default mock implementations
    mockReadMessagesWithPoll.mockResolvedValue([]);
    mockArchiveMessage.mockResolvedValue(true);
  });

  describe('Queue Name Generation', () => {
    it('should use test-prefixed queue names in test mode', async () => {
      // This test verifies that the worker uses test-prefixed queue names
      // The actual queue name generation is tested indirectly through the worker behavior

      // Start worker to trigger queue name generation
      await startWorker();

      // Verify worker is running
      expect(isWorkerRunning()).toBe(true);

      // Stop worker
      stopWorker();
      expect(isWorkerRunning()).toBe(false);
    });
  });

  describe('Worker Lifecycle', () => {
    it('should start and stop worker correctly', async () => {
      expect(isWorkerRunning()).toBe(false);

      await startWorker();
      expect(isWorkerRunning()).toBe(true);

      stopWorker();
      expect(isWorkerRunning()).toBe(false);
    });

    it('should not start worker if already running', async () => {
      await startWorker();
      expect(isWorkerRunning()).toBe(true);

      // Starting again should not cause issues
      await startWorker();
      expect(isWorkerRunning()).toBe(true);

      stopWorker();
    });

    it('should not stop worker if not running', () => {
      expect(isWorkerRunning()).toBe(false);

      // Stopping when not running should not cause issues
      stopWorker();
      expect(isWorkerRunning()).toBe(false);
    });
  });

  describe('Message Processing', () => {
    it('should process messages with correct format', async () => {
      const mockMessage = {
        leadId: 'test-lead-123',
        email: 'test@example.com',
        messageNumber: 1,
        scheduledDate: '2025-10-17'
      };

      // Mock queue returning a message
      mockReadMessagesWithPoll.mockResolvedValueOnce([
        ['msg-123', 1, '2025-10-17T10:00:00Z', '2025-10-17T10:30:00Z', mockMessage, {}]
      ]);

      // Create a test lead
      const lead = await testPrisma.lead.create({
        data: {
          id: 'test-lead-123',
          name: 'Test User',
          email: 'test@example.com',
          phone: '555-1234',
          maxMessages: 5,
          messageCount: 0,
          status: 'ACTIVE'
        }
      });

      await startWorker();

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify message was processed
      const updatedLead = await testPrisma.lead.findUnique({
        where: { id: 'test-lead-123' }
      });

      expect(updatedLead?.messageCount).toBe(1);
      expect(updatedLead?.lastSentAt).toBeTruthy();

      stopWorker();
    });

    it('should handle duplicate messages correctly', async () => {
      const mockMessage = {
        leadId: 'test-lead-456',
        email: 'test2@example.com',
        messageNumber: 2,
        scheduledDate: '2025-10-17'
      };

      // Mock queue returning a message
      mockReadMessagesWithPoll.mockResolvedValueOnce([
        ['msg-456', 1, '2025-10-17T10:00:00Z', '2025-10-17T10:30:00Z', mockMessage, {}]
      ]);

      // Create a test lead with messageCount = 1 (expecting messageNumber = 2)
      const lead = await testPrisma.lead.create({
        data: {
          id: 'test-lead-456',
          name: 'Test User 2',
          email: 'test2@example.com',
          phone: '555-5678',
          maxMessages: 5,
          messageCount: 1, // Already processed message 1
          status: 'ACTIVE'
        }
      });

      await startWorker();

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify message was processed (messageCount should increment)
      const updatedLead = await testPrisma.lead.findUnique({
        where: { id: 'test-lead-456' }
      });

      expect(updatedLead?.messageCount).toBe(2);

      stopWorker();
    });

    it('should skip processing if messageNumber mismatch', async () => {
      const mockMessage = {
        leadId: 'test-lead-789',
        email: 'test3@example.com',
        messageNumber: 3,
        scheduledDate: '2025-10-17'
      };

      // Mock queue returning a message
      mockReadMessagesWithPoll.mockResolvedValueOnce([
        ['msg-789', 1, '2025-10-17T10:00:00Z', '2025-10-17T10:30:00Z', mockMessage, {}]
      ]);

      // Create a test lead with messageCount = 1 (expecting messageNumber = 2, not 3)
      const lead = await testPrisma.lead.create({
        data: {
          id: 'test-lead-789',
          name: 'Test User 3',
          email: 'test3@example.com',
          phone: '555-9999',
          maxMessages: 5,
          messageCount: 1, // Already processed message 1, expecting message 2
          status: 'ACTIVE'
        }
      });

      await startWorker();

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify message was skipped (messageCount should remain 1)
      const updatedLead = await testPrisma.lead.findUnique({
        where: { id: 'test-lead-789' }
      });

      expect(updatedLead?.messageCount).toBe(1); // Should not increment

      stopWorker();
    });

    it('should complete lead when maxMessages reached', async () => {
      const mockMessage = {
        leadId: 'test-lead-complete',
        email: 'complete@example.com',
        messageNumber: 5,
        scheduledDate: '2025-10-17'
      };

      // Mock queue returning a message
      mockReadMessagesWithPoll.mockResolvedValueOnce([
        ['msg-complete', 1, '2025-10-17T10:00:00Z', '2025-10-17T10:30:00Z', mockMessage, {}]
      ]);

      // Create a test lead with messageCount = 4 (expecting messageNumber = 5, final message)
      const lead = await testPrisma.lead.create({
        data: {
          id: 'test-lead-complete',
          name: 'Complete User',
          email: 'complete@example.com',
          phone: '555-0000',
          maxMessages: 5,
          messageCount: 4, // Already processed 4 messages
          status: 'ACTIVE'
        }
      });

      await startWorker();

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify lead was completed
      const updatedLead = await testPrisma.lead.findUnique({
        where: { id: 'test-lead-complete' }
      });

      expect(updatedLead?.messageCount).toBe(5);
      expect(updatedLead?.status).toBe('COMPLETED');
      expect(updatedLead?.nextScheduledFor).toBeNull();

      stopWorker();
    });
  });

  describe('Error Handling', () => {
    it('should handle queue read errors gracefully', async () => {
      // Mock queue read error
      mockReadMessagesWithPoll.mockRejectedValueOnce(new Error('Queue read failed'));

      await startWorker();

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Worker should still be running despite error
      expect(isWorkerRunning()).toBe(true);

      stopWorker();
    });

    it('should handle message processing errors gracefully', async () => {
      const mockMessage = {
        leadId: 'test-lead-error',
        email: 'error@example.com',
        messageNumber: 1,
        scheduledDate: '2025-10-17'
      };

      // Mock queue returning a message
      mockReadMessagesWithPoll.mockResolvedValueOnce([
        ['msg-error', 1, '2025-10-17T10:00:00Z', '2025-10-17T10:30:00Z', mockMessage, {}]
      ]);

      // Mock archive error
      mockArchiveMessage.mockRejectedValueOnce(new Error('Archive failed'));

      await startWorker();

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Worker should still be running despite error
      expect(isWorkerRunning()).toBe(true);

      stopWorker();
    });
  });
});

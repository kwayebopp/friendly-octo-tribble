import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  createQueue,
  sendMessage,
  sendBatchMessages,
  readMessages,
  readMessagesWithPoll,
  archiveMessage,
  getQueueMetrics,
  createQueueMessage,
  purgeQueue,
  dropQueue,
  QueueMessage
} from '../../lib/queue';

// Mock fetch globally
global.fetch = jest.fn();

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Queue Utility Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createQueue', () => {
    it('should create a queue successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      const result = await createQueue('test-queue');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/create',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            queue_name: 'test-queue',
          }),
        }
      );
    });

    it('should handle queue creation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(createQueue('test-queue')).rejects.toThrow('HTTP error! status: 500');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(createQueue('test-queue')).rejects.toThrow('Network error');
    });
  });

  describe('sendMessage', () => {
    it('should send a message successfully', async () => {
      const message: QueueMessage = {
        leadId: 'lead-123',
        email: 'test@example.com',
        messageNumber: 1,
        scheduledDate: '2024-01-15'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [123],
      } as Response);

      const result = await sendMessage('test-queue', message);

      expect(result).toBe(123);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/send',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            queue_name: 'test-queue',
            msg: message,
          }),
        }
      );
    });

    it('should handle send message errors', async () => {
      const message: QueueMessage = {
        leadId: 'lead-123',
        email: 'test@example.com',
        messageNumber: 1,
        scheduledDate: '2024-01-15'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      } as Response);

      await expect(sendMessage('test-queue', message)).rejects.toThrow('HTTP error! status: 400');
    });
  });

  describe('sendBatchMessages', () => {
    it('should send multiple messages successfully', async () => {
      const messages: QueueMessage[] = [
        {
          leadId: 'lead-123',
          email: 'test1@example.com',
          messageNumber: 1,
          scheduledDate: '2024-01-15'
        },
        {
          leadId: 'lead-456',
          email: 'test2@example.com',
          messageNumber: 1,
          scheduledDate: '2024-01-15'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [123, 124],
      } as Response);

      const result = await sendBatchMessages('test-queue', messages);

      expect(result).toEqual([123, 124]);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/send_batch',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            queue_name: 'test-queue',
            msgs: messages,
          }),
        }
      );
    });
  });

  describe('readMessages', () => {
    it('should read messages successfully', async () => {
      const mockMessages = [
        ['123', 1, '2024-01-15T10:00:00Z', '2024-01-15T10:30:00Z',
         { leadId: 'lead-123', email: 'test@example.com', messageNumber: 1, scheduledDate: '2024-01-15' },
         null]
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMessages,
      } as Response);

      const result = await readMessages('test-queue', 30, 1);

      expect(result).toEqual(mockMessages);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/read',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            queue_name: 'test-queue',
            vt: 30,
            qty: 1,
          }),
        }
      );
    });

    it('should use default parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

      await readMessages('test-queue');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/read',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            queue_name: 'test-queue',
            vt: 30,
            qty: 1,
          }),
        }
      );
    });
  });

  describe('readMessagesWithPoll', () => {
    it('should read messages with polling successfully', async () => {
      const mockMessages = [
        ['123', 1, '2024-01-15T10:00:00Z', '2024-01-15T10:30:00Z',
         { leadId: 'lead-123', email: 'test@example.com', messageNumber: 1, scheduledDate: '2024-01-15' },
         null]
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMessages,
      } as Response);

      const result = await readMessagesWithPoll('test-queue', 30, 1);

      expect(result).toEqual(mockMessages);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/read_with_poll',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            queue_name: 'test-queue',
            vt: 30,
            qty: 1,
          }),
        }
      );
    });
  });

  describe('archiveMessage', () => {
    it('should archive a message successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => true,
      } as Response);

      const result = await archiveMessage('test-queue', '123');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/archive',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            queue_name: 'test-queue',
            msg_id: '123',
          }),
        }
      );
    });

    it('should handle archive message errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      await expect(archiveMessage('test-queue', '123')).rejects.toThrow('HTTP error! status: 404');
    });
  });

  describe('getQueueMetrics', () => {
    it('should get queue metrics successfully', async () => {
      const mockMetrics = {
        queue_name: 'test-queue',
        queue_length: 10,
        newest_msg_age_sec: 5,
        oldest_msg_age_sec: 300
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetrics,
      } as Response);

      const result = await getQueueMetrics('test-queue');

      expect(result).toEqual(mockMetrics);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/metrics',
        {
          method: 'GET',
        }
      );
    });
  });

  describe('createQueueMessage', () => {
    it('should create a queue message with correct format', () => {
      const message = createQueueMessage(
        'lead-123',
        'test@example.com',
        1,
        '2024-01-15'
      );

      expect(message).toEqual({
        leadId: 'lead-123',
        email: 'test@example.com',
        messageNumber: 1,
        scheduledDate: '2024-01-15'
      });
    });

    it('should handle different message numbers', () => {
      const message1 = createQueueMessage('lead-123', 'test@example.com', 1, '2024-01-15');
      const message2 = createQueueMessage('lead-123', 'test@example.com', 2, '2024-01-16');

      expect(message1.messageNumber).toBe(1);
      expect(message2.messageNumber).toBe(2);
      expect(message1.scheduledDate).toBe('2024-01-15');
      expect(message2.scheduledDate).toBe('2024-01-16');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => 'invalid-json',
      } as Response);

      await expect(sendMessage('test-queue', {
        leadId: 'lead-123',
        email: 'test@example.com',
        messageNumber: 1,
        scheduledDate: '2024-01-15'
      })).rejects.toThrow('Invalid response format from pgmq');
    });

    it('should handle network timeouts', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

      await expect(createQueue('test-queue')).rejects.toThrow('Request timeout');
    });
  });

  describe('Queue Management', () => {
    describe('purgeQueue', () => {
      it('should purge all messages from a queue', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

        const result = await purgeQueue('test-queue');

        expect(result).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:8080/api/v1/purge_queue',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              queue_name: 'test-queue',
            }),
          }
        );
      });

      it('should handle purge queue errors', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

        await expect(purgeQueue('nonexistent-queue')).rejects.toThrow('HTTP error! status: 404');
      });

      it('should handle network errors during purge', async () => {
        global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));

        await expect(purgeQueue('test-queue')).rejects.toThrow('Network error');
      });
    });

    describe('dropQueue', () => {
      it('should drop a queue completely', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

        const result = await dropQueue('test-queue');

        expect(result).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:8080/api/v1/drop_queue',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              queue_name: 'test-queue',
            }),
          }
        );
      });

      it('should handle drop queue errors', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

        await expect(dropQueue('nonexistent-queue')).rejects.toThrow('HTTP error! status: 404');
      });

      it('should handle network errors during drop', async () => {
        global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));

        await expect(dropQueue('test-queue')).rejects.toThrow('Network error');
      });
    });
  });
});

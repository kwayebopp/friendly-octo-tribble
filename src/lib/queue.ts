/**
 * Queue utility for interacting with pgmq-rest API
 * Documentation: https://github.com/eichenroth/pgmq-rest
 */

const PGMQ_BASE_URL = process.env.PGMQ_URL || 'http://localhost:8080/api/v1';

export interface QueueMessage {
  leadId: string;
  email: string;
  messageNumber: number;
  scheduledDate: string;
}

export interface PGMQResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Create a queue
 * @param queueName - Name of the queue to create
 * @returns Promise<boolean> - Success status
 */
export async function createQueue(queueName: string): Promise<boolean> {
  try {
    const response = await fetch(`${PGMQ_BASE_URL}/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queue_name: queueName,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Queue creation returns no body, just check if request was successful
    return response.ok;
  } catch (error) {
    console.error('Error creating queue:', error);
    throw error;
  }
}

/**
 * Send a single message to the queue
 * @param queueName - Name of the queue
 * @param message - Message payload
 * @returns Promise<number> - Message ID
 */
export async function sendMessage(queueName: string, message: QueueMessage): Promise<number> {
  try {
    const response = await fetch(`${PGMQ_BASE_URL}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queue_name: queueName,
        msg: message,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    // pgmq-rest returns an array with the message ID
    if (Array.isArray(result) && result.length > 0) {
      return result[0];
    }

    throw new Error('Invalid response format from pgmq');
  } catch (error) {
    console.error('Error sending message to queue:', error);
    throw error;
  }
}

/**
 * Send multiple messages to the queue in a batch
 * @param queueName - Name of the queue
 * @param messages - Array of message payloads
 * @returns Promise<number[]> - Array of message IDs
 */
export async function sendBatchMessages(queueName: string, messages: QueueMessage[]): Promise<number[]> {
  try {
    const response = await fetch(`${PGMQ_BASE_URL}/send_batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queue_name: queueName,
        msgs: messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    // pgmq-rest returns an array with message IDs
    if (Array.isArray(result)) {
      return result;
    }

    throw new Error('Invalid response format from pgmq');
  } catch (error) {
    console.error('Error sending batch messages to queue:', error);
    throw error;
  }
}

/**
 * Read messages from the queue
 * @param queueName - Name of the queue
 * @param visibilityTimeout - Visibility timeout in seconds (default: 30)
 * @param quantity - Number of messages to read (default: 1)
 * @returns Promise<Array> - Array of message data
 */
export async function readMessages(
  queueName: string,
  visibilityTimeout: number = 30,
  quantity: number = 1
): Promise<Array<[string, number, string, string, QueueMessage, any]>> {
  try {
    const response = await fetch(`${PGMQ_BASE_URL}/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queue_name: queueName,
        vt: visibilityTimeout,
        qty: quantity,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    // pgmq-rest returns an array of messages
    // Format: [msg_id, read_ct, enqueued_at, vt, message, headers]
    if (Array.isArray(result)) {
      return result;
    }

    throw new Error('Invalid response format from pgmq');
  } catch (error) {
    console.error('Error reading messages from queue:', error);
    throw error;
  }
}

/**
 * Read messages with polling (waits for messages if queue is empty)
 * @param queueName - Name of the queue
 * @param visibilityTimeout - Visibility timeout in seconds (default: 30)
 * @param quantity - Number of messages to read (default: 1)
 * @returns Promise<Array> - Array of message data
 */
export async function readMessagesWithPoll(
  queueName: string,
  visibilityTimeout: number = 30,
  quantity: number = 1
): Promise<Array<[string, number, string, string, QueueMessage, any]>> {
  try {
    const response = await fetch(`${PGMQ_BASE_URL}/read_with_poll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queue_name: queueName,
        vt: visibilityTimeout,
        qty: quantity,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    // pgmq-rest returns an array of messages
    // Format: [msg_id, read_ct, enqueued_at, vt, message, headers]
    if (Array.isArray(result)) {
      return result;
    }

    throw new Error('Invalid response format from pgmq');
  } catch (error) {
    console.error('Error reading messages with poll from queue:', error);
    throw error;
  }
}

/**
 * Archive a message (remove it from the queue after processing)
 * @param queueName - Name of the queue
 * @param messageId - ID of the message to archive
 * @returns Promise<boolean> - Success status
 */
export async function archiveMessage(queueName: string, messageId: string): Promise<boolean> {
  try {
    const response = await fetch(`${PGMQ_BASE_URL}/archive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queue_name: queueName,
        msg_id: messageId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result === true || result === 'true';
  } catch (error) {
    console.error('Error archiving message from queue:', error);
    throw error;
  }
}

/**
 * Get queue metrics
 * @param queueName - Name of the queue
 * @returns Promise<object> - Queue metrics
 */
export async function getQueueMetrics(queueName: string): Promise<any> {
  try {
    const response = await fetch(`${PGMQ_BASE_URL}/metrics`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting queue metrics:', error);
    throw error;
  }
}

/**
 * Helper function to create a queue message
 * @param leadId - Lead ID
 * @param email - Lead email
 * @param messageNumber - Message number in sequence
 * @param scheduledDate - Date when message should be sent
 * @returns QueueMessage
 */
export function createQueueMessage(
  leadId: string,
  email: string,
  messageNumber: number,
  scheduledDate: string
): QueueMessage {
  return {
    leadId,
    email,
    messageNumber,
    scheduledDate,
  };
}

/**
 * Purge all messages from a queue
 */
export async function purgeQueue(queueName: string): Promise<boolean> {
  try {
    const response = await fetch(`${PGMQ_BASE_URL}/purge_queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queue_name: queueName,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.ok;
  } catch (error) {
    console.error('Error purging queue:', error);
    throw error;
  }
}

/**
 * Drop a queue completely
 */
export async function dropQueue(queueName: string): Promise<boolean> {
  try {
    const response = await fetch(`${PGMQ_BASE_URL}/drop_queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queue_name: queueName,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.ok;
  } catch (error) {
    console.error('Error dropping queue:', error);
    throw error;
  }
}

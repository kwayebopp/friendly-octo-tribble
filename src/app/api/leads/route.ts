import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createQueue, sendMessage, createQueueMessage } from "@/lib/queue";

const leadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Invalid email format"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  notes: z.string().optional(),
});

// Get daily max from environment variable
const DAILY_MAX = parseInt(process.env.DAILY_MAX || "100");

/**
 * Get the number of messages already sent today across all leads
 */
async function getTodayMessageCount(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const count = await prisma.lead.count({
    where: {
      lastSentAt: {
        gte: today,
        lt: tomorrow,
      },
    },
  });

  return count;
}

/**
 * Find the next available day with capacity for a message
 */
async function findNextAvailableDay(startDate: Date = new Date()): Promise<Date> {
  let currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);

  // Check up to 30 days in the future
  for (let i = 0; i < 30; i++) {
    const dayStart = new Date(currentDate);
    const dayEnd = new Date(currentDate);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const messageCount = await prisma.lead.count({
      where: {
        lastSentAt: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
    });

    if (messageCount < DAILY_MAX) {
      return currentDate;
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // If no capacity found in 30 days, return the 30th day
  return currentDate;
}

/**
 * Get queue name for a specific date
 * In test mode, prefix with "test-"
 */
function getQueueNameForDate(date: Date): string {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
  const queueName = `drip-messages-${dateStr}`;

  // Prefix with "test-" when in test mode
  if (process.env.NODE_ENV === 'test' || process.env.NEXT_PHASE === 'test') {
    return `test-${queueName}`;
  }

  return queueName;
}

/**
 * Schedule lead messages across multiple days
 */
async function scheduleLeadMessages(lead: any): Promise<void> {
  const today = new Date();
  const maxMessages = lead.maxMessages || 5;

  // Schedule messages for each day
  for (let messageNumber = 1; messageNumber <= maxMessages; messageNumber++) {
    const scheduledDate = new Date(today);
    scheduledDate.setDate(scheduledDate.getDate() + messageNumber - 1);

    // Find next available day with capacity
    const availableDate = await findNextAvailableDay(scheduledDate);
    const queueName = getQueueNameForDate(availableDate);

    // Ensure queue exists
    await createQueue(queueName);

    // Create message
    const message = createQueueMessage(
      lead.id,
      lead.email,
      messageNumber,
      availableDate.toISOString().split('T')[0]
    );

    // Send message to queue
    await sendMessage(queueName, message);

    console.log(`Scheduled message ${messageNumber} for ${lead.email} on ${availableDate.toISOString().split('T')[0]}`);
  }

  // Update lead with next scheduled date
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: "ACTIVE",
      nextScheduledFor: today,
    },
  });
}

function handleZodError(error: z.ZodError): Response {
  return NextResponse.json(
    {
      success: false,
      message: "Validation failed",
      errors: error.issues,
    },
    { status: 400 }
  );
}

function handleDBError(error: Error): Response {
  let message = "There was an error saving this data";

  if (error.message.includes("email")) {
    if (error.message.includes("Unique constraint"))
      message = "The email address is already in use.";
  } else if (error.message.includes("phone")) {
    if (error.message.includes("Unique constraint"))
      message = "The phone number is already in use";
  }

  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status: 422 }
  );
}

function handleTeapot({ message }: Error): Response {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status: 418 }
  );
}

function handleError(error: z.ZodError | Error): Response {
  console.error("Error processing lead:", error);
  if (error instanceof z.ZodError) return handleZodError(error);
  if (error instanceof Error) {
    if (error.message === "I'm a teapot. No coffee for you!")
      return handleTeapot(error);
    return handleDBError(error);
  }

  return NextResponse.json(
    {
      success: false,
      message: "Internal server error",
    },
    { status: 500 }
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();

    // Validate the request body
    const validatedData = leadSchema.parse(body);

    if (validatedData.notes?.toLocaleLowerCase().includes("coffee")) {
      throw new Error("I'm a teapot. No coffee for you!");
    }

    // Save to database
    const lead = await prisma.lead.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        phone: validatedData.phone,
        notes: validatedData.notes,
        maxMessages: 5, // Default to 5 messages
        messageCount: 0,
        status: "ACTIVE",
      },
    });

    console.log("New lead saved to database:", lead);

    // Schedule messages across multiple days
    try {
      await scheduleLeadMessages(lead);
      console.log(`Successfully scheduled ${lead.maxMessages} messages for ${lead.email}`);
    } catch (scheduleError) {
      console.error("Error scheduling messages:", scheduleError);
      // Don't fail the lead creation if scheduling fails
      // The lead is still created and can be processed later
    }

    return NextResponse.json(
      {
        success: true,
        message: "Lead submitted successfully",
        data: {
          id: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          notes: lead.notes,
          maxMessages: lead.maxMessages,
          status: lead.status,
          createdAt: lead.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return handleError(error);
  }
}

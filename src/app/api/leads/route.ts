import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma"

const leadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Invalid email format"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  notes: z.string().optional(),
});

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
      },
    });

    console.log("New lead saved to database:", lead);

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
          createdAt: lead.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return handleError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createPublicForm, getPublicForms } from "@/lib/services/public-forms";
import { z } from "zod";

const createPublicFormSchema = z.object({
  templateId: z.string().uuid("Invalid template ID"),
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional().nullable(),
  confirmationMessage: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const forms = await getPublicForms(session.user.id);
    return NextResponse.json({ forms });
  } catch (error) {
    console.error("[GET /api/public-forms]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createPublicFormSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const form = await createPublicForm(session.user.id, parsed.data);
    return NextResponse.json({ form }, { status: 201 });
  } catch (error: unknown) {
    console.error("[POST /api/public-forms]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create public form" },
      { status: 400 }
    );
  }
}

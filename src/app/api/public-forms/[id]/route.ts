import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getPublicFormById,
  updatePublicForm,
  updatePublicFormStatus,
} from "@/lib/services/public-forms";
import { z } from "zod";

const updatePublicFormSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  confirmationMessage: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "EXPIRED", "ARCHIVED"]).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const form = await getPublicFormById(session.user.id, id);

    if (!form) {
      return NextResponse.json({ error: "Public form not found" }, { status: 404 });
    }

    return NextResponse.json({ form });
  } catch (error) {
    console.error("[GET /api/public-forms/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = updatePublicFormSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await updatePublicForm(session.user.id, id, parsed.data);
    return NextResponse.json({ form: updated });
  } catch (error: unknown) {
    console.error("[PATCH /api/public-forms/[id]]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update public form" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const archived = await updatePublicFormStatus(session.user.id, id, "ARCHIVED");

    return NextResponse.json({ success: true, form: archived });
  } catch (error: unknown) {
    console.error("[DELETE /api/public-forms/[id]]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to archive public form" },
      { status: 400 }
    );
  }
}

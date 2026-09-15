import { NextRequest, NextResponse } from "next/server";
import { submitPublicForm } from "@/lib/services/public-forms";
import { z } from "zod";

const submitPublicFormSchema = z.object({
  signerName: z.string().optional(),
  signerEmail: z.string().email("Valid email address is required"),
  roleInputs: z
    .array(
      z.object({
        roleId: z.string().uuid(),
        email: z.string().email(),
        name: z.string().optional(),
      })
    )
    .optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await req.json();
    const parsed = submitPublicFormSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || undefined;

    const result = await submitPublicForm({
      publicToken: token,
      signerName: parsed.data.signerName,
      signerEmail: parsed.data.signerEmail,
      roleInputs: parsed.data.roleInputs,
      ip,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    console.error("[POST /api/public/forms/[token]/submit]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit public form" },
      { status: 400 }
    );
  }
}

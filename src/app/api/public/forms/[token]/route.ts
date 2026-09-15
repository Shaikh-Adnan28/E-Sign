import { NextRequest, NextResponse } from "next/server";
import { getPublicFormByToken } from "@/lib/services/public-forms";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const lookup = await getPublicFormByToken(token);

    if (!lookup.form && lookup.reason === "NOT_FOUND") {
      return NextResponse.json({ error: "Public form not found" }, { status: 404 });
    }

    return NextResponse.json({
      form: lookup.form,
      isAvailable: lookup.isAvailable,
      reason: lookup.reason,
      roles: lookup.roles || [],
    });
  } catch (error) {
    console.error("[GET /api/public/forms/[token]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

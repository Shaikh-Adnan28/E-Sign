import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPublicFormSubmissions } from "@/lib/services/public-forms";

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
    const submissions = await getPublicFormSubmissions(session.user.id, id);
    return NextResponse.json({ submissions });
  } catch (error: unknown) {
    console.error("[GET /api/public-forms/[id]/submissions]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch form submissions" },
      { status: 400 }
    );
  }
}

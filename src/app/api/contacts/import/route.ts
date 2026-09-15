import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { importContactsCsv } from "@/lib/services/contacts";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
    }

    const text = await file.text();
    const result = await importContactsCsv(session.user.id, text);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/contacts/import]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

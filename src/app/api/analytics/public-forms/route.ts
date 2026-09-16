import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPublicFormAnalytics, DateRangePreset } from "@/lib/services/analytics";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const preset = (searchParams.get("preset") || searchParams.get("range") || "30d") as DateRangePreset;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const publicForms = await getPublicFormAnalytics(session.user.id, {
      preset,
      startDate,
      endDate,
    });

    return NextResponse.json({ publicForms });
  } catch (error: unknown) {
    console.error("[GET /api/analytics/public-forms]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch public form analytics" },
      { status: 500 }
    );
  }
}

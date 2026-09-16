import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRecentActivity } from "@/lib/services/analytics";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "15", 10);

    const activity = await getRecentActivity(session.user.id, limit);

    return NextResponse.json({ activity });
  } catch (error: unknown) {
    console.error("[GET /api/analytics/recent-activity]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch recent activity" },
      { status: 500 }
    );
  }
}

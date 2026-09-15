import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { templates, templateRoles } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";

const createRoleSchema = z.object({
  roleName: z.string().min(1, "Role name is required").max(100).trim(),
  order: z.number().int().min(1).optional().default(1),
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

    const [template] = await db
      .select({ id: templates.id })
      .from(templates)
      .where(and(eq(templates.id, id), eq(templates.ownerId, session.user.id)))
      .limit(1);

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const roles = await db
      .select()
      .from(templateRoles)
      .where(eq(templateRoles.templateId, id))
      .orderBy(asc(templateRoles.order));

    return NextResponse.json(roles);
  } catch (err) {
    console.error("[GET /api/templates/[id]/roles]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [template] = await db
      .select({ id: templates.id })
      .from(templates)
      .where(and(eq(templates.id, id), eq(templates.ownerId, session.user.id)))
      .limit(1);

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = createRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [role] = await db
      .insert(templateRoles)
      .values({
        templateId: id,
        roleName: parsed.data.roleName,
        order: parsed.data.order,
      })
      .returning();

    return NextResponse.json(role, { status: 201 });
  } catch (err) {
    console.error("[POST /api/templates/[id]/roles]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

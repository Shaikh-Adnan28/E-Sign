import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { templates, templateRoles, templateFields } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { MOCK_TEMPLATES } from "@/lib/mock-dashboard-data";
import { storageProvider } from "@/lib/storage";

const patchTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
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
      .select()
      .from(templates)
      .where(and(eq(templates.id, id), eq(templates.ownerId, session.user.id)))
      .limit(1);

    if (!template) {
      // Dev mock fallback
      if (id.startsWith("mock-tmpl-") || process.env.NODE_ENV !== "production") {
        const mock = MOCK_TEMPLATES.find((m) => m.id === id) || MOCK_TEMPLATES[0];
        return NextResponse.json(mock);
      }
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const [roles, fields] = await Promise.all([
      db.select().from(templateRoles).where(eq(templateRoles.templateId, id)).orderBy(templateRoles.order),
      db.select().from(templateFields).where(eq(templateFields.templateId, id)),
    ]);

    return NextResponse.json({
      ...template,
      roles,
      fields,
    });
  } catch (err) {
    console.error("[GET /api/templates/[id]]", err);
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
    const parsed = patchTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.id, id), eq(templates.ownerId, session.user.id)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(templates)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(templates.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/templates/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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

    const [existing] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.id, id), eq(templates.ownerId, session.user.id)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Delete PDF from storage if exists
    await storageProvider.delete(existing.storageKey).catch(() => {});

    await db.delete(templates).where(eq(templates.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/templates/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

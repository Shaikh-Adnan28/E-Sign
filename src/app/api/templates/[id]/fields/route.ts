import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { templates, templateFields } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const fieldSchema = z.object({
  roleId: z.string().uuid().nullable().optional(),
  type: z.enum(["SIGNATURE", "INITIALS", "TEXT", "DATE", "CHECKBOX"]),
  pageNumber: z.number().int().min(1),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0.01).max(1),
  height: z.number().min(0.01).max(1),
  required: z.boolean().optional().default(true),
  placeholder: z.string().optional(),
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

    const fields = await db
      .select()
      .from(templateFields)
      .where(eq(templateFields.templateId, id));

    return NextResponse.json(fields);
  } catch (err) {
    console.error("[GET /api/templates/[id]/fields]", err);
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

    // Check if bulk sync payload (array of fields)
    if (Array.isArray(body)) {
      // Delete existing fields for this template and insert new ones
      await db.delete(templateFields).where(eq(templateFields.templateId, id));

      const fieldsToInsert = body.map((f) => ({
        templateId: id,
        roleId: f.roleId || null,
        type: f.type,
        pageNumber: f.pageNumber,
        x: String(f.x),
        y: String(f.y),
        width: String(f.width),
        height: String(f.height),
        required: f.required ?? true,
        placeholder: f.placeholder || null,
      }));

      const inserted = fieldsToInsert.length > 0
        ? await db.insert(templateFields).values(fieldsToInsert).returning()
        : [];

      return NextResponse.json(inserted, { status: 200 });
    }

    const parsed = fieldSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const [field] = await db
      .insert(templateFields)
      .values({
        templateId: id,
        roleId: data.roleId || null,
        type: data.type,
        pageNumber: data.pageNumber,
        x: String(data.x),
        y: String(data.y),
        width: String(data.width),
        height: String(data.height),
        required: data.required,
        placeholder: data.placeholder || null,
      })
      .returning();

    return NextResponse.json(field, { status: 201 });
  } catch (err) {
    console.error("[POST /api/templates/[id]/fields]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

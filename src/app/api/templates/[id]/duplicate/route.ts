import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { templates, templateRoles, templateFields } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { storageProvider } from "@/lib/storage";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [sourceTemplate] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.id, id), eq(templates.ownerId, session.user.id)))
      .limit(1);

    if (!sourceTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const [sourceRoles, sourceFields] = await Promise.all([
      db.select().from(templateRoles).where(eq(templateRoles.templateId, id)).orderBy(asc(templateRoles.order)),
      db.select().from(templateFields).where(eq(templateFields.templateId, id)),
    ]);

    // 1. Create duplicate template record
    const [newTemplate] = await db
      .insert(templates)
      .values({
        ownerId: session.user.id,
        name: `${sourceTemplate.name} (Copy)`,
        description: sourceTemplate.description,
        filename: sourceTemplate.filename,
        storageKey: "templates/temp/placeholder.pdf",
        pageCount: sourceTemplate.pageCount,
        usageCount: 0,
        status: "ACTIVE",
      })
      .returning();

    // 2. Duplicate storage file
    const newStorageKey = `templates/${newTemplate.id}/original.pdf`;
    const sourceExists = await storageProvider.exists(sourceTemplate.storageKey);
    if (sourceExists) {
      const pdfBytes = await storageProvider.download(sourceTemplate.storageKey);
      await storageProvider.upload(pdfBytes, newStorageKey);
    }

    await db
      .update(templates)
      .set({ storageKey: newStorageKey })
      .where(eq(templates.id, newTemplate.id));

    // 3. Duplicate roles & map IDs
    const roleIdMap = new Map<string, string>();
    const newRoles = [];
    for (const r of sourceRoles) {
      const [newRole] = await db
        .insert(templateRoles)
        .values({
          templateId: newTemplate.id,
          roleName: r.roleName,
          order: r.order,
        })
        .returning();
      roleIdMap.set(r.id, newRole.id);
      newRoles.push(newRole);
    }

    // 4. Duplicate fields
    const newFields = [];
    for (const f of sourceFields) {
      const mappedRoleId = f.roleId ? roleIdMap.get(f.roleId) ?? null : null;
      const [newField] = await db
        .insert(templateFields)
        .values({
          templateId: newTemplate.id,
          roleId: mappedRoleId,
          type: f.type,
          pageNumber: f.pageNumber,
          x: String(f.x),
          y: String(f.y),
          width: String(f.width),
          height: String(f.height),
          required: f.required,
          placeholder: f.placeholder,
        })
        .returning();
      newFields.push(newField);
    }

    return NextResponse.json(
      {
        ...newTemplate,
        storageKey: newStorageKey,
        roles: newRoles,
        fields: newFields,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/templates/[id]/duplicate]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

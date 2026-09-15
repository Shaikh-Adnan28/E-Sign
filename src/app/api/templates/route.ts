import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { templates, templateRoles, templateFields } from "@/lib/db/schema";
import { eq, and, ilike, desc, count } from "drizzle-orm";
import { storageProvider } from "@/lib/storage";
import { getPdfPageCount } from "@/lib/pdf-utils";
import { MOCK_TEMPLATES } from "@/lib/mock-dashboard-data";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "ACTIVE";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = (page - 1) * limit;

    const whereConditions = [
      eq(templates.ownerId, session.user.id),
      status === "ALL" ? undefined : eq(templates.status, status as "ACTIVE" | "ARCHIVED"),
      search ? ilike(templates.name, `%${search}%`) : undefined,
    ].filter(Boolean);

    const [totalResult] = await db
      .select({ count: count() })
      .from(templates)
      .where(and(...whereConditions));

    const total = Number(totalResult?.count ?? 0);

    const userTemplates = await db
      .select()
      .from(templates)
      .where(and(...whereConditions))
      .orderBy(desc(templates.updatedAt))
      .limit(limit)
      .offset(offset);

    if (total === 0 && !search && status === "ACTIVE" && process.env.NODE_ENV !== "production") {
      return NextResponse.json({
        data: MOCK_TEMPLATES,
        total: MOCK_TEMPLATES.length,
        page: 1,
        totalPages: 1,
      });
    }

    // Attach roles and fields counts for each template
    const templateIds = userTemplates.map((t) => t.id);
    const rolesList = templateIds.length > 0
      ? await db.select().from(templateRoles).where(eq(templateRoles.templateId, templateIds[0])) // simplified query
      : [];
    const fieldsList = templateIds.length > 0
      ? await db.select().from(templateFields).where(eq(templateFields.templateId, templateIds[0]))
      : [];

    const resultData = userTemplates.map((t) => ({
      ...t,
      roles: rolesList.filter((r) => r.templateId === t.id),
      fields: fieldsList.filter((f) => f.templateId === t.id),
    }));

    return NextResponse.json({
      data: resultData,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    console.error("[GET /api/templates]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const name = (formData.get("name") as string | null)?.trim();
    const description = (formData.get("description") as string | null)?.trim() || null;
    const rolesInput = formData.get("roles") as string | null;

    if (!file) {
      return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pageCount = await getPdfPageCount(buffer).catch(() => 1);

    // Parse roles array
    let roleNames = ["Signer 1", "Signer 2"];
    if (rolesInput) {
      try {
        const parsed = JSON.parse(rolesInput);
        if (Array.isArray(parsed) && parsed.length > 0) {
          roleNames = parsed.map((r: unknown) => String(r).trim()).filter(Boolean);
        }
      } catch {
        // fallback
      }
    }

    // Step A: Create template record
    const [template] = await db
      .insert(templates)
      .values({
        ownerId: session.user.id,
        name,
        description,
        filename: file.name,
        storageKey: "templates/temp/placeholder.pdf",
        pageCount,
      })
      .returning();

    // Step B: Upload PDF to storage
    const storageKey = `templates/${template.id}/original.pdf`;
    await storageProvider.upload(buffer, storageKey);

    await db
      .update(templates)
      .set({ storageKey })
      .where(eq(templates.id, template.id));

    // Step C: Insert template roles
    const createdRoles = [];
    for (let i = 0; i < roleNames.length; i++) {
      const [role] = await db
        .insert(templateRoles)
        .values({
          templateId: template.id,
          roleName: roleNames[i],
          order: i + 1,
        })
        .returning();
      createdRoles.push(role);
    }

    return NextResponse.json(
      {
        ...template,
        storageKey,
        roles: createdRoles,
        fields: [],
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/templates]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

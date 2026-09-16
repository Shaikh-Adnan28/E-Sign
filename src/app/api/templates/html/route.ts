import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { templates, templateRoles } from "@/lib/db/schema";
import { storageProvider } from "@/lib/storage";
import { getPdfPageCount } from "@/lib/pdf-utils";
import { sanitizeUserHtml } from "@/lib/html-sanitizer";
import { generatePdfFromHtml } from "@/lib/html-to-pdf";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, htmlSource, htmlCss, variables, roles } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }
    if (!htmlSource || typeof htmlSource !== "string") {
      return NextResponse.json({ error: "HTML source is required" }, { status: 400 });
    }

    const sanitizedHtml = sanitizeUserHtml(htmlSource);
    const sanitizedCss = sanitizeUserHtml(htmlCss || ""); // sanitize css lightly
    const vars = variables || {};
    const roleNames = Array.isArray(roles) && roles.length > 0 ? roles.map(String) : ["Signer 1"];

    // Generate PDF from HTML
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await generatePdfFromHtml(sanitizedHtml, sanitizedCss, vars);
    } catch (pdfErr) {
      console.error("PDF Generation failed:", pdfErr);
      return NextResponse.json({ error: "Failed to generate PDF from HTML" }, { status: 500 });
    }

    const pageCount = await getPdfPageCount(pdfBuffer).catch(() => 1);

    // Create template record
    const [template] = await db
      .insert(templates)
      .values({
        ownerId: session.user.id,
        name: name.trim(),
        description: description?.trim() || null,
        filename: `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
        storageKey: "templates/temp/placeholder.pdf",
        pageCount,
        isHtmlTemplate: true,
        htmlSource: sanitizedHtml,
        htmlCss: sanitizedCss,
        variablesConfig: vars,
      })
      .returning();

    // Upload PDF to storage
    const storageKey = `templates/${template.id}/original.pdf`;
    await storageProvider.upload(pdfBuffer, storageKey);

    await db
      .update(templates)
      .set({ storageKey })
      .where(eq(templates.id, template.id));

    // Insert template roles
    const createdRoles = [];
    for (let i = 0; i < roleNames.length; i++) {
      const [role] = await db
        .insert(templateRoles)
        .values({
          templateId: template.id,
          roleName: roleNames[i].trim(),
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
    console.error("[POST /api/templates/html]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

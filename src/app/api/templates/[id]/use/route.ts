import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  templates,
  templateRoles,
  templateFields,
  envelopes,
  documents,
  signers,
  signatureFields,
  auditEvents,
} from "@/lib/db/schema";
import { eq, and, sql, asc } from "drizzle-orm";
import { storageProvider } from "@/lib/storage";
import { generateSigningToken } from "@/lib/tokens";
import { z } from "zod";

const useTemplateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  recipients: z.array(
    z.object({
      roleId: z.string().uuid(),
      email: z.string().email(),
      name: z.string().optional(),
    })
  ).min(1, "At least one recipient is required"),
});

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
    const body = await req.json();
    const parsed = useTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [template] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.id, id), eq(templates.ownerId, session.user.id)))
      .limit(1);

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const [tRoles, tFields] = await Promise.all([
      db.select().from(templateRoles).where(eq(templateRoles.templateId, id)).orderBy(asc(templateRoles.order)),
      db.select().from(templateFields).where(eq(templateFields.templateId, id)),
    ]);

    const envelopeTitle = parsed.data.title?.trim() || template.name;

    // 1. Create Envelope record
    const [envelope] = await db
      .insert(envelopes)
      .values({
        ownerId: session.user.id,
        title: envelopeTitle,
        status: "DRAFT",
      })
      .returning();

    // 2. Create Document record & copy storage PDF
    const [doc] = await db
      .insert(documents)
      .values({
        envelopeId: envelope.id,
        filename: template.filename,
        storageKey: `documents/temp/placeholder.pdf`,
        pageCount: template.pageCount,
      })
      .returning();

    const newDocStorageKey = `documents/${doc.id}/original.pdf`;
    const templatePdfExists = await storageProvider.exists(template.storageKey);
    if (templatePdfExists) {
      const pdfBytes = await storageProvider.download(template.storageKey);
      await storageProvider.upload(pdfBytes, newDocStorageKey);
    }

    await db
      .update(documents)
      .set({ storageKey: newDocStorageKey })
      .where(eq(documents.id, doc.id));

    // 3. Map recipients to template roles and create Signers
    const roleToSignerIdMap = new Map<string, string>();
    const recipientInputMap = new Map(parsed.data.recipients.map((r) => [r.roleId, r]));

    for (const role of tRoles) {
      const recipientData = recipientInputMap.get(role.id);
      if (recipientData) {
        const token = generateSigningToken();
        const [signer] = await db
          .insert(signers)
          .values({
            envelopeId: envelope.id,
            email: recipientData.email,
            name: recipientData.name || null,
            token,
            order: role.order,
            status: "PENDING",
          })
          .returning();
        roleToSignerIdMap.set(role.id, signer.id);
      }
    }

    // 4. Instantiate Signature Fields from Template Fields
    const fieldsToInsert = tFields.map((tf) => {
      const assignedSignerId = tf.roleId ? roleToSignerIdMap.get(tf.roleId) ?? null : null;
      return {
        documentId: doc.id,
        signerId: assignedSignerId,
        type: tf.type,
        pageNumber: tf.pageNumber,
        x: String(tf.x),
        y: String(tf.y),
        width: String(tf.width),
        height: String(tf.height),
        required: tf.required,
      };
    });

    if (fieldsToInsert.length > 0) {
      await db.insert(signatureFields).values(fieldsToInsert);
    }

    // 5. Increment usage count
    await db
      .update(templates)
      .set({
        usageCount: sql`${templates.usageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(templates.id, template.id));

    // 6. Audit
    await db.insert(auditEvents).values({
      envelopeId: envelope.id,
      event: "DOCUMENT_CREATED",
      actor: session.user.email ?? session.user.id,
      meta: { templateId: template.id, templateName: template.name },
    });

    return NextResponse.json(
      {
        success: true,
        envelopeId: envelope.id,
        documentId: doc.id,
        redirectUrl: `/dashboard/documents/${envelope.id}`,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/templates/[id]/use]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

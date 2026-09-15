import { db } from "@/lib/db";
import {
  publicForms,
  publicFormSubmissions,
  templates,
  templateRoles,
  templateFields,
  envelopes,
  documents,
  signers,
  signatureFields,
  auditEvents,
  contacts,
  PublicForm,
} from "@/lib/db/schema";
import { eq, and, sql, desc, asc } from "drizzle-orm";
import { storageProvider } from "@/lib/storage";
import { generateSigningToken } from "@/lib/tokens";
import { findDuplicateContact, recordContactUsage } from "./contacts";
import crypto from "crypto";

export interface CreatePublicFormInput {
  templateId: string;
  name: string;
  description?: string | null;
  confirmationMessage?: string | null;
  expiresAt?: Date | string | null;
}

export interface UpdatePublicFormInput {
  name?: string;
  description?: string | null;
  confirmationMessage?: string | null;
  expiresAt?: Date | string | null;
  status?: "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED" | "ARCHIVED";
}

export interface SubmitPublicFormInput {
  publicToken: string;
  signerName?: string;
  signerEmail: string;
  roleInputs?: Array<{
    roleId: string;
    email: string;
    name?: string;
  }>;
  ip?: string;
}

/**
 * Generate a random 16-byte hex token for shareable public form links.
 */
export function generatePublicFormToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Create a new public form from an existing template.
 */
export async function createPublicForm(
  ownerId: string,
  input: CreatePublicFormInput
): Promise<PublicForm> {
  const [template] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, input.templateId), eq(templates.ownerId, ownerId)))
    .limit(1);

  if (!template) {
    throw new Error("Template not found or access denied");
  }

  const token = generatePublicFormToken();
  const expiresAtDate = input.expiresAt ? new Date(input.expiresAt) : null;

  const [form] = await db
    .insert(publicForms)
    .values({
      ownerId,
      templateId: input.templateId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      confirmationMessage: input.confirmationMessage?.trim() || null,
      token,
      status: "ACTIVE",
      expiresAt: expiresAtDate,
    })
    .returning();

  return form;
}

/**
 * List all public forms for an owner with template details.
 */
export async function getPublicForms(ownerId: string) {
  const rows = await db
    .select({
      id: publicForms.id,
      name: publicForms.name,
      description: publicForms.description,
      token: publicForms.token,
      status: publicForms.status,
      confirmationMessage: publicForms.confirmationMessage,
      submissionsCount: publicForms.submissionsCount,
      expiresAt: publicForms.expiresAt,
      createdAt: publicForms.createdAt,
      updatedAt: publicForms.updatedAt,
      templateId: publicForms.templateId,
      templateName: templates.name,
      pageCount: templates.pageCount,
    })
    .from(publicForms)
    .innerJoin(templates, eq(publicForms.templateId, templates.id))
    .where(and(eq(publicForms.ownerId, ownerId), sql`${publicForms.status} != 'ARCHIVED'`))
    .orderBy(desc(publicForms.createdAt));

  return rows;
}

/**
 * Fetch details of a single public form for an owner.
 */
export async function getPublicFormById(ownerId: string, id: string) {
  const [form] = await db
    .select({
      id: publicForms.id,
      ownerId: publicForms.ownerId,
      templateId: publicForms.templateId,
      name: publicForms.name,
      description: publicForms.description,
      token: publicForms.token,
      status: publicForms.status,
      confirmationMessage: publicForms.confirmationMessage,
      submissionsCount: publicForms.submissionsCount,
      expiresAt: publicForms.expiresAt,
      createdAt: publicForms.createdAt,
      updatedAt: publicForms.updatedAt,
      templateName: templates.name,
    })
    .from(publicForms)
    .innerJoin(templates, eq(publicForms.templateId, templates.id))
    .where(and(eq(publicForms.id, id), eq(publicForms.ownerId, ownerId)))
    .limit(1);

  if (!form) return null;

  const roles = await db
    .select()
    .from(templateRoles)
    .where(eq(templateRoles.templateId, form.templateId))
    .orderBy(asc(templateRoles.order));

  return { ...form, roles };
}

/**
 * Update public form details.
 */
export async function updatePublicForm(
  ownerId: string,
  id: string,
  input: UpdatePublicFormInput
): Promise<PublicForm> {
  const updates: Partial<PublicForm> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.description !== undefined) updates.description = input.description?.trim() || null;
  if (input.confirmationMessage !== undefined) updates.confirmationMessage = input.confirmationMessage?.trim() || null;
  if (input.expiresAt !== undefined) updates.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (input.status !== undefined) updates.status = input.status;

  const [updated] = await db
    .update(publicForms)
    .set(updates)
    .where(and(eq(publicForms.id, id), eq(publicForms.ownerId, ownerId)))
    .returning();

  if (!updated) {
    throw new Error("Public form not found or update failed");
  }

  return updated;
}

/**
 * Toggle status of a public form.
 */
export async function updatePublicFormStatus(
  ownerId: string,
  id: string,
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED" | "ARCHIVED"
): Promise<PublicForm> {
  return updatePublicForm(ownerId, id, { status });
}

/**
 * Fetch public form metadata for unauthenticated public self-service link.
 */
export async function getPublicFormByToken(publicToken: string) {
  const [form] = await db
    .select({
      id: publicForms.id,
      name: publicForms.name,
      description: publicForms.description,
      token: publicForms.token,
      status: publicForms.status,
      confirmationMessage: publicForms.confirmationMessage,
      expiresAt: publicForms.expiresAt,
      templateId: publicForms.templateId,
      templateName: templates.name,
      pageCount: templates.pageCount,
    })
    .from(publicForms)
    .innerJoin(templates, eq(publicForms.templateId, templates.id))
    .where(eq(publicForms.token, publicToken))
    .limit(1);

  if (!form) {
    return { form: null, isAvailable: false, reason: "NOT_FOUND" as const };
  }

  const now = new Date();
  const isExpiredByTime = form.expiresAt && new Date(form.expiresAt) < now;
  const status = isExpiredByTime ? "EXPIRED" : form.status;

  if (status !== "ACTIVE") {
    return {
      form,
      isAvailable: false,
      reason: status as "PAUSED" | "EXPIRED" | "ARCHIVED" | "DRAFT",
    };
  }

  const roles = await db
    .select()
    .from(templateRoles)
    .where(eq(templateRoles.templateId, form.templateId))
    .orderBy(asc(templateRoles.order));

  return {
    form,
    isAvailable: true,
    roles,
  };
}

/**
 * Submit a public form:
 * 1. Creates an Envelope + Document (copying template storage PDF).
 * 2. Creates Signers + SignatureFields.
 * 3. Sets Envelope & Signer status to SENT for immediate self-service signing.
 * 4. Records submission and increments count.
 * 5. Auto-adds/updates contact.
 * 6. Returns signing token for direct redirect to /sign/[signingToken].
 */
export async function submitPublicForm(input: SubmitPublicFormInput) {
  const lookup = await getPublicFormByToken(input.publicToken);
  if (!lookup.isAvailable || !lookup.form) {
    throw new Error(`Public form is unavailable: ${lookup.reason || "NOT_FOUND"}`);
  }

  const form = lookup.form;

  // Fetch full public form record to get ownerId
  const [fullForm] = await db
    .select()
    .from(publicForms)
    .where(eq(publicForms.id, form.id))
    .limit(1);

  if (!fullForm) {
    throw new Error("Public form owner not found");
  }

  const [template] = await db
    .select()
    .from(templates)
    .where(eq(templates.id, form.templateId))
    .limit(1);

  if (!template) {
    throw new Error("Template not found");
  }

  const [tRoles, tFields] = await Promise.all([
    db.select().from(templateRoles).where(eq(templateRoles.templateId, form.templateId)).orderBy(asc(templateRoles.order)),
    db.select().from(templateFields).where(eq(templateFields.templateId, form.templateId)),
  ]);

  const mainSignerName = input.signerName?.trim() || null;
  const mainSignerEmail = input.signerEmail.trim().toLowerCase();

  // 1. Create Envelope record (status = SENT for immediate signing)
  const envelopeTitle = `${form.name} - ${mainSignerName || mainSignerEmail}`;
  const [envelope] = await db
    .insert(envelopes)
    .values({
      ownerId: fullForm.ownerId,
      title: envelopeTitle,
      status: "SENT",
    })
    .returning();

  // 2. Create Document record & copy template PDF bytes
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

  // 3. Map template roles to signers
  const roleToSignerIdMap = new Map<string, string>();
  let primarySigningToken = "";

  const roleInputsMap = new Map(
    (input.roleInputs || []).map((r) => [r.roleId, r])
  );

  if (tRoles.length === 0) {
    // If template has no predefined roles, create a default signer
    const token = generateSigningToken();
    primarySigningToken = token;
    const [signer] = await db
      .insert(signers)
      .values({
        envelopeId: envelope.id,
        email: mainSignerEmail,
        name: mainSignerName,
        token,
        order: 1,
        status: "SENT",
      })
      .returning();

    // All fields map to this signer
    for (const tf of tFields) {
      if (tf.roleId) {
        roleToSignerIdMap.set(tf.roleId, signer.id);
      }
    }
  } else {
    for (let index = 0; index < tRoles.length; index++) {
      const role = tRoles[index];
      const roleInput = roleInputsMap.get(role.id);

      const email = roleInput?.email?.trim().toLowerCase() || (index === 0 ? mainSignerEmail : "");
      const name = roleInput?.name?.trim() || (index === 0 ? mainSignerName : null);

      if (!email) {
        throw new Error(`Email address required for role '${role.roleName}'`);
      }

      const token = generateSigningToken();
      if (index === 0) {
        primarySigningToken = token;
      }

      const [signer] = await db
        .insert(signers)
        .values({
          envelopeId: envelope.id,
          email,
          name,
          token,
          order: role.order,
          status: "SENT",
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

  // 5. Create Public Form Submission record
  const [submission] = await db
    .insert(publicFormSubmissions)
    .values({
      publicFormId: form.id,
      envelopeId: envelope.id,
      status: "STARTED",
    })
    .returning();

  // 6. Increment submissions count on publicForms & template usage count
  await Promise.all([
    db
      .update(publicForms)
      .set({
        submissionsCount: sql`${publicForms.submissionsCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(publicForms.id, form.id)),
    db
      .update(templates)
      .set({
        usageCount: sql`${templates.usageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(templates.id, form.templateId)),
  ]);

  // 7. Auto-upsert Contact for ownerId
  try {
    const existingContact = await findDuplicateContact(fullForm.ownerId, mainSignerEmail);
    if (existingContact) {
      await recordContactUsage(existingContact.id, fullForm.ownerId);
    } else {
      await db.insert(contacts).values({
        ownerId: fullForm.ownerId,
        name: mainSignerName || mainSignerEmail.split("@")[0],
        email: mainSignerEmail,
        usageCount: 1,
        lastUsedAt: new Date(),
      });
    }
  } catch (err) {
    console.error("[submitPublicForm] Contact auto-save warning:", err);
  }

  // 8. Audit trail logging
  await db.insert(auditEvents).values({
    envelopeId: envelope.id,
    event: "PUBLIC_FORM_SUBMITTED",
    actor: mainSignerEmail,
    meta: {
      publicFormId: form.id,
      publicFormName: form.name,
      submissionId: submission.id,
    },
    ip: input.ip || null,
  });

  return {
    success: true,
    signingToken: primarySigningToken,
    envelopeId: envelope.id,
    submissionId: submission.id,
    confirmationMessage: form.confirmationMessage,
  };
}

/**
 * List all submissions for a public form.
 */
export async function getPublicFormSubmissions(ownerId: string, publicFormId: string) {
  // Ensure owner owns the public form
  const [form] = await db
    .select()
    .from(publicForms)
    .where(and(eq(publicForms.id, publicFormId), eq(publicForms.ownerId, ownerId)))
    .limit(1);

  if (!form) {
    throw new Error("Public form not found or access denied");
  }

  const submissions = await db
    .select({
      id: publicFormSubmissions.id,
      status: publicFormSubmissions.status,
      submittedAt: publicFormSubmissions.submittedAt,
      envelopeId: publicFormSubmissions.envelopeId,
      envelopeTitle: envelopes.title,
      envelopeStatus: envelopes.status,
      signerName: signers.name,
      signerEmail: signers.email,
    })
    .from(publicFormSubmissions)
    .leftJoin(envelopes, eq(publicFormSubmissions.envelopeId, envelopes.id))
    .leftJoin(signers, eq(envelopes.id, signers.envelopeId))
    .where(eq(publicFormSubmissions.publicFormId, publicFormId))
    .orderBy(desc(publicFormSubmissions.submittedAt));

  return submissions;
}

import { db } from "@/lib/db";
import {
  bulkSendBatches,
  bulkSendRows,
  templates,
  templateRoles,
  templateFields,
  envelopes,
  documents,
  signers,
  signatureFields,
  auditEvents,
} from "@/lib/db/schema";
import { eq, and, asc, inArray } from "drizzle-orm";
import { storageProvider } from "@/lib/storage";
import { generateSigningToken } from "@/lib/tokens";
import { sendSigningEmail } from "@/lib/email";
import { recordContactUsage, findDuplicateContact } from "@/lib/services/contacts";
import crypto from "crypto";

import {
  MAX_BULK_ROWS,
  parseCsvContent,
  validateBulkBatch,
  type RoleMappingConfig,
  type BatchReminderConfig,
  type CsvParseResult,
  type ValidationErrorItem,
  type BulkValidationResult,
} from "@/lib/utils/csv-parser";

export {
  MAX_BULK_ROWS,
  parseCsvContent,
  validateBulkBatch,
  type RoleMappingConfig,
  type BatchReminderConfig,
  type CsvParseResult,
  type ValidationErrorItem,
  type BulkValidationResult,
};

/**
 * Creates a Bulk Send batch record and parses/persists row-level entries.
 */
export async function createBulkSendBatch({
  ownerId,
  templateId,
  name,
  csvFilename,
  csvContent,
  roleMapping,
  reminderConfig,
}: {
  ownerId: string;
  templateId: string;
  name: string;
  csvFilename: string;
  csvContent: string;
  roleMapping: RoleMappingConfig;
  reminderConfig?: BatchReminderConfig;
}) {
  const parsedCsv = parseCsvContent(csvContent);

  const [template] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, templateId), eq(templates.ownerId, ownerId)))
    .limit(1);

  if (!template) throw new Error("Template not found or unauthorized");

  const [tRoles] = await Promise.all([
    db.select().from(templateRoles).where(eq(templateRoles.templateId, templateId)).orderBy(asc(templateRoles.order)),
  ]);

  const validation = validateBulkBatch(tRoles, parsedCsv.rows, roleMapping);
  if (!validation.isValid) {
    throw new Error(`CSV validation failed with ${validation.errorCount} error(s).`);
  }

  // 1. Create Batch record
  const [batch] = await db
    .insert(bulkSendBatches)
    .values({
      ownerId,
      templateId,
      name,
      status: "READY",
      totalRows: parsedCsv.totalRowsCount,
      pendingRows: parsedCsv.totalRowsCount,
      processingRows: 0,
      sentRows: 0,
      failedRows: 0,
      csvFilename,
      mappingConfig: roleMapping,
      reminderConfig: reminderConfig ?? {},
    })
    .returning();

  // 2. Prepare Rows records
  const rowsToInsert = parsedCsv.rows.map((row, idx) => {
    const rowNumber = idx + 1;

    // Map role data
    const mappedData: Record<string, { email: string; name?: string }> = {};
    tRoles.forEach((role) => {
      const mapping = roleMapping[role.id];
      if (mapping) {
        const email = (row[mapping.emailColumn] || "").trim();
        const name = mapping.nameColumn ? (row[mapping.nameColumn] || "").trim() : "";
        mappedData[role.id] = { email, name: name || undefined };
      }
    });

    const primaryEmail = Object.values(mappedData)[0]?.email || `row-${rowNumber}`;
    const idempotencyKey = crypto
      .createHash("sha256")
      .update(`${batch.id}-${rowNumber}-${primaryEmail}`)
      .digest("hex");

    return {
      batchId: batch.id,
      rowNumber,
      sourceData: row,
      mappedData,
      status: "PENDING" as const,
      idempotencyKey,
      attempts: 0,
    };
  });

  if (rowsToInsert.length > 0) {
    // Insert rows in chunks of 500 to avoid query parameter limit
    for (let i = 0; i < rowsToInsert.length; i += 500) {
      await db.insert(bulkSendRows).values(rowsToInsert.slice(i, i + 500));
    }
  }

  await db.insert(auditEvents).values({
    envelopeId: batch.id, // linked audit event
    event: "BULK_SEND_CREATED",
    actor: ownerId,
    meta: {
      batchId: batch.id,
      batchName: batch.name,
      totalRows: batch.totalRows,
      templateId,
    },
  });

  return batch;
}

/**
 * Core processor for executing a bulk send batch in controlled chunks.
 * Ensures single row failures do not abort remaining rows, records idempotency, updates contacts, and passes reminders.
 */
export async function processBulkSendBatch(batchId: string, ownerId: string) {
  const [batch] = await db
    .select()
    .from(bulkSendBatches)
    .where(and(eq(bulkSendBatches.id, batchId), eq(bulkSendBatches.ownerId, ownerId)))
    .limit(1);

  if (!batch) throw new Error("Batch not found or unauthorized");

  if (!batch.templateId) throw new Error("Batch template reference is missing");

  const [template] = await db
    .select()
    .from(templates)
    .where(eq(templates.id, batch.templateId))
    .limit(1);

  if (!template) throw new Error("Associated template no longer exists");

  const [tRoles, tFields] = await Promise.all([
    db.select().from(templateRoles).where(eq(templateRoles.templateId, template.id)).orderBy(asc(templateRoles.order)),
    db.select().from(templateFields).where(eq(templateFields.templateId, template.id)),
  ]);

  // Mark batch as PROCESSING
  await db
    .update(bulkSendBatches)
    .set({
      status: "PROCESSING",
      startedAt: batch.startedAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bulkSendBatches.id, batch.id));

  // Fetch pending or failed rows for execution
  const pendingRows = await db
    .select()
    .from(bulkSendRows)
    .where(
      and(
        eq(bulkSendRows.batchId, batch.id),
        inArray(bulkSendRows.status, ["PENDING", "FAILED"])
      )
    )
    .orderBy(bulkSendRows.rowNumber);

  const reminderSettings = (batch.reminderConfig as BatchReminderConfig) ?? {};
  const reminderEnabled = reminderSettings.reminderEnabled ?? false;
  const reminderFirstAfterDays = reminderSettings.reminderFirstAfterDays ?? 2;
  const reminderEveryDays = reminderSettings.reminderEveryDays ?? 3;
  const reminderMessage = reminderSettings.reminderMessage ?? null;
  const expirationWarningDays = reminderSettings.expirationWarningDays ?? 3;
  const expirationDays = reminderSettings.expirationDays ?? 7;

  // Process rows in controlled concurrency chunks (e.g. 5 at a time)
  const CHUNK_SIZE = 5;

  for (let i = 0; i < pendingRows.length; i += CHUNK_SIZE) {
    const chunk = pendingRows.slice(i, i + CHUNK_SIZE);

    await Promise.all(
      chunk.map(async (row) => {
        // Idempotency check: if row already sent with an envelope, skip
        if (row.status === "SENT" && row.envelopeId) {
          return;
        }

        const now = new Date();
        const mappedObj = (row.mappedData as Record<string, { email: string; name?: string }>) || {};

        try {
          // Mark row as PROCESSING
          await db
            .update(bulkSendRows)
            .set({
              status: "PROCESSING",
              attempts: (row.attempts || 0) + 1,
              updatedAt: now,
            })
            .where(eq(bulkSendRows.id, row.id));

          // Calculate initial reminder/expiration dates
          let expiresAt: Date | null = null;
          if (expirationDays > 0) {
            expiresAt = new Date(now.getTime() + expirationDays * 24 * 60 * 60 * 1000);
          }

          let nextReminderAt: Date | null = null;
          if (reminderEnabled) {
            nextReminderAt = new Date(now.getTime() + reminderFirstAfterDays * 24 * 60 * 60 * 1000);
          }

          // 1. Create Envelope for this row
          const primaryRecipientName = Object.values(mappedObj)[0]?.name;
          const primaryRecipientEmail = Object.values(mappedObj)[0]?.email || `row-${row.rowNumber}`;
          const envTitle = `${template.name} - ${primaryRecipientName || primaryRecipientEmail}`;

          const [envelope] = await db
            .insert(envelopes)
            .values({
              ownerId,
              title: envTitle,
              status: "SENT",
              reminderEnabled,
              reminderFirstAfterDays,
              reminderEveryDays,
              reminderMessage,
              nextReminderAt,
              expiresAt,
              expirationWarningDays,
              createdAt: now,
              updatedAt: now,
            })
            .returning();

          // 2. Clone Document from template storage
          const [doc] = await db
            .insert(documents)
            .values({
              envelopeId: envelope.id,
              filename: template.filename,
              storageKey: `documents/${envelope.id}/original.pdf`,
              pageCount: template.pageCount,
            })
            .returning();

          const templatePdfExists = await storageProvider.exists(template.storageKey);
          if (templatePdfExists) {
            const pdfBytes = await storageProvider.download(template.storageKey);
            await storageProvider.upload(pdfBytes, doc.storageKey);
          }

          // 3. Create Signers & Map Roles
          const roleToSignerIdMap = new Map<string, string>();
          const createdSignersList: Array<{ id: string; email: string; name: string | null; token: string; order: number | null }> = [];

          for (const role of tRoles) {
            const rData = mappedObj[role.id];
            if (rData && rData.email) {
              const token = generateSigningToken();
              const [signer] = await db
                .insert(signers)
                .values({
                  envelopeId: envelope.id,
                  email: rData.email.trim().toLowerCase(),
                  name: rData.name?.trim() || null,
                  token,
                  order: role.order,
                  status: "PENDING",
                })
                .returning();

              roleToSignerIdMap.set(role.id, signer.id);
              createdSignersList.push(signer);
            }
          }

          if (createdSignersList.length === 0) {
            throw new Error(`Row ${row.rowNumber} has no valid recipient mappings.`);
          }

          // 4. Instantiate Signature Fields
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

          // 5. Activate initial active order signers & send emails
          const orders = createdSignersList.map((s) => s.order ?? 1);
          const minOrder = Math.min(...orders);
          const activeSigners = createdSignersList.filter((s) => (s.order ?? 1) === minOrder);

          for (const signer of activeSigners) {
            await db
              .update(signers)
              .set({ status: "SENT" })
              .where(eq(signers.id, signer.id));

            await sendSigningEmail({
              to: signer.email,
              signerName: signer.name ?? signer.email,
              senderName: template.name,
              documentTitle: envelope.title,
              token: signer.token,
            });

            // Contact usage integration
            const existingContact = await findDuplicateContact(ownerId, signer.email);
            if (existingContact) {
              await recordContactUsage(existingContact.id, ownerId);
            }
          }

          // Audit event
          await db.insert(auditEvents).values({
            envelopeId: envelope.id,
            event: "DOCUMENT_SENT",
            actor: ownerId,
            meta: { bulkBatchId: batch.id, bulkRowNumber: row.rowNumber },
          });

          // Mark row as SENT
          await db
            .update(bulkSendRows)
            .set({
              status: "SENT",
              envelopeId: envelope.id,
              errorMessage: null,
              processedAt: now,
              updatedAt: now,
            })
            .where(eq(bulkSendRows.id, row.id));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[processBulkSendBatch] Row ${row.rowNumber} failed:`, msg);

          await db
            .update(bulkSendRows)
            .set({
              status: "FAILED",
              errorMessage: msg,
              updatedAt: now,
            })
            .where(eq(bulkSendRows.id, row.id));
        }
      })
    );
  }

  // Final batch metrics recalculation
  const allRows = await db
    .select({ status: bulkSendRows.status })
    .from(bulkSendRows)
    .where(eq(bulkSendRows.batchId, batch.id));

  const sentCount = allRows.filter((r) => r.status === "SENT").length;
  const failedCount = allRows.filter((r) => r.status === "FAILED").length;
  const pendingCount = allRows.filter((r) => r.status === "PENDING" || r.status === "PROCESSING").length;

  let finalStatus: typeof batch.status = "COMPLETED";
  if (failedCount > 0 && sentCount > 0) {
    finalStatus = "COMPLETED_WITH_ERRORS";
  } else if (failedCount > 0 && sentCount === 0 && pendingCount === 0) {
    finalStatus = "FAILED";
  } else if (pendingCount > 0) {
    finalStatus = "PROCESSING";
  }

  await db
    .update(bulkSendBatches)
    .set({
      status: finalStatus,
      sentRows: sentCount,
      failedRows: failedCount,
      pendingRows: pendingCount,
      processingRows: 0,
      completedAt: pendingCount === 0 ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(bulkSendBatches.id, batch.id));

  return {
    batchId: batch.id,
    status: finalStatus,
    sentCount,
    failedCount,
    pendingCount,
  };
}

/**
 * Retries failed rows in a bulk batch safely without re-sending already SENT rows.
 */
export async function retryFailedBulkSendRows(batchId: string, ownerId: string, rowIds?: string[]) {
  const [batch] = await db
    .select()
    .from(bulkSendBatches)
    .where(and(eq(bulkSendBatches.id, batchId), eq(bulkSendBatches.ownerId, ownerId)))
    .limit(1);

  if (!batch) throw new Error("Batch not found or unauthorized");

  // Reset selected or all FAILED rows to PENDING
  const updateQuery = db
    .update(bulkSendRows)
    .set({
      status: "PENDING",
      errorMessage: null,
      updatedAt: new Date(),
    });

  if (rowIds && rowIds.length > 0) {
    await updateQuery.where(
      and(
        eq(bulkSendRows.batchId, batch.id),
        eq(bulkSendRows.status, "FAILED"),
        inArray(bulkSendRows.id, rowIds)
      )
    );
  } else {
    await updateQuery.where(
      and(eq(bulkSendRows.batchId, batch.id), eq(bulkSendRows.status, "FAILED"))
    );
  }

  // Trigger processing
  return await processBulkSendBatch(batch.id, ownerId);
}

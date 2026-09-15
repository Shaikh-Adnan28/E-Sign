import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { bulkSendBatches, bulkSendRows, templates } from "@/lib/db/schema";
import { and, eq, asc } from "drizzle-orm";
import { BatchDetailClient, BatchDetailItem, BatchRowItem } from "@/components/bulk-send/batch-detail-client";

export default async function BulkSendDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const [batchRecord] = await db
    .select({
      batch: bulkSendBatches,
      templateName: templates.name,
    })
    .from(bulkSendBatches)
    .leftJoin(templates, eq(bulkSendBatches.templateId, templates.id))
    .where(and(eq(bulkSendBatches.id, id), eq(bulkSendBatches.ownerId, session.user.id)))
    .limit(1);

  if (!batchRecord) return notFound();

  const rowsRecords = await db
    .select()
    .from(bulkSendRows)
    .where(eq(bulkSendRows.batchId, id))
    .orderBy(asc(bulkSendRows.rowNumber));

  const batchDetail: BatchDetailItem = {
    id: batchRecord.batch.id,
    name: batchRecord.batch.name,
    templateId: batchRecord.batch.templateId,
    templateName: batchRecord.templateName ?? "Deleted Template",
    status: batchRecord.batch.status,
    totalRows: batchRecord.batch.totalRows,
    pendingRows: batchRecord.batch.pendingRows,
    processingRows: batchRecord.batch.processingRows,
    sentRows: batchRecord.batch.sentRows,
    failedRows: batchRecord.batch.failedRows,
    csvFilename: batchRecord.batch.csvFilename,
    createdAt: batchRecord.batch.createdAt,
    startedAt: batchRecord.batch.startedAt,
    completedAt: batchRecord.batch.completedAt,
  };

  const rowItems: BatchRowItem[] = rowsRecords.map((r) => ({
    id: r.id,
    rowNumber: r.rowNumber,
    sourceData: r.sourceData as Record<string, string> | null,
    mappedData: r.mappedData as Record<string, { email: string; name?: string }> | null,
    status: r.status,
    envelopeId: r.envelopeId,
    attempts: r.attempts,
    errorMessage: r.errorMessage,
    processedAt: r.processedAt,
    createdAt: r.createdAt,
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <BatchDetailClient batch={batchDetail} rows={rowItems} />
    </div>
  );
}

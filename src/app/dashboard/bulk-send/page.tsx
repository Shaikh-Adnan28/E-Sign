import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { templates, templateRoles, bulkSendBatches } from "@/lib/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { BulkSendClient, TemplateItem, BatchItem } from "@/components/bulk-send/bulk-send-client";

export default async function BulkSendPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [userTemplates, userBatches] = await Promise.all([
    db
      .select()
      .from(templates)
      .where(and(eq(templates.ownerId, session.user.id), eq(templates.status, "ACTIVE")))
      .orderBy(desc(templates.createdAt)),
    db
      .select({
        batch: bulkSendBatches,
        templateName: templates.name,
      })
      .from(bulkSendBatches)
      .leftJoin(templates, eq(bulkSendBatches.templateId, templates.id))
      .where(eq(bulkSendBatches.ownerId, session.user.id))
      .orderBy(desc(bulkSendBatches.createdAt)),
  ]);

  // Fetch roles for each template
  const templateItems: TemplateItem[] = await Promise.all(
    userTemplates.map(async (t) => {
      const roles = await db
        .select()
        .from(templateRoles)
        .where(eq(templateRoles.templateId, t.id))
        .orderBy(asc(templateRoles.order));

      return {
        id: t.id,
        name: t.name,
        description: t.description,
        filename: t.filename,
        pageCount: t.pageCount,
        usageCount: t.usageCount,
        roles: roles.map((r) => ({
          id: r.id,
          roleName: r.roleName,
          order: r.order,
        })),
      };
    })
  );

  const batchItems: BatchItem[] = userBatches.map(({ batch, templateName }) => ({
    id: batch.id,
    name: batch.name,
    templateId: batch.templateId,
    templateName: templateName ?? "Deleted Template",
    status: batch.status,
    totalRows: batch.totalRows,
    pendingRows: batch.pendingRows,
    processingRows: batch.processingRows,
    sentRows: batch.sentRows,
    failedRows: batch.failedRows,
    csvFilename: batch.csvFilename,
    createdAt: batch.createdAt,
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <BulkSendClient initialTemplates={templateItems} initialBatches={batchItems} />
    </div>
  );
}

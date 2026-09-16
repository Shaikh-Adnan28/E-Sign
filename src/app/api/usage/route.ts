import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { envelopes, templates, contacts, publicForms, publicFormSubmissions, bulkSendBatches, bulkSendRows } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Use efficient aggregate queries
    const [
      docsResult,
      templatesResult,
      contactsResult,
      formsResult,
      submissionsResult,
      batchesResult,
      bulkRowsResult
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(envelopes).where(eq(envelopes.ownerId, userId)),
      db.select({ count: sql<number>`count(*)::int` }).from(templates).where(eq(templates.ownerId, userId)),
      db.select({ count: sql<number>`count(*)::int` }).from(contacts).where(eq(contacts.ownerId, userId)),
      db.select({ count: sql<number>`count(*)::int` }).from(publicForms).where(eq(publicForms.ownerId, userId)),
      
      // Join for public form submissions owned by user
      db.select({ count: sql<number>`count(*)::int` })
        .from(publicFormSubmissions)
        .leftJoin(publicForms, eq(publicFormSubmissions.publicFormId, publicForms.id))
        .where(eq(publicForms.ownerId, userId)),

      // Bulk Send batches
      db.select({ count: sql<number>`count(*)::int` }).from(bulkSendBatches).where(eq(bulkSendBatches.ownerId, userId)),
      
      // Bulk Send rows (recipients)
      db.select({ count: sql<number>`count(*)::int` })
        .from(bulkSendRows)
        .leftJoin(bulkSendBatches, eq(bulkSendRows.batchId, bulkSendBatches.id))
        .where(eq(bulkSendBatches.ownerId, userId)),
    ]);

    // Storage tracking is currently not supported because we don't store file size metadata
    // in the documents or templates tables. We avoid scanning the filesystem.

    const usage = {
      planName: "Free",
      documents: {
        used: docsResult[0]?.count || 0,
        limit: null
      },
      templates: {
        used: templatesResult[0]?.count || 0,
        limit: null
      },
      contacts: {
        used: contactsResult[0]?.count || 0,
        limit: null
      },
      publicForms: {
        used: formsResult[0]?.count || 0,
        limit: null
      },
      publicFormSubmissions: {
        used: submissionsResult[0]?.count || 0,
        limit: null
      },
      bulkSendBatches: {
        used: batchesResult[0]?.count || 0,
        limit: null
      },
      bulkSendRecipients: {
        used: bulkRowsResult[0]?.count || 0,
        limit: null
      },
      storage: {
        used: null, // Indicates not available
        limit: null
      }
    };

    return NextResponse.json(usage);
  } catch (error) {
    console.error("Usage API Error:", error);
    return NextResponse.json({ error: "Failed to fetch usage" }, { status: 500 });
  }
}

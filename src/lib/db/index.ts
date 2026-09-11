import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Initialize Drizzle ORM
export const db = drizzle(pool, { schema });

// Export types
export type { 
  User, NewUser,
  Organization, NewOrganization,
  Envelope, NewEnvelope,
  Document, NewDocument,
  Signer, NewSigner,
  SignatureField, NewSignatureField,
  AuditEvent, NewAuditEvent,
  Contact, NewContact,
} from "./schema";

// Helper function to close the database connection
export async function closeDatabase() {
  await pool.end();
}

// Helper function to check database connection
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch (error) {
    console.error("Database connection error:", error);
    return false;
  }
}
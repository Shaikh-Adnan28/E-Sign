import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const envelopeStatusEnum = [
  "DRAFT",
  "SENT",
  "DELIVERED",
  "VIEWED",
  "PARTIALLY_SIGNED",
  "COMPLETED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
] as const;

export const signerStatusEnum = [
  "PENDING",
  "SENT",
  "DELIVERED",
  "VIEWED",
  "SIGNED",
  "DECLINED",
  "EXPIRED",
] as const;

export const fieldTypeEnum = [
  "signature",
  "initials",
  "text",
  "date",
  "checkbox",
] as const;

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  emailIdx: uniqueIndex("users_email_idx").on(table.email),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Organizations table
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

// Envelopes table
export const envelopes = pgTable("envelopes", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  status: text("status", { enum: envelopeStatusEnum }).notNull().default("DRAFT"),
  message: text("message"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  ownerIdx: index("envelopes_owner_idx").on(table.ownerId),
  statusIdx: index("envelopes_status_idx").on(table.status),
}));

export type Envelope = typeof envelopes.$inferSelect;
export type NewEnvelope = typeof envelopes.$inferInsert;

// Documents table
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  envelopeId: uuid("envelope_id").references(() => envelopes.id, { onDelete: "cascade" }).notNull(),
  filename: text("filename").notNull(),
  storageKey: text("storage_key").notNull(),
  pageCount: integer("page_count"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  envelopeIdx: index("documents_envelope_idx").on(table.envelopeId),
}));

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

// Signers table
export const signers = pgTable("signers", {
  id: uuid("id").primaryKey().defaultRandom(),
  envelopeId: uuid("envelope_id").references(() => envelopes.id, { onDelete: "cascade" }).notNull(),
  email: text("email").notNull(),
  name: text("name"),
  token: text("token").notNull().unique(),
  order: integer("order").default(0),
  status: text("status", { enum: signerStatusEnum }).default("PENDING"),
  signedAt: timestamp("signed_at"),
  viewedAt: timestamp("viewed_at"),
}, (table) => ({
  envelopeIdx: index("signers_envelope_idx").on(table.envelopeId),
  tokenIdx: uniqueIndex("signers_token_idx").on(table.token),
  emailIdx: index("signers_email_idx").on(table.email),
}));

export type Signer = typeof signers.$inferSelect;
export type NewSigner = typeof signers.$inferInsert;

// Signature fields table
export const signatureFields = pgTable("signature_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }).notNull(),
  signerId: uuid("signer_id").references(() => signers.id, { onDelete: "cascade" }),
  type: text("type", { enum: fieldTypeEnum }).notNull(),
  page: integer("page").notNull(),
  x: text("x").notNull(), // percentage position (0-100%)
  y: text("y").notNull(), // percentage position (0-100%)
  width: text("width").notNull(), // percentage width (0-100%)
  height: text("height").notNull(), // percentage height (0-100%)
  required: boolean("required").default(true),
  value: text("value"),
}, (table) => ({
  documentIdx: index("signature_fields_document_idx").on(table.documentId),
  signerIdx: index("signature_fields_signer_idx").on(table.signerId),
}));

export type SignatureField = typeof signatureFields.$inferSelect;
export type NewSignatureField = typeof signatureFields.$inferInsert;

// Audit events table
export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  envelopeId: uuid("envelope_id").references(() => envelopes.id, { onDelete: "cascade" }).notNull(),
  event: text("event").notNull(),
  actor: text("actor"),
  meta: jsonb("meta"),
  ip: text("ip"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  envelopeIdx: index("audit_events_envelope_idx").on(table.envelopeId),
  createdAtIdx: index("audit_events_created_at_idx").on(table.createdAt),
}));

export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  envelopes: many(envelopes),
}));

export const envelopesRelations = relations(envelopes, ({ one, many }) => ({
  owner: one(users, {
    fields: [envelopes.ownerId],
    references: [users.id],
  }),
  documents: many(documents),
  signers: many(signers),
  auditEvents: many(auditEvents),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  envelope: one(envelopes, {
    fields: [documents.envelopeId],
    references: [envelopes.id],
  }),
  signatureFields: many(signatureFields),
}));

export const signersRelations = relations(signers, ({ one, many }) => ({
  envelope: one(envelopes, {
    fields: [signers.envelopeId],
    references: [envelopes.id],
  }),
  signatureFields: many(signatureFields),
}));

export const signatureFieldsRelations = relations(signatureFields, ({ one }) => ({
  document: one(documents, {
    fields: [signatureFields.documentId],
    references: [documents.id],
  }),
  signer: one(signers, {
    fields: [signatureFields.signerId],
    references: [signers.id],
  }),
}));

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  envelope: one(envelopes, {
    fields: [auditEvents.envelopeId],
    references: [envelopes.id],
  }),
}));

// Export all schemas
export const schemas = {
  users,
  organizations,
  envelopes,
  documents,
  signers,
  signatureFields,
  auditEvents,
};
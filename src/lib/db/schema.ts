import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric as numericCol,
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
  "SIGNATURE",
  "INITIALS",
  "TEXT",
  "DATE",
  "CHECKBOX",
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
  reminderEnabled: boolean("reminder_enabled").default(false).notNull(),
  reminderFirstAfterDays: integer("reminder_first_after_days").default(3).notNull(),
  reminderEveryDays: integer("reminder_every_days").default(3).notNull(),
  reminderMessage: text("reminder_message"),
  nextReminderAt: timestamp("next_reminder_at"),
  lastReminderAt: timestamp("last_reminder_at"),
  expirationWarningDays: integer("expiration_warning_days").default(5),
  expirationWarningSentAt: timestamp("expiration_warning_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  ownerIdx: index("envelopes_owner_idx").on(table.ownerId),
  statusIdx: index("envelopes_status_idx").on(table.status),
  nextReminderIdx: index("envelopes_next_reminder_idx").on(table.nextReminderAt),
  expiresAtIdx: index("envelopes_expires_at_idx").on(table.expiresAt),
  createdAtIdx: index("envelopes_created_at_idx").on(table.createdAt),
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
  isHtmlDocument: boolean("is_html_document").default(false).notNull(),
  htmlSource: text("html_source"),
  htmlCss: text("html_css"),
  variablesConfig: jsonb("variables_config").$type<any[]>(),
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
  pageNumber: integer("page_number").notNull(), // page number (1‑based)
  x: numericCol("x").notNull(), // normalized 0‑1 coordinate
  y: numericCol("y").notNull(),
  width: numericCol("width").notNull(),
  height: numericCol("height").notNull(),
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
  envelopeId: uuid("envelope_id").references(() => envelopes.id, { onDelete: "cascade" }),
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

// Contacts table
export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company"),
  phone: text("phone"),
  notes: text("notes"),
  tags: jsonb("tags").$type<string[]>().default([]).notNull(),
  usageCount: integer("usage_count").default(0).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  ownerIdx: index("contacts_owner_idx").on(table.ownerId),
  ownerEmailIdx: uniqueIndex("contacts_owner_email_idx").on(table.ownerId, table.email),
  lastUsedIdx: index("contacts_last_used_idx").on(table.lastUsedAt),
}));

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;

// Contact Groups table
export const contactGroups = pgTable("contact_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  ownerIdx: index("contact_groups_owner_idx").on(table.ownerId),
}));

export type ContactGroup = typeof contactGroups.$inferSelect;
export type NewContactGroup = typeof contactGroups.$inferInsert;

// Contact Group Members table
export const contactGroupMembers = pgTable("contact_group_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .references(() => contactGroups.id, { onDelete: "cascade" })
    .notNull(),
  contactId: uuid("contact_id")
    .references(() => contacts.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  groupIdx: index("group_members_group_idx").on(table.groupId),
  contactIdx: index("group_members_contact_idx").on(table.contactId),
  groupContactIdx: uniqueIndex("group_members_group_contact_idx").on(table.groupId, table.contactId),
}));

export type ContactGroupMember = typeof contactGroupMembers.$inferSelect;
export type NewContactGroupMember = typeof contactGroupMembers.$inferInsert;

// Contacts & Groups relations
export const contactsRelations = relations(contacts, ({ one, many }) => ({
  owner: one(users, {
    fields: [contacts.ownerId],
    references: [users.id],
  }),
  groupMemberships: many(contactGroupMembers),
}));

export const contactGroupsRelations = relations(contactGroups, ({ one, many }) => ({
  owner: one(users, {
    fields: [contactGroups.ownerId],
    references: [users.id],
  }),
  members: many(contactGroupMembers),
}));

export const contactGroupMembersRelations = relations(contactGroupMembers, ({ one }) => ({
  group: one(contactGroups, {
    fields: [contactGroupMembers.groupId],
    references: [contactGroups.id],
  }),
  contact: one(contacts, {
    fields: [contactGroupMembers.contactId],
    references: [contacts.id],
  }),
}));

// Update users relations to include contacts and groups
export const usersRelationsWithContacts = relations(users, ({ many }) => ({
  envelopes: many(envelopes),
  contacts: many(contacts),
  contactGroups: many(contactGroups),
}));

export const templateStatusEnum = ["ACTIVE", "ARCHIVED"] as const;

// Templates table
export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  filename: text("filename").notNull(),
  storageKey: text("storage_key").notNull(),
  pageCount: integer("page_count"),
  isHtmlTemplate: boolean("is_html_template").default(false).notNull(),
  htmlSource: text("html_source"),
  htmlCss: text("html_css"),
  variablesConfig: jsonb("variables_config").$type<any[]>(),
  usageCount: integer("usage_count").default(0).notNull(),
  status: text("status", { enum: templateStatusEnum }).default("ACTIVE").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  ownerIdx: index("templates_owner_idx").on(table.ownerId),
  statusIdx: index("templates_status_idx").on(table.status),
}));

export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;

// Template Roles table
export const templateRoles = pgTable("template_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id")
    .references(() => templates.id, { onDelete: "cascade" })
    .notNull(),
  roleName: text("role_name").notNull(),
  order: integer("order").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  templateIdx: index("template_roles_template_idx").on(table.templateId),
}));

export type TemplateRole = typeof templateRoles.$inferSelect;
export type NewTemplateRole = typeof templateRoles.$inferInsert;

// Template Fields table
export const templateFields = pgTable("template_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id")
    .references(() => templates.id, { onDelete: "cascade" })
    .notNull(),
  roleId: uuid("role_id")
    .references(() => templateRoles.id, { onDelete: "cascade" }),
  type: text("type", { enum: fieldTypeEnum }).notNull(),
  pageNumber: integer("page_number").notNull(),
  x: numericCol("x").notNull(),
  y: numericCol("y").notNull(),
  width: numericCol("width").notNull(),
  height: numericCol("height").notNull(),
  required: boolean("required").default(true),
  placeholder: text("placeholder"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  templateIdx: index("template_fields_template_idx").on(table.templateId),
  roleIdx: index("template_fields_role_idx").on(table.roleId),
}));

export type TemplateField = typeof templateFields.$inferSelect;
export type NewTemplateField = typeof templateFields.$inferInsert;

// Template Relations
export const templatesRelations = relations(templates, ({ one, many }) => ({
  owner: one(users, {
    fields: [templates.ownerId],
    references: [users.id],
  }),
  roles: many(templateRoles),
  fields: many(templateFields),
}));

export const templateRolesRelations = relations(templateRoles, ({ one, many }) => ({
  template: one(templates, {
    fields: [templateRoles.templateId],
    references: [templates.id],
  }),
  fields: many(templateFields),
}));

export const templateFieldsRelations = relations(templateFields, ({ one }) => ({
  template: one(templates, {
    fields: [templateFields.templateId],
    references: [templates.id],
  }),
  role: one(templateRoles, {
    fields: [templateFields.roleId],
    references: [templateRoles.id],
  }),
}));

// Export all schemas
export const bulkBatchStatusEnum = [
  "DRAFT",
  "VALIDATING",
  "READY",
  "PROCESSING",
  "COMPLETED",
  "COMPLETED_WITH_ERRORS",
  "FAILED",
  "CANCELLED",
] as const;

export const bulkRowStatusEnum = [
  "PENDING",
  "PROCESSING",
  "SENT",
  "FAILED",
] as const;

// Bulk Send Batches table
export const bulkSendBatches = pgTable("bulk_send_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  templateId: uuid("template_id")
    .references(() => templates.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  status: text("status", { enum: bulkBatchStatusEnum }).default("DRAFT").notNull(),
  totalRows: integer("total_rows").default(0).notNull(),
  pendingRows: integer("pending_rows").default(0).notNull(),
  processingRows: integer("processing_rows").default(0).notNull(),
  sentRows: integer("sent_rows").default(0).notNull(),
  failedRows: integer("failed_rows").default(0).notNull(),
  csvFilename: text("csv_filename"),
  mappingConfig: jsonb("mapping_config"),
  reminderConfig: jsonb("reminder_config"),
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  ownerIdx: index("bulk_send_batches_owner_idx").on(table.ownerId),
  templateIdx: index("bulk_send_batches_template_idx").on(table.templateId),
  statusIdx: index("bulk_send_batches_status_idx").on(table.status),
}));

export type BulkSendBatch = typeof bulkSendBatches.$inferSelect;
export type NewBulkSendBatch = typeof bulkSendBatches.$inferInsert;

// Bulk Send Rows table
export const bulkSendRows = pgTable("bulk_send_rows", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id")
    .references(() => bulkSendBatches.id, { onDelete: "cascade" })
    .notNull(),
  rowNumber: integer("row_number").notNull(),
  sourceData: jsonb("source_data").$type<Record<string, string>>(),
  mappedData: jsonb("mapped_data"),
  status: text("status", { enum: bulkRowStatusEnum }).default("PENDING").notNull(),
  envelopeId: uuid("envelope_id")
    .references(() => envelopes.id, { onDelete: "set null" }),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  attempts: integer("attempts").default(0).notNull(),
  errorMessage: text("error_message"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  batchIdx: index("bulk_send_rows_batch_idx").on(table.batchId),
  statusIdx: index("bulk_send_rows_status_idx").on(table.status),
  idempotencyIdx: uniqueIndex("bulk_send_rows_idempotency_idx").on(table.idempotencyKey),
  envelopeIdx: index("bulk_send_rows_envelope_idx").on(table.envelopeId),
}));

export type BulkSendRow = typeof bulkSendRows.$inferSelect;
export type NewBulkSendRow = typeof bulkSendRows.$inferInsert;

// Bulk Send Relations
export const bulkSendBatchesRelations = relations(bulkSendBatches, ({ one, many }) => ({
  owner: one(users, {
    fields: [bulkSendBatches.ownerId],
    references: [users.id],
  }),
  template: one(templates, {
    fields: [bulkSendBatches.templateId],
    references: [templates.id],
  }),
  rows: many(bulkSendRows),
}));

export const bulkSendRowsRelations = relations(bulkSendRows, ({ one }) => ({
  batch: one(bulkSendBatches, {
    fields: [bulkSendRows.batchId],
    references: [bulkSendBatches.id],
  }),
  envelope: one(envelopes, {
    fields: [bulkSendRows.envelopeId],
    references: [envelopes.id],
  }),
}));

// Public Forms status enums
export const publicFormStatusEnum = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "EXPIRED",
  "ARCHIVED",
] as const;

export const publicSubmissionStatusEnum = [
  "STARTED",
  "PENDING",
  "COMPLETED",
  "DECLINED",
  "EXPIRED",
] as const;

// Public Forms table
export const publicForms = pgTable("public_forms", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  templateId: uuid("template_id")
    .references(() => templates.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  token: text("token").notNull().unique(),
  status: text("status", { enum: publicFormStatusEnum }).default("ACTIVE").notNull(),
  confirmationMessage: text("confirmation_message"),
  submissionsCount: integer("submissions_count").default(0).notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  ownerIdx: index("public_forms_owner_idx").on(table.ownerId),
  templateIdx: index("public_forms_template_idx").on(table.templateId),
  tokenIdx: uniqueIndex("public_forms_token_idx").on(table.token),
  statusIdx: index("public_forms_status_idx").on(table.status),
}));

export type PublicForm = typeof publicForms.$inferSelect;
export type NewPublicForm = typeof publicForms.$inferInsert;

// Public Form Submissions table
export const publicFormSubmissions = pgTable("public_form_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  publicFormId: uuid("public_form_id")
    .references(() => publicForms.id, { onDelete: "cascade" })
    .notNull(),
  envelopeId: uuid("envelope_id")
    .references(() => envelopes.id, { onDelete: "set null" }),
  status: text("status", { enum: publicSubmissionStatusEnum }).default("STARTED").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  formIdx: index("public_form_submissions_form_idx").on(table.publicFormId),
  envelopeIdx: index("public_form_submissions_envelope_idx").on(table.envelopeId),
  statusIdx: index("public_form_submissions_status_idx").on(table.status),
}));

export type PublicFormSubmission = typeof publicFormSubmissions.$inferSelect;
export type NewPublicFormSubmission = typeof publicFormSubmissions.$inferInsert;

// Public Forms & Submissions Relations
export const publicFormsRelations = relations(publicForms, ({ one, many }) => ({
  owner: one(users, {
    fields: [publicForms.ownerId],
    references: [users.id],
  }),
  template: one(templates, {
    fields: [publicForms.templateId],
    references: [templates.id],
  }),
  submissions: many(publicFormSubmissions),
}));

export const publicFormSubmissionsRelations = relations(publicFormSubmissions, ({ one }) => ({
  publicForm: one(publicForms, {
    fields: [publicFormSubmissions.publicFormId],
    references: [publicForms.id],
  }),
  envelope: one(envelopes, {
    fields: [publicFormSubmissions.envelopeId],
    references: [envelopes.id],
  }),
}));

export const schemas = {
  users,
  organizations,
  envelopes,
  documents,
  signers,
  signatureFields,
  auditEvents,
  contacts,
  contactGroups,
  contactGroupMembers,
  templates,
  templateRoles,
  templateFields,
  bulkSendBatches,
  bulkSendRows,
  publicForms,
  publicFormSubmissions,
};
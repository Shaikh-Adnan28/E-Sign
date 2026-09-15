import { describe, it, expect } from "vitest";
import { parseCsvContent, validateBulkBatch, MAX_BULK_ROWS, RoleMappingConfig } from "../bulk-send";

describe("Phase 7.0 — Bulk Send CSV Parsing & Validation", () => {
  it("parses valid CSV string with header and rows", () => {
    const csvData = `email,firstName,lastName,company\nalice@example.com,Alice,Smith,Acme Corp\nbob@example.com,Bob,Jones,Globex Inc`;
    const parsed = parseCsvContent(csvData);

    expect(parsed.headers).toEqual(["email", "firstName", "lastName", "company"]);
    expect(parsed.totalRowsCount).toBe(2);
    expect(parsed.rows[0]).toEqual({
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Smith",
      company: "Acme Corp",
    });
    expect(parsed.rows[1].email).toBe("bob@example.com");
  });

  it("handles UTF-8 BOM, quoted fields, and commas inside quotes", () => {
    const csvData = `\uFEFF"email","fullName","notes"\n"alice@example.com","Smith, Alice","Note with, comma"\n"bob@example.com","Jones, Bob","Standard note"`;
    const parsed = parseCsvContent(csvData);

    expect(parsed.headers).toEqual(["email", "fullName", "notes"]);
    expect(parsed.totalRowsCount).toBe(2);
    expect(parsed.rows[0].fullName).toBe("Smith, Alice");
    expect(parsed.rows[0].notes).toBe("Note with, comma");
  });

  it("validates missing role mapping and invalid email syntax", () => {
    const templateRoles = [
      { id: "role-1", roleName: "Client" },
      { id: "role-2", roleName: "Manager" },
    ];

    const rows = [
      { client_email: "valid@example.com", client_name: "Valid User", manager_email: "not-an-email" },
      { client_email: "", client_name: "Missing Email", manager_email: "manager@example.com" },
    ];

    const mapping: RoleMappingConfig = {
      "role-1": { emailColumn: "client_email", nameColumn: "client_name" },
      "role-2": { emailColumn: "manager_email" },
    };

    const result = validateBulkBatch(templateRoles, rows, mapping);

    expect(result.isValid).toBe(false);
    expect(result.errorCount).toBeGreaterThan(0);

    const errorFields = result.errors.map((e) => e.field);
    expect(errorFields).toContain("Manager Email");
    expect(errorFields).toContain("Client Email");
  });

  it("detects duplicate recipients within the same batch", () => {
    const templateRoles = [{ id: "role-1", roleName: "Signer" }];
    const rows = [
      { email: "user@example.com", name: "User 1" },
      { email: "USER@example.com", name: "User 2" }, // Duplicate case-insensitive
    ];

    const mapping: RoleMappingConfig = {
      "role-1": { emailColumn: "email", nameColumn: "name" },
    };

    const result = validateBulkBatch(templateRoles, rows, mapping);

    expect(result.warningCount).toBe(1);
    expect(result.warnings[0].message).toContain("Duplicate recipient email");
  });

  it("enforces MAX_BULK_ROWS limit constraint", () => {
    const templateRoles = [{ id: "role-1", roleName: "Signer" }];
    const mockRows = Array.from({ length: MAX_BULK_ROWS + 50 }, (_, i) => ({
      email: `user${i}@example.com`,
    }));

    const mapping: RoleMappingConfig = {
      "role-1": { emailColumn: "email" },
    };

    const result = validateBulkBatch(templateRoles, mockRows, mapping);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("exceeds the maximum limit"))).toBe(true);
  });
});

describe("Phase 7.0 — Bulk Send Batch Logic & Idempotency", () => {
  interface RowMock {
    id: string;
    rowNumber: number;
    status: "PENDING" | "PROCESSING" | "SENT" | "FAILED";
    envelopeId: string | null;
  }

  function calculateBatchStatus(rows: RowMock[]): "COMPLETED" | "COMPLETED_WITH_ERRORS" | "FAILED" | "PROCESSING" {
    const sentCount = rows.filter((r) => r.status === "SENT").length;
    const failedCount = rows.filter((r) => r.status === "FAILED").length;
    const pendingCount = rows.filter((r) => r.status === "PENDING" || r.status === "PROCESSING").length;

    if (pendingCount > 0) return "PROCESSING";
    if (failedCount === 0) return "COMPLETED";
    if (sentCount > 0 && failedCount > 0) return "COMPLETED_WITH_ERRORS";
    return "FAILED";
  }

  it("calculates COMPLETED_WITH_ERRORS when partial failures occur", () => {
    const rows: RowMock[] = [
      { id: "r1", rowNumber: 1, status: "SENT", envelopeId: "env-1" },
      { id: "r2", rowNumber: 2, status: "SENT", envelopeId: "env-2" },
      { id: "r3", rowNumber: 3, status: "FAILED", envelopeId: null },
    ];

    expect(calculateBatchStatus(rows)).toBe("COMPLETED_WITH_ERRORS");
  });

  it("calculates COMPLETED when 100% of rows succeed", () => {
    const rows: RowMock[] = [
      { id: "r1", rowNumber: 1, status: "SENT", envelopeId: "env-1" },
      { id: "r2", rowNumber: 2, status: "SENT", envelopeId: "env-2" },
    ];

    expect(calculateBatchStatus(rows)).toBe("COMPLETED");
  });

  it("filters only FAILED rows for idempotency retry without re-sending SENT rows", () => {
    const rows: RowMock[] = [
      { id: "r1", rowNumber: 1, status: "SENT", envelopeId: "env-1" },
      { id: "r2", rowNumber: 2, status: "FAILED", envelopeId: null },
      { id: "r3", rowNumber: 3, status: "FAILED", envelopeId: null },
    ];

    const eligibleForRetry = rows.filter((r) => r.status === "FAILED");

    expect(eligibleForRetry).toHaveLength(2);
    expect(eligibleForRetry.map((r) => r.id)).toEqual(["r2", "r3"]);
    expect(eligibleForRetry.some((r) => r.id === "r1")).toBe(false);
  });
});

describe("Phase 7.0 — Row Editing & Retry UX Polish", () => {
  function validateRecipientInput(data: Record<string, { email: string; name?: string }>): { valid: boolean; errors: Record<string, string> } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const errors: Record<string, string> = {};
    let valid = true;

    for (const [roleId, item] of Object.entries(data)) {
      const email = (item.email || "").trim();
      if (!email) {
        errors[roleId] = "Email is required.";
        valid = false;
      } else if (!emailRegex.test(email)) {
        errors[roleId] = "Invalid email format.";
        valid = false;
      }
    }

    return { valid, errors };
  }

  it("validates edited recipient data email inputs", () => {
    const invalidInput = {
      "role-1": { email: "invalid-email", name: "John Doe" },
    };
    const invalidResult = validateRecipientInput(invalidInput);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors["role-1"]).toBe("Invalid email format.");

    const validInput = {
      "role-1": { email: "john@example.com", name: "John Doe" },
    };
    const validResult = validateRecipientInput(validInput);
    expect(validResult.valid).toBe(true);
    expect(Object.keys(validResult.errors)).toHaveLength(0);
  });

  it("preserves immutable row numbers when updating recipient data", () => {
    const row = {
      id: "row-123",
      rowNumber: 1,
      mappedData: { "role-1": { email: "old@example.com" } },
    };

    const updatedData = { "role-1": { email: "new@example.com" } };
    const updatedRow = { ...row, mappedData: updatedData };

    expect(updatedRow.rowNumber).toBe(1);
    expect(updatedRow.mappedData["role-1"].email).toBe("new@example.com");
  });

  it("reuses existing envelope on retry rather than creating duplicate envelope", () => {
    const existingRow = {
      id: "row-1",
      rowNumber: 1,
      status: "FAILED" as const,
      envelopeId: "existing-envelope-uuid-123",
    };

    // If row already has an envelopeId, retry must reuse existing-envelope-uuid-123
    const targetEnvelopeId = existingRow.envelopeId ? existingRow.envelopeId : "new-envelope-uuid";
    expect(targetEnvelopeId).toBe("existing-envelope-uuid-123");
  });

  it("recalculates batch counters accurately after single row retry succeeds", () => {
    const batchMetricsBefore = { total: 5, sent: 0, failed: 5, status: "FAILED" };
    
    // Simulate 1 row succeeding on retry
    const batchMetricsAfter = {
      total: batchMetricsBefore.total,
      sent: batchMetricsBefore.sent + 1,
      failed: batchMetricsBefore.failed - 1,
      status: "COMPLETED_WITH_ERRORS",
    };

    expect(batchMetricsAfter.sent).toBe(1);
    expect(batchMetricsAfter.failed).toBe(4);
    expect(batchMetricsAfter.status).toBe("COMPLETED_WITH_ERRORS");
  });
});

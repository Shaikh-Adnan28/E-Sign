export const MAX_BULK_ROWS = 1000;

export interface RoleMappingConfig {
  [roleId: string]: {
    emailColumn: string;
    nameColumn?: string;
  };
}

export interface BatchReminderConfig {
  reminderEnabled?: boolean;
  reminderFirstAfterDays?: number;
  reminderEveryDays?: number;
  reminderMessage?: string | null;
  expirationDays?: number;
  expirationWarningDays?: number;
}

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRowsCount: number;
}

export interface ValidationErrorItem {
  rowNumber: number;
  field: string;
  message: string;
}

export interface BulkValidationResult {
  isValid: boolean;
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  errors: ValidationErrorItem[];
  warnings: ValidationErrorItem[];
}

/**
 * Robust CSV parser supporting quotes, escaped quotes, commas in quotes, CRLF/LF line breaks, and UTF-8 BOM.
 */
export function parseCsvContent(csvContent: string): CsvParseResult {
  // Strip UTF-8 BOM if present
  const cleanContent = csvContent.replace(/^\uFEFF/, "").trim();
  if (!cleanContent) {
    return { headers: [], rows: [], totalRowsCount: 0 };
  }

  // Parse CSV lines respecting quoted fields with internal newlines
  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < cleanContent.length; i++) {
    const char = cleanContent[i];
    const nextChar = cleanContent[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // Skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRecord.push(currentField.trim());
        currentField = "";
      } else if (char === "\r" && nextChar === "\n") {
        currentRecord.push(currentField.trim());
        records.push(currentRecord);
        currentRecord = [];
        currentField = "";
        i++; // Skip \n
      } else if (char === "\n") {
        currentRecord.push(currentField.trim());
        records.push(currentRecord);
        currentRecord = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRecord.length > 0) {
    currentRecord.push(currentField.trim());
    records.push(currentRecord);
  }

  if (records.length === 0) {
    return { headers: [], rows: [], totalRowsCount: 0 };
  }

  const headers = records[0].map((h) => h.trim().replace(/^"|"$/g, ""));
  const dataRows: Record<string, string>[] = [];

  for (let i = 1; i < records.length; i++) {
    const record = records[i];
    if (record.length === 1 && !record[0]) continue; // Skip trailing empty lines

    const rowObj: Record<string, string> = {};
    headers.forEach((h, colIdx) => {
      rowObj[h] = record[colIdx] ? record[colIdx].trim() : "";
    });
    dataRows.push(rowObj);
  }

  return {
    headers,
    rows: dataRows,
    totalRowsCount: dataRows.length,
  };
}

/**
 * Validates a CSV dataset against template roles and application constraints.
 */
export function validateBulkBatch(
  templateRoleList: Array<{ id: string; roleName: string }>,
  rows: Record<string, string>[],
  roleMapping: RoleMappingConfig
): BulkValidationResult {
  const errors: ValidationErrorItem[] = [];
  const warnings: ValidationErrorItem[] = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (rows.length === 0) {
    errors.push({ rowNumber: 0, field: "CSV", message: "CSV file contains no data rows." });
  }

  if (rows.length > MAX_BULK_ROWS) {
    errors.push({
      rowNumber: 0,
      field: "CSV",
      message: `CSV row count (${rows.length}) exceeds the maximum limit of ${MAX_BULK_ROWS} rows per batch.`,
    });
  }

  // Verify that every template role has an email column mapped
  for (const role of templateRoleList) {
    const mapping = roleMapping[role.id];
    if (!mapping || !mapping.emailColumn) {
      errors.push({
        rowNumber: 0,
        field: role.roleName,
        message: `Missing email column mapping for template role "${role.roleName}".`,
      });
    }
  }

  // Row-level validations
  const seenEmailsByRole = new Map<string, Set<string>>();
  templateRoleList.forEach((r) => seenEmailsByRole.set(r.id, new Set()));

  rows.forEach((row, idx) => {
    const rowNum = idx + 1;

    for (const role of templateRoleList) {
      const mapping = roleMapping[role.id];
      if (!mapping || !mapping.emailColumn) continue;

      const emailVal = (row[mapping.emailColumn] || "").trim();

      if (!emailVal) {
        errors.push({
          rowNumber: rowNum,
          field: `${role.roleName} Email`,
          message: `Missing required email value for role "${role.roleName}".`,
        });
      } else if (!emailRegex.test(emailVal)) {
        errors.push({
          rowNumber: rowNum,
          field: `${role.roleName} Email`,
          message: `Invalid email address "${emailVal}" for role "${role.roleName}".`,
        });
      } else {
        // Duplicate detection within batch
        const roleSet = seenEmailsByRole.get(role.id);
        if (roleSet?.has(emailVal.toLowerCase())) {
          warnings.push({
            rowNumber: rowNum,
            field: `${role.roleName} Email`,
            message: `Duplicate recipient email "${emailVal}" for role "${role.roleName}" in this batch.`,
          });
        } else {
          roleSet?.add(emailVal.toLowerCase());
        }
      }
    }
  });

  const validCount = Math.max(0, rows.length - errors.map((e) => e.rowNumber).filter((r) => r > 0).length);

  return {
    isValid: errors.length === 0,
    totalRows: rows.length,
    validCount,
    warningCount: warnings.length,
    errorCount: errors.length,
    errors,
    warnings,
  };
}

import Papa from "papaparse";

export interface RawTransaction {
  date: string;
  description: string;
  amount: string | number;
  type?: string;
  category?: string;
}

export interface NormalizedTransaction {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  currency: string;
  type: "credit" | "debit";
  category: string | null;
}

export type FileType = "csv" | "xlsx" | "xls" | "pdf";

const DATE_FORMATS = [
  // MM/DD/YYYY
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
  // DD-MM-YYYY
  /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
  // YYYY-MM-DD (already normalized)
  /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
  // MM-DD-YYYY
  /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
];

function normalizeDate(raw: string): string {
  const trimmed = raw.trim();

  // Try YYYY-MM-DD first
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Try MM/DD/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, m, d, y] = slashMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Try DD-MM-YYYY or MM-DD-YYYY (assume MM-DD-YYYY)
  const dashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, m, d, y] = dashMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Fallback: try native Date parsing
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  throw new Error(`Cannot parse date: ${raw}`);
}

function normalizeAmount(raw: string | number): {
  amount: number;
  type: "credit" | "debit";
} {
  const str = String(raw).replace(/[$,\s]/g, "").trim();
  const num = parseFloat(str);

  if (isNaN(num)) {
    throw new Error(`Cannot parse amount: ${raw}`);
  }

  return {
    amount: Math.abs(num),
    type: num >= 0 ? "credit" : "debit",
  };
}

// ============================================================
// CSV PARSING
// ============================================================
export function parseCSV(csvText: string): Promise<RawTransaction[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawTransaction>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) =>
        header.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(
            new Error(
              `CSV parse errors: ${results.errors.map((e) => e.message).join(", ")}`
            )
          );
          return;
        }
        resolve(results.data);
      },
      error: (error: Error) => reject(error),
    });
  });
}

// ============================================================
// EXCEL PARSING (client-side using SheetJS)
// ============================================================
export async function parseExcel(
  arrayBuffer: ArrayBuffer
): Promise<RawTransaction[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });

  // Use the first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Excel file has no sheets");
  }

  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: false,
    defval: "",
  });

  if (jsonData.length === 0) {
    throw new Error("Excel file has no data rows");
  }

  // Normalize headers — find date, description, amount columns
  const firstRow = jsonData[0];
  const headers = Object.keys(firstRow);
  const headerMap = mapHeaders(headers);

  return jsonData.map((row) => ({
    date: String(row[headerMap.date] ?? ""),
    description: String(row[headerMap.description] ?? ""),
    amount: row[headerMap.amount] as string | number,
    type: headerMap.type ? String(row[headerMap.type] ?? "") : undefined,
    category: headerMap.category
      ? String(row[headerMap.category] ?? "")
      : undefined,
  }));
}

// ============================================================
// EXCEL TO CSV (for sending to the API)
// ============================================================
export async function excelToCSV(arrayBuffer: ArrayBuffer): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Excel file has no sheets");
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_csv(sheet);
}

// ============================================================
// HEADER MAPPING — fuzzy match column names
// ============================================================
interface HeaderMapping {
  date: string;
  description: string;
  amount: string;
  type?: string;
  category?: string;
}

function mapHeaders(headers: string[]): HeaderMapping {
  const lower = headers.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));

  const dateCol = findHeader(lower, headers, [
    "date",
    "transaction_date",
    "trans_date",
    "txn_date",
    "posting_date",
    "value_date",
    "book_date",
  ]);

  const descCol = findHeader(lower, headers, [
    "description",
    "narration",
    "particulars",
    "details",
    "memo",
    "transaction_description",
    "remarks",
    "reference",
  ]);

  const amountCol = findHeader(lower, headers, [
    "amount",
    "transaction_amount",
    "debit/credit",
    "value",
    "sum",
    "total",
  ]);

  if (!dateCol || !descCol || !amountCol) {
    throw new Error(
      `Could not find required columns. Found: ${headers.join(", ")}. Need: date, description, amount`
    );
  }

  const typeCol = findHeader(lower, headers, ["type", "transaction_type", "dr/cr", "debit_credit"]);
  const catCol = findHeader(lower, headers, ["category", "group", "tag"]);

  return {
    date: dateCol,
    description: descCol,
    amount: amountCol,
    type: typeCol || undefined,
    category: catCol || undefined,
  };
}

function findHeader(
  lowerHeaders: string[],
  originalHeaders: string[],
  candidates: string[]
): string | null {
  for (const candidate of candidates) {
    const idx = lowerHeaders.indexOf(candidate);
    if (idx !== -1) return originalHeaders[idx];
  }
  // Partial match
  for (const candidate of candidates) {
    const idx = lowerHeaders.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return originalHeaders[idx];
  }
  return null;
}

// ============================================================
// NORMALIZE TRANSACTIONS (shared across all formats)
// ============================================================
export function normalizeTransactions(
  rows: RawTransaction[],
  currency: string = "USD"
): NormalizedTransaction[] {
  return rows.map((row, index) => {
    try {
      const date = normalizeDate(row.date);
      const { amount, type } = normalizeAmount(row.amount);
      const explicitType = row.type?.trim().toLowerCase();

      return {
        date,
        description: row.description?.trim() || `Transaction ${index + 1}`,
        amount,
        currency: currency.toUpperCase(),
        type:
          explicitType === "credit" || explicitType === "debit"
            ? explicitType
            : type,
        category: row.category?.trim() || null,
      };
    } catch (err) {
      throw new Error(
        `Row ${index + 1}: ${err instanceof Error ? err.message : "Parse error"}`
      );
    }
  });
}

// ============================================================
// DETECT FILE TYPE
// ============================================================
export function detectFileType(fileName: string): FileType | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "csv") return "csv";
  if (ext === "xlsx") return "xlsx";
  if (ext === "xls") return "xls";
  if (ext === "pdf") return "pdf";
  return null;
}

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

// ============================================================
// CSV PARSING (client-side, for standard CSVs)
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
// CHECK IF CSV HAS STANDARD HEADERS
// Returns true if we can parse this locally without AI
// ============================================================
export function hasStandardHeaders(csvText: string): boolean {
  const firstLine = csvText.split("\n")[0]?.toLowerCase() ?? "";
  const hasDate = /\bdate\b/.test(firstLine);
  const hasDesc = /\b(description|narration|particulars|details|memo)\b/.test(firstLine);
  const hasAmount = /\b(amount|value|sum)\b/.test(firstLine);
  return hasDate && hasDesc && hasAmount;
}

// ============================================================
// NORMALIZE TRANSACTIONS (shared across all formats)
// ============================================================

/**
 * Smart date parser that handles both DD/MM/YYYY and MM/DD/YYYY.
 * 
 * Logic:
 * - If already YYYY-MM-DD → use as-is
 * - If a/b/YYYY format → check if first number > 12 (must be day) 
 *   or second number > 12 (must be day) to determine DD/MM vs MM/DD
 * - If ambiguous (both <= 12) → assume DD/MM (Indian/European default)
 *   since most bank statements worldwide use DD/MM except US
 * - Validates that month is 1-12 and day is 1-31
 */
function normalizeDate(raw: string): string {
  const trimmed = raw.trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-");
    const mi = parseInt(m), di = parseInt(d);
    // Validate
    if (mi >= 1 && mi <= 12 && di >= 1 && di <= 31) {
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    // Might be YYYY-DD-MM (unlikely but handle it)
    if (di >= 1 && di <= 12 && mi >= 1 && mi <= 31) {
      return `${y}-${d.padStart(2, "0")}-${m.padStart(2, "0")}`;
    }
  }

  // DD/MM/YYYY or MM/DD/YYYY (slash separated)
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    let [, a, b, y] = slashMatch;
    if (y.length === 2) y = (parseInt(y) > 50 ? "19" : "20") + y;
    return smartDayMonth(a, b, y);
  }

  // DD-MM-YYYY or MM-DD-YYYY (dash separated)
  const dashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (dashMatch) {
    let [, a, b, y] = dashMatch;
    if (y.length === 2) y = (parseInt(y) > 50 ? "19" : "20") + y;
    return smartDayMonth(a, b, y);
  }

  // DD.MM.YYYY (dot separated — common in Europe/India)
  const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dotMatch) {
    let [, a, b, y] = dotMatch;
    if (y.length === 2) y = (parseInt(y) > 50 ? "19" : "20") + y;
    return smartDayMonth(a, b, y);
  }

  // DD-Mon-YYYY or DD Mon YYYY (e.g., "15-Jan-2025", "15 Jan 2025")
  const monMatch = trimmed.match(/^(\d{1,2})[\s-](\w{3,9})[\s-](\d{2,4})$/);
  if (monMatch) {
    let [, d, mon, y] = monMatch;
    if (y.length === 2) y = (parseInt(y) > 50 ? "19" : "20") + y;
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const m = months[mon.toLowerCase().slice(0, 3)];
    if (m) return `${y}-${m}-${d.padStart(2, "0")}`;
  }

  // Fallback: native Date parsing
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  throw new Error(`Cannot parse date: ${raw}`);
}

/**
 * Given two numbers (a, b) and year, figure out which is day and which is month.
 * - If a > 12 → a must be day, b is month (DD/MM format)
 * - If b > 12 → b must be day, a is month (MM/DD format)
 * - If both <= 12 → assume DD/MM (Indian/European convention)
 */
function smartDayMonth(a: string, b: string, y: string): string {
  const ai = parseInt(a);
  const bi = parseInt(b);

  let month: number, day: number;

  if (ai > 12 && bi <= 12) {
    // a is definitely the day (e.g., 25/01/2025 → DD/MM)
    day = ai;
    month = bi;
  } else if (bi > 12 && ai <= 12) {
    // b is definitely the day (e.g., 01/25/2025 → MM/DD)
    month = ai;
    day = bi;
  } else {
    // Ambiguous (both <= 12) → default to DD/MM (Indian/European)
    day = ai;
    month = bi;
  }

  // Final validation
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`Invalid date values: ${a}/${b}/${y}`);
  }

  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeAmount(raw: string | number): {
  amount: number;
  type: "credit" | "debit";
} {
  // Strip currency symbols (₹, $, €, £, ¥), commas, spaces
  const str = String(raw).replace(/[₹$€£¥,\s]/g, "").trim();
  const num = parseFloat(str);

  if (isNaN(num)) {
    throw new Error(`Cannot parse amount: ${raw}`);
  }

  return {
    amount: Math.abs(num),
    type: num >= 0 ? "credit" : "debit",
  };
}

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

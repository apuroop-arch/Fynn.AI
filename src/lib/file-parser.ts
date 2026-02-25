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
function normalizeDate(raw: string): string {
  const trimmed = raw.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // MM/DD/YYYY or DD/MM/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, a, b, y] = slashMatch;
    return `${y}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`;
  }

  // DD-MM-YYYY or MM-DD-YYYY
  const dashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, a, b, y] = dashMatch;
    return `${y}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`;
  }

  // Fallback: native Date parsing
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

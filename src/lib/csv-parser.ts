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

"use client";

import { useState, useCallback } from "react";
import {
  Upload,
  FileText,
  Check,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  File,
} from "lucide-react";
import type { NormalizedTransaction } from "@/lib/file-parser";

type UploadStep = "select" | "parsing" | "preview" | "importing" | "done";
type FileType = "csv" | "xlsx" | "xls" | "pdf";

const FILE_TYPE_CONFIG: Record<
  FileType,
  { label: string; icon: typeof FileText; color: string }
> = {
  csv: { label: "CSV", icon: FileText, color: "text-emerald-600" },
  xlsx: { label: "Excel", icon: FileSpreadsheet, color: "text-blue-600" },
  xls: { label: "Excel", icon: FileSpreadsheet, color: "text-blue-600" },
  pdf: { label: "PDF", icon: File, color: "text-red-600" },
};

function detectFileType(fileName: string): FileType | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "csv") return "csv";
  if (ext === "xlsx") return "xlsx";
  if (ext === "xls") return "xls";
  if (ext === "pdf") return "pdf";
  return null;
}

export default function UploadPage() {
  const [step, setStep] = useState<UploadStep>("select");
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState<FileType | null>(null);
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<NormalizedTransaction[]>([]);
  const [error, setError] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [currency, setCurrency] = useState("USD");

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      setError("");
      const file = e.target.files?.[0];
      if (!file) return;

      const detectedType = detectFileType(file.name);
      if (!detectedType) {
        setError(
          "Unsupported file format. Please upload a CSV, Excel (.xlsx/.xls), or PDF file."
        );
        return;
      }

      setFileName(file.name);
      setFileType(detectedType);

      try {
        if (detectedType === "csv") {
          await handleCSV(file);
        } else if (detectedType === "xlsx" || detectedType === "xls") {
          await handleExcel(file);
        } else if (detectedType === "pdf") {
          await handlePDF(file);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to parse file"
        );
        setStep("select");
      }
    },
    [currency]
  );

  const handleCSV = async (file: File) => {
    const text = await file.text();
    setCsvText(text);

    const { parseCSV, normalizeTransactions } = await import(
      "@/lib/file-parser"
    );
    const raw = await parseCSV(text);
    const normalized = normalizeTransactions(raw, currency);
    setPreview(normalized);
    setStep("preview");
  };

  const handleExcel = async (file: File) => {
    setStep("parsing");
    const arrayBuffer = await file.arrayBuffer();

    const { parseExcel, excelToCSV, normalizeTransactions } = await import(
      "@/lib/file-parser"
    );

    // Parse for preview
    const raw = await parseExcel(arrayBuffer);
    const normalized = normalizeTransactions(raw, currency);
    setPreview(normalized);

    // Convert to CSV for API upload
    const csv = await excelToCSV(arrayBuffer);
    setCsvText(csv);
    setStep("preview");
  };

  const handlePDF = async (file: File) => {
    setStep("parsing");

    // Send PDF to server for AI extraction
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/transactions/parse-pdf", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to parse PDF");
    }

    const extractedCSV = data.csvText;
    setCsvText(extractedCSV);

    // Parse the extracted CSV for preview
    const { parseCSV, normalizeTransactions } = await import(
      "@/lib/file-parser"
    );
    const raw = await parseCSV(extractedCSV);
    const normalized = normalizeTransactions(raw, currency);
    setPreview(normalized);
    setStep("preview");
  };

  const handleImport = async () => {
    setStep("importing");
    setError("");

    try {
      const res = await fetch("/api/transactions/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, currency }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      setResultMessage(data.message);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    }
  };

  const reset = () => {
    setStep("select");
    setFileName("");
    setFileType(null);
    setCsvText("");
    setPreview([]);
    setError("");
    setResultMessage("");
  };

  const typeConfig = fileType ? FILE_TYPE_CONFIG[fileType] : null;
  const TypeIcon = typeConfig?.icon ?? FileText;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">
          Upload Bank Statement
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Import transactions from CSV, Excel, or PDF files
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Step: Select File */}
      {step === "select" && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="INR">INR</option>
              <option value="CAD">CAD</option>
              <option value="AUD">AUD</option>
            </select>
          </div>

          <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 py-16 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors">
            <Upload className="h-10 w-10 text-zinc-400 mb-3" />
            <p className="text-sm font-medium text-zinc-600">
              Click to upload bank statement
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Supports CSV, Excel (.xlsx, .xls), and PDF formats
            </p>
            <div className="flex items-center gap-3 mt-4">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <FileText className="h-3 w-3" />
                CSV
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700">
                <FileSpreadsheet className="h-3 w-3" />
                Excel
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700">
                <File className="h-3 w-3" />
                PDF
              </span>
            </div>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>

          <div className="mt-4 rounded-lg bg-zinc-50 border border-zinc-100 p-4">
            <p className="text-xs font-medium text-zinc-600 mb-2">
              File requirements
            </p>
            <ul className="space-y-1 text-xs text-zinc-500">
              <li>
                <span className="font-medium text-zinc-600">CSV / Excel:</span>{" "}
                Must have columns for date, description, and amount
              </li>
              <li>
                <span className="font-medium text-zinc-600">PDF:</span>{" "}
                Bank statement with transaction table — AI will extract
                transactions automatically
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Step: Parsing */}
      {step === "parsing" && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white py-16">
          <Loader2 className="h-8 w-8 text-emerald-600 animate-spin mb-4" />
          <p className="text-sm font-medium text-zinc-600">
            {fileType === "pdf"
              ? "AI is extracting transactions from your PDF..."
              : "Parsing your file..."}
          </p>
          {fileType === "pdf" && (
            <p className="text-xs text-zinc-400 mt-1">
              This may take a few seconds
            </p>
          )}
        </div>
      )}

      {/* Step: Preview */}
      {step === "preview" && (
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <TypeIcon
                className={`h-5 w-5 ${typeConfig?.color ?? "text-zinc-400"}`}
              />
              <span className="text-sm font-medium text-zinc-900">
                {fileName}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  fileType === "pdf"
                    ? "bg-red-50 text-red-700"
                    : fileType === "xlsx" || fileType === "xls"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {typeConfig?.label}
              </span>
              <span className="text-xs text-zinc-400">
                ({preview.length} rows)
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
              >
                Import {preview.length} Transactions
              </button>
            </div>
          </div>

          {fileType === "pdf" && (
            <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-100 px-6 py-2.5">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700">
                Transactions were extracted from PDF using AI. Please review
                before importing.
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left">
                  <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase">
                    Description
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase text-right">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase">
                    Category
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 50).map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-zinc-50 hover:bg-zinc-50"
                  >
                    <td className="px-6 py-3 text-zinc-600 whitespace-nowrap">
                      {row.date}
                    </td>
                    <td className="px-6 py-3 text-zinc-900 max-w-xs truncate">
                      {row.description}
                    </td>
                    <td className="px-6 py-3 text-right font-mono whitespace-nowrap">
                      <span
                        className={
                          row.type === "credit"
                            ? "text-emerald-600"
                            : "text-red-600"
                        }
                      >
                        {row.type === "debit" ? "-" : "+"}
                        {row.currency} {row.amount.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.type === "credit"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {row.type}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-zinc-500">
                      {row.category ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 50 && (
              <p className="px-6 py-3 text-xs text-zinc-400">
                Showing first 50 of {preview.length} rows
              </p>
            )}
          </div>
        </div>
      )}

      {/* Step: Importing */}
      {step === "importing" && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white py-16">
          <Loader2 className="h-8 w-8 text-emerald-600 animate-spin mb-4" />
          <p className="text-sm font-medium text-zinc-600">
            Importing transactions...
          </p>
        </div>
      )}

      {/* Step: Done */}
      {step === "done" && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 mb-4">
            <Check className="h-6 w-6 text-emerald-600" />
          </div>
          <p className="text-sm font-medium text-zinc-900">{resultMessage}</p>
          <button
            onClick={reset}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            Upload Another File
          </button>
        </div>
      )}
    </div>
  );
}


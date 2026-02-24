"use client";

import { useState, useCallback } from "react";
import { Upload, FileText, Check, AlertCircle, Loader2 } from "lucide-react";
import type { NormalizedTransaction } from "@/lib/csv-parser";

type UploadStep = "select" | "preview" | "importing" | "done";

export default function UploadPage() {
  const [step, setStep] = useState<UploadStep>("select");
  const [fileName, setFileName] = useState("");
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

      if (!file.name.endsWith(".csv")) {
        setError("Please upload a CSV file");
        return;
      }

      setFileName(file.name);
      const text = await file.text();
      setCsvText(text);

      // Client-side preview parse
      try {
        const { parseCSV, normalizeTransactions } = await import(
          "@/lib/csv-parser"
        );
        const raw = await parseCSV(text);
        const normalized = normalizeTransactions(raw, currency);
        setPreview(normalized);
        setStep("preview");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse CSV");
      }
    },
    [currency]
  );

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
    setCsvText("");
    setPreview([]);
    setError("");
    setResultMessage("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">
          Upload Bank Statement
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Import transactions from a CSV file
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
              Click to upload CSV
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Required columns: date, description, amount
            </p>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        </div>
      )}

      {/* Step: Preview */}
      {step === "preview" && (
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-900">
                {fileName}
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

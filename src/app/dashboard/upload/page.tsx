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
  Sparkles,
  Zap,
} from "lucide-react";
import type { NormalizedTransaction } from "@/lib/file-parser";

type UploadStep = "select" | "parsing" | "preview" | "importing" | "done";

const ACCEPTED_EXTENSIONS = ".csv,.xlsx,.xls,.pdf";
const UPLOAD_BATCH_SIZE = 200; // Send 200 transactions per API call

interface ProgressState {
  percent: number;
  message: string;
  stage: string;
  transactionsFound?: number;
  completedChunks?: number;
  totalChunks?: number;
}

export default function UploadPage() {
  const [step, setStep] = useState<UploadStep>("select");
  const [fileName, setFileName] = useState("");
  const [fileExt, setFileExt] = useState("");
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<NormalizedTransaction[]>([]);
  const [error, setError] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [parsedByAI, setParsedByAI] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [progress, setProgress] = useState<ProgressState>({
    percent: 0,
    message: "Starting...",
    stage: "init",
  });

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      setError("");
      setParsedByAI(false);
      const file = e.target.files?.[0];
      if (!file) return;

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!["csv", "xlsx", "xls", "pdf"].includes(ext)) {
        setError("Unsupported format. Please upload CSV, Excel, or PDF.");
        return;
      }

      setFileName(file.name);
      setFileExt(ext);

      // For CSV, try local parsing first
      if (ext === "csv") {
        try {
          setProgress({ percent: 10, message: "Reading file...", stage: "reading" });
          setStep("parsing");
          const text = await file.text();

          const { hasStandardHeaders, parseCSV, normalizeTransactions } =
            await import("@/lib/file-parser");

          if (hasStandardHeaders(text)) {
            setProgress({ percent: 60, message: "Parsing transactions...", stage: "parsing" });
            const raw = await parseCSV(text);
            const normalized = normalizeTransactions(raw, currency);
            setCsvText(text);
            setPreview(normalized);
            setStep("preview");
            return;
          }
        } catch {
          // Local parse failed
        }
      }

      // AI parsing with streaming progress
      await parseWithAI(file);
    },
    [currency]
  );

  const parseWithAI = async (file: File) => {
    setStep("parsing");
    setParsedByAI(true);
    setProgress({ percent: 0, message: "Uploading file...", stage: "uploading" });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("stream", "true");

      const res = await fetch("/api/transactions/parse-file", {
        method: "POST",
        body: formData,
      });

      // Check if it's a streaming response (SSE) or regular JSON
      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        // ---- STREAMING MODE: read SSE events ----
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";
        let finalCSV = "";
        let finalRowCount = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const events = buffer.split("\n\n");
          buffer = events.pop() || ""; // Keep incomplete event in buffer

          for (const event of events) {
            const dataLine = event.trim();
            if (!dataLine.startsWith("data: ")) continue;

            try {
              const data = JSON.parse(dataLine.slice(6));

              if (data.type === "progress") {
                setProgress({
                  percent: data.percent || 0,
                  message: data.message || "Processing...",
                  stage: data.stage || "extracting",
                  transactionsFound: data.transactionsFound,
                  completedChunks: data.completedChunks,
                  totalChunks: data.totalChunks,
                });
              } else if (data.type === "complete") {
                finalCSV = data.csvText;
                finalRowCount = data.rowCount;
                setProgress({
                  percent: 100,
                  message: `Done! ${finalRowCount} transactions extracted`,
                  stage: "complete",
                  transactionsFound: finalRowCount,
                });
              } else if (data.type === "error") {
                throw new Error(data.message || "Parsing failed");
              }
            } catch (parseErr) {
              if (parseErr instanceof Error && parseErr.message !== "Parsing failed") {
                // JSON parse error, skip this event
                continue;
              }
              throw parseErr;
            }
          }
        }

        if (!finalCSV) throw new Error("No transactions extracted");

        // Parse for preview
        setCsvText(finalCSV);
        const { parseCSV, normalizeTransactions } = await import("@/lib/file-parser");
        const raw = await parseCSV(finalCSV);
        const normalized = normalizeTransactions(raw, currency);
        setPreview(normalized);
        setStep("preview");

      } else {
        // ---- REGULAR JSON RESPONSE (local parse succeeded on server) ----
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to parse file");

        setCsvText(data.csvText);
        setProgress({ percent: 90, message: "Preparing preview...", stage: "preview" });

        const { parseCSV, normalizeTransactions } = await import("@/lib/file-parser");
        const raw = await parseCSV(data.csvText);
        const normalized = normalizeTransactions(raw, currency);
        setPreview(normalized);
        setStep("preview");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
      setStep("select");
    }
  };

  // ================================================================
  // FIXED: Send pre-parsed transactions in batches, not raw CSV text
  // ================================================================
  const handleImport = async () => {
    setStep("importing");
    setError("");

    try {
      const totalBatches = Math.ceil(preview.length / UPLOAD_BATCH_SIZE);
      let totalImported = 0;

      for (let i = 0; i < preview.length; i += UPLOAD_BATCH_SIZE) {
        const batch = preview.slice(i, i + UPLOAD_BATCH_SIZE);
        const batchNum = Math.floor(i / UPLOAD_BATCH_SIZE) + 1;

        setImportProgress({ current: batchNum, total: totalBatches });

        const res = await fetch("/api/transactions/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactions: batch.map((t) => ({
              date: t.date,
              description: t.description,
              amount: t.amount,
              currency: t.currency,
              type: t.type,
              category: t.category,
            })),
            currency,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Batch ${batchNum} failed`);

        totalImported += data.count || batch.length;
      }

      setResultMessage(`Successfully imported ${totalImported} transactions`);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    }
  };

  const reset = () => {
    setStep("select");
    setFileName("");
    setFileExt("");
    setCsvText("");
    setPreview([]);
    setError("");
    setResultMessage("");
    setParsedByAI(false);
    setImportProgress({ current: 0, total: 0 });
    setProgress({ percent: 0, message: "Starting...", stage: "init" });
  };

  const FileIcon =
    fileExt === "pdf" ? File : fileExt === "xlsx" || fileExt === "xls" ? FileSpreadsheet : FileText;

  const fileColor =
    fileExt === "pdf" ? "text-red-600" : fileExt === "xlsx" || fileExt === "xls" ? "text-blue-600" : "text-emerald-600";

  const fileBadgeClass =
    fileExt === "pdf" ? "bg-red-50 text-red-700" : fileExt === "xlsx" || fileExt === "xls" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700";

  const fileLabel = fileExt === "pdf" ? "PDF" : fileExt === "xlsx" || fileExt === "xls" ? "Excel" : "CSV";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Upload Bank Statement</h1>
        <p className="text-sm text-zinc-500 mt-1">Import transactions from CSV, Excel, or PDF files</p>
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
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-12 transition-all hover:border-emerald-400 hover:bg-emerald-50/30">
              <Upload className="mb-3 h-10 w-10 text-zinc-400" />
              <p className="text-sm font-medium text-zinc-600 mb-1">
                Drop your bank statement here
              </p>
              <p className="text-xs text-zinc-400 mb-3">or click to browse</p>
              <div className="flex gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  <FileText className="h-3 w-3" /> CSV
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700">
                  <FileSpreadsheet className="h-3 w-3" /> Excel
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700">
                  <File className="h-3 w-3" /> PDF
                </span>
              </div>
              <input type="file" accept={ACCEPTED_EXTENSIONS} className="hidden" onChange={handleFileSelect} />
            </label>

            <div className="mt-4 rounded-lg bg-zinc-50 border border-zinc-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                <p className="text-xs font-medium text-zinc-600">Universal AI-powered parser</p>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Fynn uses AI to automatically detect and extract transactions from any bank statement format — HDFC, SBI, Chase, Barclays, DBS, and hundreds more.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step: Parsing — with real progress bar */}
      {step === "parsing" && (
        <div className="rounded-xl border border-zinc-200 bg-white p-8">
          <div className="flex flex-col items-center">
            {/* File info */}
            <div className="flex items-center gap-2 mb-6">
              <FileIcon className={`h-5 w-5 ${fileColor}`} />
              <span className="text-sm font-medium text-zinc-700">{fileName}</span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${fileBadgeClass}`}>
                {fileLabel}
              </span>
            </div>

            {/* Animated icon */}
            <div className="relative mb-6">
              <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center">
                {parsedByAI ? (
                  <Sparkles className="h-7 w-7 text-emerald-600 animate-pulse" />
                ) : (
                  <Zap className="h-7 w-7 text-emerald-600 animate-pulse" />
                )}
              </div>
              {/* Spinning ring */}
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-500 animate-spin" />
            </div>

            {/* Progress bar */}
            <div className="w-full max-w-md mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-zinc-600">
                  {parsedByAI ? "AI Extraction" : "Local Parsing"}
                </span>
                <span className="text-xs font-semibold text-emerald-600">
                  {progress.percent}%
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700 ease-out"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>

            {/* Status message */}
            <p className="text-sm text-zinc-600 text-center">{progress.message}</p>

            {/* Chunk details (shown during chunked processing) */}
            {progress.totalChunks && progress.totalChunks > 1 && (
              <div className="mt-4 flex items-center gap-4 text-xs text-zinc-400">
                <span>
                  Batches: {progress.completedChunks || 0}/{progress.totalChunks}
                </span>
                {progress.transactionsFound !== undefined && (
                  <span>
                    Transactions found: {progress.transactionsFound}
                  </span>
                )}
              </div>
            )}

            {parsedByAI && (
              <p className="text-xs text-zinc-400 mt-3">
                Large files are split into batches and processed in parallel
              </p>
            )}
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === "preview" && (
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <FileIcon className={`h-5 w-5 ${fileColor}`} />
              <span className="text-sm font-medium text-zinc-900">{fileName}</span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${fileBadgeClass}`}>
                {fileLabel}
              </span>
              {parsedByAI && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-xs font-medium text-violet-700">
                  <Sparkles className="h-3 w-3" /> AI Extracted
                </span>
              )}
              <span className="text-xs text-zinc-400">({preview.length} transactions)</span>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 bg-white hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="USD">$ USD</option>
                <option value="INR">₹ INR</option>
                <option value="GBP">£ GBP</option>
                <option value="EUR">€ EUR</option>
                <option value="CAD">$ CAD</option>
                <option value="AUD">$ AUD</option>
                <option value="SGD">$ SGD</option>
              </select>
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

          {parsedByAI && (
            <div className="flex items-center gap-2 bg-violet-50 border-b border-violet-100 px-6 py-2.5">
              <Sparkles className="h-3.5 w-3.5 text-violet-600 shrink-0" />
              <p className="text-xs text-violet-700">
                Transactions were extracted using AI. Please review before importing.
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left">
                  <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase text-right">Amount</th>
                  <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase">Type</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 50).map((row, i) => (
                  <tr key={i} className="border-b border-zinc-50 hover:bg-zinc-50">
                    <td className="px-6 py-3 text-zinc-600 whitespace-nowrap">{row.date}</td>
                    <td className="px-6 py-3 text-zinc-900 max-w-xs truncate">{row.description}</td>
                    <td className="px-6 py-3 text-right font-mono whitespace-nowrap">
                      <span className={row.type === "credit" ? "text-emerald-600" : "text-red-600"}>
                        {row.type === "debit" ? "-" : "+"}{row.currency} {row.amount.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.type === "credit" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                      }`}>
                        {row.type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 50 && (
              <p className="px-6 py-3 text-xs text-zinc-400">
                Showing first 50 of {preview.length} transactions
              </p>
            )}
          </div>
        </div>
      )}

      {/* Step: Importing — NOW WITH BATCH PROGRESS */}
      {step === "importing" && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white py-16">
          <Loader2 className="h-8 w-8 text-emerald-600 animate-spin mb-4" />
          <p className="text-sm font-medium text-zinc-600">Importing transactions...</p>
          {importProgress.total > 1 && (
            <div className="mt-3 w-64">
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Batch {importProgress.current} of {importProgress.total}</span>
                <span>{Math.round((importProgress.current / importProgress.total) * 100)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
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

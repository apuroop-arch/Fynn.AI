"use client";

import { useState } from "react";
import {
  SearchX,
  Loader2,
  AlertTriangle,
  DollarSign,
  Clock,
  Copy,
  RefreshCw,
} from "lucide-react";

interface LeakageAnalysis {
  unpaid_invoices?: Record<
    string,
    { client_name: string; amount: number; days_overdue: number }[]
  >;
  inactive_subscriptions?: {
    description: string;
    amount: number;
    last_activity: string;
  }[];
  duplicate_charges?: {
    description: string;
    amount: number;
    dates: string[];
  }[];
  summary?: {
    total_leakage_identified: number;
    unpaid_invoice_total: number;
    inactive_subscription_total: number;
    duplicate_charge_total: number;
    top_recommendations: string[];
  };
  raw_analysis?: string;
}

export default function LeakagePage() {
  const [analysis, setAnalysis] = useState<LeakageAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [noData, setNoData] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    setError("");
    setNoData(false);

    try {
      const res = await fetch("/api/leakage/analyze", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      if (!data.analysis) {
        setNoData(true);
        return;
      }

      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            Revenue Leakage Detector
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            AI-powered analysis of unpaid invoices, inactive subscriptions, and
            duplicate charges
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {loading ? "Analyzing..." : "Run Analysis"}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {noData && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white py-16">
          <SearchX className="h-10 w-10 text-zinc-300 mb-4" />
          <p className="text-sm font-medium text-zinc-500">
            No data to analyze
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            Upload bank statements or invoices first
          </p>
        </div>
      )}

      {!analysis && !loading && !noData && !error && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white py-16">
          <SearchX className="h-10 w-10 text-zinc-300 mb-4" />
          <p className="text-sm font-medium text-zinc-500">
            Click &quot;Run Analysis&quot; to detect revenue leakage
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            Powered by Claude AI
          </p>
        </div>
      )}

      {analysis && (
        <div className="space-y-6">
          {/* Summary Cards */}
          {analysis.summary && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-red-600" />
                  <span className="text-xs font-medium text-red-600 uppercase">
                    Total Leakage
                  </span>
                </div>
                <p className="text-2xl font-bold text-red-700">
                  {fmt(analysis.summary.total_leakage_identified)}
                </p>
              </div>
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <span className="text-xs font-medium text-orange-600 uppercase">
                    Unpaid Invoices
                  </span>
                </div>
                <p className="text-2xl font-bold text-orange-700">
                  {fmt(analysis.summary.unpaid_invoice_total)}
                </p>
              </div>
              <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-xs font-medium text-yellow-600 uppercase">
                    Inactive Subs
                  </span>
                </div>
                <p className="text-2xl font-bold text-yellow-700">
                  {fmt(analysis.summary.inactive_subscription_total)}/mo
                </p>
              </div>
              <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Copy className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-medium text-purple-600 uppercase">
                    Duplicates
                  </span>
                </div>
                <p className="text-2xl font-bold text-purple-700">
                  {fmt(analysis.summary.duplicate_charge_total)}
                </p>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {analysis.summary?.top_recommendations && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h2 className="text-base font-semibold text-zinc-900 mb-4">
                Recommendations
              </h2>
              <ul className="space-y-3">
                {analysis.summary.top_recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                      {i + 1}
                    </span>
                    <p className="text-sm text-zinc-700">{rec}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Unpaid Invoices by Aging Bucket */}
          {analysis.unpaid_invoices && (
            <div className="rounded-xl border border-zinc-200 bg-white">
              <div className="border-b border-zinc-200 px-6 py-4">
                <h2 className="text-base font-semibold text-zinc-900">
                  Unpaid Invoices by Aging
                </h2>
              </div>
              <div className="p-6 space-y-4">
                {Object.entries(analysis.unpaid_invoices).map(
                  ([bucket, invoices]) => (
                    <div key={bucket}>
                      <h3 className="text-sm font-medium text-zinc-600 mb-2">
                        {bucket}
                      </h3>
                      {Array.isArray(invoices) && invoices.length > 0 ? (
                        <div className="space-y-2">
                          {invoices.map((inv, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-2.5"
                            >
                              <span className="text-sm text-zinc-700">
                                {inv.client_name}
                              </span>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-zinc-500">
                                  {inv.days_overdue}d overdue
                                </span>
                                <span className="text-sm font-semibold text-red-600">
                                  {fmt(inv.amount)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400">
                          No invoices in this bucket
                        </p>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* Raw Analysis Fallback */}
          {analysis.raw_analysis && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h2 className="text-base font-semibold text-zinc-900 mb-4">
                Analysis
              </h2>
              <pre className="whitespace-pre-wrap text-sm text-zinc-700">
                {analysis.raw_analysis}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

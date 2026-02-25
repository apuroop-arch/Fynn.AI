"use client";

import { useState } from "react";
import {
  FileText,
  Loader2,
  AlertTriangle,
  RefreshCw,
  AlertCircle,
  Lightbulb,
  TrendingUp,
  Eye,
  Calendar,
  CheckCircle2,
  ArrowRight,
  Copy,
  Check,
} from "lucide-react";

interface BriefingContent {
  greeting?: string;
  current_status?: string;
  top_concern?: {
    title: string;
    detail: string;
    impact: string;
  };
  recommended_action?: {
    title: string;
    steps: string[];
    deadline: string;
  };
  forward_look?: {
    title: string;
    detail: string;
  };
  positive_close?: {
    title: string;
    detail: string;
  };
  full_narrative?: string;
}

interface BriefingMetadata {
  generated_date?: string;
  word_count?: number;
  data_freshness?: string;
  key_metrics?: {
    total_receivables: number;
    overdue_amount: number;
    monthly_income_trend: "up" | "down" | "stable";
    cash_position: number;
  };
  tone_check?: string;
}

interface BriefingData {
  briefing?: BriefingContent;
  metadata?: BriefingMetadata;
  raw_analysis?: string;
}

const trendConfig = {
  up: { icon: TrendingUp, text: "text-emerald-600", label: "Trending Up" },
  down: { icon: TrendingUp, text: "text-red-600", label: "Trending Down" },
  stable: { icon: TrendingUp, text: "text-blue-600", label: "Stable" },
};

export default function BriefingPage() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [noData, setNoData] = useState(false);
  const [viewMode, setViewMode] = useState<"structured" | "narrative">("structured");
  const [copied, setCopied] = useState(false);

  const generateBriefing = async () => {
    setLoading(true);
    setError("");
    setNoData(false);

    try {
      const res = await fetch("/api/briefing/generate", { method: "POST" });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error);

      if (!result.briefing) {
        setNoData(true);
        return;
      }

      setData(result.briefing);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Briefing generation failed");
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number | null | undefined) => {
    const val = Number(n);
    if (isNaN(val)) return "$0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const copyNarrative = async () => {
    if (data?.briefing?.full_narrative) {
      await navigator.clipboard.writeText(data.briefing.full_narrative);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const briefing = data?.briefing;
  const metadata = data?.metadata;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Weekly Briefing</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Your AI-generated plain-English financial summary
          </p>
        </div>
        <button
          onClick={generateBriefing}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {loading ? "Generating..." : "Generate Briefing"}
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
          <FileText className="h-10 w-10 text-zinc-300 mb-4" />
          <p className="text-sm font-medium text-zinc-500">No data for briefing</p>
          <p className="text-xs text-zinc-400 mt-1">Upload bank statements or invoices first</p>
        </div>
      )}

      {!data && !loading && !noData && !error && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white py-16">
          <FileText className="h-10 w-10 text-zinc-300 mb-4" />
          <p className="text-sm font-medium text-zinc-500">
            Click &quot;Generate Briefing&quot; for your weekly financial summary
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            A personalized, plain-English narrative — like having a CFO check in every week
          </p>
        </div>
      )}

      {data && briefing && (
        <div className="space-y-6">
          {/* View Mode Toggle + Metadata */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5">
                <button
                  onClick={() => setViewMode("structured")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    viewMode === "structured"
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  Structured
                </button>
                <button
                  onClick={() => setViewMode("narrative")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    viewMode === "narrative"
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  Full Narrative
                </button>
              </div>
            </div>
            {metadata && (
              <div className="flex items-center gap-4 text-xs text-zinc-400">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {metadata.generated_date}
                </span>
                {metadata.word_count && (
                  <span>{metadata.word_count} words</span>
                )}
              </div>
            )}
          </div>

          {/* Key Metrics Strip */}
          {metadata?.key_metrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
                <p className="text-xs text-zinc-500 mb-0.5">Receivables</p>
                <p className="text-lg font-bold text-zinc-900">{fmt(metadata.key_metrics.total_receivables)}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
                <p className="text-xs text-zinc-500 mb-0.5">Overdue</p>
                <p className={`text-lg font-bold ${metadata.key_metrics.overdue_amount > 0 ? "text-red-700" : "text-emerald-700"}`}>
                  {fmt(metadata.key_metrics.overdue_amount)}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
                <p className="text-xs text-zinc-500 mb-0.5">Cash Position</p>
                <p className="text-lg font-bold text-zinc-900">{fmt(metadata.key_metrics.cash_position)}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
                <p className="text-xs text-zinc-500 mb-0.5">Income Trend</p>
                <p className={`text-lg font-bold capitalize ${trendConfig[metadata.key_metrics.monthly_income_trend]?.text || "text-zinc-600"}`}>
                  {trendConfig[metadata.key_metrics.monthly_income_trend]?.label || metadata.key_metrics.monthly_income_trend}
                </p>
              </div>
            </div>
          )}

          {/* Narrative View */}
          {viewMode === "narrative" && briefing.full_narrative && (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <div className="border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-zinc-500" />
                  <h2 className="text-base font-semibold text-zinc-900">Weekly Briefing</h2>
                </div>
                <button
                  onClick={copyNarrative}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <div className="p-8 max-w-2xl">
                {briefing.greeting && (
                  <p className="text-base text-zinc-700 mb-4 italic">{briefing.greeting}</p>
                )}
                <div className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">
                  {briefing.full_narrative}
                </div>
              </div>
            </div>
          )}

          {/* Structured View */}
          {viewMode === "structured" && (
            <div className="space-y-4">
              {/* Greeting */}
              {briefing.greeting && (
                <div className="rounded-xl border border-zinc-200 bg-white p-6">
                  <p className="text-lg text-zinc-700 italic">{briefing.greeting}</p>
                </div>
              )}

              {/* Current Status */}
              {briefing.current_status && (
                <div className="rounded-xl border border-zinc-200 bg-white p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="h-4 w-4 text-blue-600" />
                    <h3 className="text-sm font-semibold text-zinc-900 uppercase">This Week&apos;s Snapshot</h3>
                  </div>
                  <p className="text-sm text-zinc-700 leading-relaxed">{briefing.current_status}</p>
                </div>
              )}

              {/* Top Concern */}
              {briefing.top_concern && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <h3 className="text-sm font-semibold text-red-800 uppercase">Top Concern</h3>
                  </div>
                  <p className="text-base font-semibold text-zinc-900 mb-2">{briefing.top_concern.title}</p>
                  <p className="text-sm text-zinc-700 leading-relaxed">{briefing.top_concern.detail}</p>
                  {briefing.top_concern.impact && (
                    <p className="text-sm text-red-700 font-medium mt-2">
                      Impact if not addressed: {briefing.top_concern.impact}
                    </p>
                  )}
                </div>
              )}

              {/* Recommended Action */}
              {briefing.recommended_action && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="h-4 w-4 text-emerald-600" />
                    <h3 className="text-sm font-semibold text-emerald-800 uppercase">Recommended Action</h3>
                  </div>
                  <p className="text-base font-semibold text-zinc-900 mb-3">{briefing.recommended_action.title}</p>
                  {briefing.recommended_action.steps && briefing.recommended_action.steps.length > 0 && (
                    <div className="space-y-2">
                      {briefing.recommended_action.steps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center text-xs font-bold mt-0.5">
                            {idx + 1}
                          </div>
                          <p className="text-sm text-zinc-700">{step}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {briefing.recommended_action.deadline && (
                    <div className="flex items-center gap-1 mt-3 text-xs text-emerald-700 font-medium">
                      <ArrowRight className="h-3 w-3" />
                      Complete by: {briefing.recommended_action.deadline}
                    </div>
                  )}
                </div>
              )}

              {/* 14-Day Forward Look */}
              {briefing.forward_look && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <h3 className="text-sm font-semibold text-blue-800 uppercase">{briefing.forward_look.title || "Next 14 Days"}</h3>
                  </div>
                  <p className="text-sm text-zinc-700 leading-relaxed">{briefing.forward_look.detail}</p>
                </div>
              )}

              {/* Positive Close */}
              {briefing.positive_close && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-4 w-4 text-amber-600" />
                    <h3 className="text-sm font-semibold text-amber-800 uppercase">Bright Spot</h3>
                  </div>
                  <p className="text-base font-semibold text-zinc-900 mb-2">{briefing.positive_close.title}</p>
                  <p className="text-sm text-zinc-700 leading-relaxed">{briefing.positive_close.detail}</p>
                </div>
              )}
            </div>
          )}

          {/* Raw Analysis Fallback */}
          {data.raw_analysis && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h2 className="text-base font-semibold text-zinc-900 mb-4">Analysis</h2>
              <pre className="whitespace-pre-wrap text-sm text-zinc-700">{data.raw_analysis}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

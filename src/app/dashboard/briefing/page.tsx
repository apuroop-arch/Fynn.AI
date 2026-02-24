"use client";

import { useState } from "react";
import { FileText, Loader2, AlertTriangle, RefreshCw } from "lucide-react";

interface Briefing {
  id: string;
  content: string;
  week_start: string;
  created_at: string;
}

export default function BriefingPage() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [noData, setNoData] = useState(false);

  const generateBriefing = async () => {
    setLoading(true);
    setError("");
    setNoData(false);

    try {
      const res = await fetch("/api/briefing/generate", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      if (!data.briefing) {
        setNoData(true);
        return;
      }

      setBriefing(data.briefing);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            Weekly Financial Briefing
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            AI-generated summary of your financial position
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
          <p className="text-sm font-medium text-zinc-500">
            No financial data available
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            Upload transactions to generate your briefing
          </p>
        </div>
      )}

      {briefing && (
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                  <FileText className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    Week of {briefing.week_start}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Generated{" "}
                    {new Date(briefing.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="px-6 py-5">
            <div className="prose prose-sm max-w-none text-zinc-700 leading-relaxed whitespace-pre-wrap">
              {briefing.content}
            </div>
          </div>
        </div>
      )}

      {!briefing && !loading && !noData && !error && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white py-16">
          <FileText className="h-10 w-10 text-zinc-300 mb-4" />
          <p className="text-sm font-medium text-zinc-500">
            Click &quot;Generate Briefing&quot; to create your weekly summary
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            Also delivered via email every Monday
          </p>
        </div>
      )}
    </div>
  );
}

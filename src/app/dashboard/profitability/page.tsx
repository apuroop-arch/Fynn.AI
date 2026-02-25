"use client";

import { useState } from "react";
import {
  Users,
  Loader2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Shield,
  ShieldAlert,
  ShieldX,
  RefreshCw,
  DollarSign,
  UserX,
  ArrowUpDown,
} from "lucide-react";

interface Client {
  name: string;
  gross_revenue: number;
  paid_amount: number;
  outstanding: number;
  avg_days_to_pay: number;
  payment_delay_cost: number;
  true_profit: number;
  true_profit_margin: number;
  health_score: number;
  health_status: "healthy" | "watch" | "at_risk";
  risk_factors: string[];
  gross_rank: number;
  profit_rank: number;
  rank_delta: number;
}

interface FiringRecommendation {
  name: string;
  reason: string;
  hours_freed_estimate: number;
  monthly_value_if_redeployed: number;
  recommendation: string;
}

interface Summary {
  total_clients: number;
  total_gross_revenue: number;
  total_true_profit: number;
  avg_health_score: number;
  top_3_clients: string[];
  at_risk_count: number;
  key_insight: string;
}

interface ProfitabilityAnalysis {
  clients?: Client[];
  firing_recommendations?: FiringRecommendation[];
  summary?: Summary;
  raw_analysis?: string;
}

const healthColors = {
  healthy: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    ring: "ring-emerald-600/20",
    icon: Shield,
  },
  watch: {
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    ring: "ring-yellow-600/20",
    icon: ShieldAlert,
  },
  at_risk: {
    bg: "bg-red-50",
    text: "text-red-700",
    ring: "ring-red-600/20",
    icon: ShieldX,
  },
};

export default function ProfitabilityPage() {
  const [analysis, setAnalysis] = useState<ProfitabilityAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [noData, setNoData] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    setError("");
    setNoData(false);

    try {
      const res = await fetch("/api/profitability/analyze", { method: "POST" });
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
            Client Profitability
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            AI-powered analysis of true profitability, health scores, and client
            portfolio insights
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
          <Users className="h-10 w-10 text-zinc-300 mb-4" />
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
          <Users className="h-10 w-10 text-zinc-300 mb-4" />
          <p className="text-sm font-medium text-zinc-500">
            Click &quot;Run Analysis&quot; to see client profitability
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
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-zinc-500" />
                    <span className="text-xs font-medium text-zinc-500 uppercase">
                      Total Clients
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-zinc-900">
                    {analysis.summary.total_clients}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-medium text-emerald-600 uppercase">
                      Total Revenue
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-700">
                    {fmt(analysis.summary.total_gross_revenue)}
                  </p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-medium text-blue-600 uppercase">
                      True Profit
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-blue-700">
                    {fmt(analysis.summary.total_true_profit)}
                  </p>
                </div>
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert className="h-4 w-4 text-orange-600" />
                    <span className="text-xs font-medium text-orange-600 uppercase">
                      At Risk Clients
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-orange-700">
                    {analysis.summary.at_risk_count}
                  </p>
                </div>
              </div>

              {/* Key Insight */}
              <div className="rounded-xl border border-zinc-200 bg-white p-6">
                <p className="text-sm text-zinc-700">
                  <span className="font-semibold text-zinc-900">Key Insight: </span>
                  {analysis.summary.key_insight}
                </p>
                {analysis.summary.top_3_clients && analysis.summary.top_3_clients.length > 0 && (
                  <p className="text-xs text-zinc-500 mt-2">
                    Core revenue clients: {analysis.summary.top_3_clients.join(", ")}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Client Rankings Table */}
          {analysis.clients && analysis.clients.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <div className="border-b border-zinc-200 px-6 py-4">
                <h2 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  Client Rankings — By True Profitability
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50">
                      <th className="text-left px-6 py-3 text-xs font-medium text-zinc-500 uppercase">#</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-zinc-500 uppercase">Client</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-zinc-500 uppercase">Gross Revenue</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-zinc-500 uppercase">True Profit</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-zinc-500 uppercase">Margin</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-zinc-500 uppercase">Outstanding</th>
                      <th className="text-center px-6 py-3 text-xs font-medium text-zinc-500 uppercase">Health</th>
                      <th className="text-center px-6 py-3 text-xs font-medium text-zinc-500 uppercase">Rank Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.clients.map((client, idx) => {
                      const health = healthColors[client.health_status] || healthColors.watch;
                      const HealthIcon = health.icon;
                      return (
                        <tr
                          key={idx}
                          className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors"
                        >
                          <td className="px-6 py-4 text-zinc-500 font-medium">{idx + 1}</td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-zinc-900">{client.name}</p>
                            {client.risk_factors && client.risk_factors.length > 0 && (
                              <p className="text-xs text-zinc-400 mt-0.5">
                                {client.risk_factors[0]}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right text-zinc-700">
                            {fmt(client.gross_revenue)}
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-zinc-900">
                            {fmt(client.true_profit)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-medium ${
                                client.true_profit_margin >= 70
                                  ? "text-emerald-600"
                                  : client.true_profit_margin >= 40
                                  ? "text-yellow-600"
                                  : "text-red-600"
                              }`}
                            >
                              {client.true_profit_margin >= 50 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {client.true_profit_margin.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-zinc-500">
                            {client.outstanding > 0 ? fmt(client.outstanding) : "—"}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${health.bg} ${health.text} ${health.ring}`}
                            >
                              <HealthIcon className="h-3 w-3" />
                              {client.health_score}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {client.rank_delta !== 0 && (
                              <span
                                className={`text-xs font-medium ${
                                  client.rank_delta > 0
                                    ? "text-emerald-600"
                                    : "text-red-600"
                                }`}
                              >
                                {client.rank_delta > 0 ? "↑" : "↓"}
                                {Math.abs(client.rank_delta)}
                              </span>
                            )}
                            {client.rank_delta === 0 && (
                              <span className="text-xs text-zinc-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Firing Recommendations */}
          {analysis.firing_recommendations && analysis.firing_recommendations.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-white overflow-hidden">
              <div className="border-b border-red-200 bg-red-50 px-6 py-4">
                <h2 className="text-base font-semibold text-red-800 flex items-center gap-2">
                  <UserX className="h-4 w-4" />
                  Client Offboarding Recommendations
                </h2>
                <p className="text-xs text-red-600 mt-1">
                  These clients meet all three criteria: margin below 30%, health score below 40, declining revenue
                </p>
              </div>
              <div className="p-6 space-y-4">
                {analysis.firing_recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-red-100 bg-red-50/50 p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-zinc-900">
                        {rec.name}
                      </p>
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-0.5">
                        +{fmt(rec.monthly_value_if_redeployed)}/mo potential
                      </span>
                    </div>
                    <p className="text-sm text-zinc-600">{rec.reason}</p>
                    <p className="text-sm text-zinc-800 mt-2 font-medium">
                      {rec.recommendation}
                    </p>
                  </div>
                ))}
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

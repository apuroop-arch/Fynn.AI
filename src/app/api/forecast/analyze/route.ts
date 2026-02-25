"use client";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertTriangle,
  RefreshCw,
  DollarSign,
  Clock,
  ShieldAlert,
  Target,
  ArrowRight,
} from "lucide-react";

interface WeekForecast {
  week: number;
  week_start: string;
  week_end: string;
  optimistic: number;
  realistic: number;
  worst_case: number;
  expected_income: number;
  expected_expenses: number;
  key_event: string | null;
}

interface CurrentPosition {
  cash_balance: number;
  outstanding_receivables: number;
  monthly_burn_rate: number;
  months_runway: number;
}

interface SafetyAnalysis {
  safety_threshold: number;
  breach_week: number | null;
  breach_date: string | null;
  days_until_breach: number | null;
}

interface Scenarios {
  optimistic_summary: string;
  realistic_summary: string;
  worst_case_summary: string;
}

interface ActionItem {
  priority: "high" | "medium" | "low";
  action: string;
  impact: string;
  deadline: string;
}

interface ForecastSummary {
  outlook: "positive" | "neutral" | "concerning";
  headline: string;
  net_cash_flow_30d: number;
  net_cash_flow_90d: number;
}

interface CashForecast {
  weekly_forecast?: WeekForecast[];
  current_position?: CurrentPosition;
  safety_analysis?: SafetyAnalysis;
  scenarios?: Scenarios;
  action_items?: ActionItem[];
  summary?: ForecastSummary;
  raw_analysis?: string;
}

const priorityColors = {
  high: "bg-red-50 text-red-700 ring-red-600/20",
  medium: "bg-yellow-50 text-yellow-700 ring-yellow-600/20",
  low: "bg-blue-50 text-blue-700 ring-blue-600/20",
};

const outlookColors = {
  positive: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", icon: TrendingUp },
  neutral: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: Target },
  concerning: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: TrendingDown },
};

export default function ForecastPage() {
  const [forecast, setForecast] = useState<CashForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [noData, setNoData] = useState(false);

  const runForecast = async () => {
    setLoading(true);
    setError("");
    setNoData(false);

    try {
      const res = await fetch("/api/forecast/analyze", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      if (!data.forecast) {
        setNoData(true);
        return;
      }

      setForecast(data.forecast);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Forecast failed");
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  // Simple bar chart renderer
  const renderChart = (weeks: WeekForecast[]) => {
    const allValues = weeks.flatMap((w) => [w.optimistic, w.realistic, w.worst_case]);
    const maxVal = Math.max(...allValues);
    const minVal = Math.min(...allValues, 0);
    const range = maxVal - minVal || 1;

    const getHeight = (val: number) => Math.max(((val - minVal) / range) * 100, 2);

    return (
      <div className="space-y-4">
        <div className="flex items-end gap-1 h-48 px-2">
          {weeks.map((week, idx) => (
            <div key={idx} className="flex-1 flex items-end gap-px group relative">
              <div
                className="flex-1 bg-emerald-200 rounded-t-sm transition-all hover:bg-emerald-300"
                style={{ height: `${getHeight(week.optimistic)}%` }}
                title={`Week ${week.week} Optimistic: ${fmt(week.optimistic)}`}
              />
              <div
                className="flex-1 bg-blue-400 rounded-t-sm transition-all hover:bg-blue-500"
                style={{ height: `${getHeight(week.realistic)}%` }}
                title={`Week ${week.week} Realistic: ${fmt(week.realistic)}`}
              />
              <div
                className="flex-1 bg-red-300 rounded-t-sm transition-all hover:bg-red-400"
                style={{ height: `${getHeight(week.worst_case)}%` }}
                title={`Week ${week.week} Worst: ${fmt(week.worst_case)}`}
              />
              {/* Tooltip on hover */}
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                <div className="bg-zinc-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                  <p className="font-semibold">Week {week.week}</p>
                  <p className="text-emerald-300">Best: {fmt(week.optimistic)}</p>
                  <p className="text-blue-300">Expected: {fmt(week.realistic)}</p>
                  <p className="text-red-300">Worst: {fmt(week.worst_case)}</p>
                  {week.key_event && <p className="text-zinc-400 mt-1">{week.key_event}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* X-axis labels */}
        <div className="flex gap-1 px-2">
          {weeks.map((week, idx) => (
            <div key={idx} className="flex-1 text-center">
              <span className="text-xs text-zinc-400">W{week.week}</span>
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex items-center justify-center gap-6 pt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-200" />
            <span className="text-xs text-zinc-500">Optimistic</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-blue-400" />
            <span className="text-xs text-zinc-500">Realistic</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-300" />
            <span className="text-xs text-zinc-500">Worst Case</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Cash Forecast</h1>
          <p className="text-sm text-zinc-500 mt-1">
            AI-powered 90-day cash flow projections with three scenarios
          </p>
        </div>
        <button
          onClick={runForecast}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {loading ? "Forecasting..." : "Run Forecast"}
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
          <TrendingUp className="h-10 w-10 text-zinc-300 mb-4" />
          <p className="text-sm font-medium text-zinc-500">No data to forecast</p>
          <p className="text-xs text-zinc-400 mt-1">Upload bank statements or invoices first</p>
        </div>
      )}

      {!forecast && !loading && !noData && !error && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white py-16">
          <TrendingUp className="h-10 w-10 text-zinc-300 mb-4" />
          <p className="text-sm font-medium text-zinc-500">
            Click &quot;Run Forecast&quot; to generate 90-day projections
          </p>
          <p className="text-xs text-zinc-400 mt-1">Powered by Claude AI</p>
        </div>
      )}

      {forecast && (
        <div className="space-y-6">
          {/* Outlook Headline */}
          {forecast.summary && (
            <div
              className={`rounded-xl border p-6 ${
                outlookColors[forecast.summary.outlook]?.bg || "bg-blue-50"
              } ${outlookColors[forecast.summary.outlook]?.border || "border-blue-200"}`}
            >
              <div className="flex items-center gap-3">
                {(() => {
                  const OutlookIcon = outlookColors[forecast.summary.outlook]?.icon || Target;
                  return (
                    <OutlookIcon
                      className={`h-6 w-6 ${
                        outlookColors[forecast.summary.outlook]?.text || "text-blue-700"
                      }`}
                    />
                  );
                })()}
                <div>
                  <p
                    className={`text-sm font-semibold uppercase ${
                      outlookColors[forecast.summary.outlook]?.text || "text-blue-700"
                    }`}
                  >
                    {forecast.summary.outlook} Outlook
                  </p>
                  <p className="text-sm text-zinc-700 mt-0.5">{forecast.summary.headline}</p>
                </div>
              </div>
            </div>
          )}

          {/* Current Position Cards */}
          {forecast.current_position && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-zinc-500" />
                  <span className="text-xs font-medium text-zinc-500 uppercase">Cash Balance</span>
                </div>
                <p className="text-2xl font-bold text-zinc-900">
                  {fmt(forecast.current_position.cash_balance)}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-medium text-emerald-600 uppercase">Receivables</span>
                </div>
                <p className="text-2xl font-bold text-emerald-700">
                  {fmt(forecast.current_position.outstanding_receivables)}
                </p>
              </div>
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-orange-600" />
                  <span className="text-xs font-medium text-orange-600 uppercase">Monthly Burn</span>
                </div>
                <p className="text-2xl font-bold text-orange-700">
                  {fmt(forecast.current_position.monthly_burn_rate)}
                </p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium text-blue-600 uppercase">Runway</span>
                </div>
                <p className="text-2xl font-bold text-blue-700">
                  {forecast.current_position.months_runway.toFixed(1)} months
                </p>
              </div>
            </div>
          )}

          {/* Cash Flow Summary */}
          {forecast.summary && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <p className="text-xs font-medium text-zinc-500 uppercase mb-1">Net Cash Flow (30 days)</p>
                <p
                  className={`text-xl font-bold ${
                    forecast.summary.net_cash_flow_30d >= 0 ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {forecast.summary.net_cash_flow_30d >= 0 ? "+" : ""}
                  {fmt(forecast.summary.net_cash_flow_30d)}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <p className="text-xs font-medium text-zinc-500 uppercase mb-1">Net Cash Flow (90 days)</p>
                <p
                  className={`text-xl font-bold ${
                    forecast.summary.net_cash_flow_90d >= 0 ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {forecast.summary.net_cash_flow_90d >= 0 ? "+" : ""}
                  {fmt(forecast.summary.net_cash_flow_90d)}
                </p>
              </div>
            </div>
          )}

          {/* Safety Alert */}
          {forecast.safety_analysis && forecast.safety_analysis.breach_week && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-6 w-6 text-red-600" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Cash Safety Alert</p>
                  <p className="text-sm text-red-700 mt-0.5">
                    Your cash position is projected to drop below the safety threshold of{" "}
                    {fmt(forecast.safety_analysis.safety_threshold)} in{" "}
                    <span className="font-semibold">Week {forecast.safety_analysis.breach_week}</span>
                    {forecast.safety_analysis.breach_date && ` (${forecast.safety_analysis.breach_date})`}.
                    {forecast.safety_analysis.days_until_breach &&
                      ` That is ${forecast.safety_analysis.days_until_breach} days from now.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Forecast Chart */}
          {forecast.weekly_forecast && forecast.weekly_forecast.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h2 className="text-base font-semibold text-zinc-900 mb-4">
                90-Day Cash Position Forecast
              </h2>
              {renderChart(forecast.weekly_forecast)}
            </div>
          )}

          {/* Scenario Summaries */}
          {forecast.scenarios && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold text-emerald-700 uppercase mb-2">Optimistic</p>
                <p className="text-sm text-zinc-700">{forecast.scenarios.optimistic_summary}</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs font-semibold text-blue-700 uppercase mb-2">Realistic</p>
                <p className="text-sm text-zinc-700">{forecast.scenarios.realistic_summary}</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-xs font-semibold text-red-700 uppercase mb-2">Worst Case</p>
                <p className="text-sm text-zinc-700">{forecast.scenarios.worst_case_summary}</p>
              </div>
            </div>
          )}

          {/* Weekly Breakdown Table */}
          {forecast.weekly_forecast && forecast.weekly_forecast.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <div className="border-b border-zinc-200 px-6 py-4">
                <h2 className="text-base font-semibold text-zinc-900">Weekly Breakdown</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50">
                      <th className="text-left px-6 py-3 text-xs font-medium text-zinc-500 uppercase">Week</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-zinc-500 uppercase">Dates</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-emerald-600 uppercase">Optimistic</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-blue-600 uppercase">Realistic</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-red-600 uppercase">Worst Case</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-zinc-500 uppercase">Event</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.weekly_forecast.map((week, idx) => (
                      <tr key={idx} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                        <td className="px-6 py-3 font-medium text-zinc-900">W{week.week}</td>
                        <td className="px-6 py-3 text-zinc-500 text-xs">
                          {week.week_start} to {week.week_end}
                        </td>
                        <td className="px-6 py-3 text-right text-emerald-700 font-medium">{fmt(week.optimistic)}</td>
                        <td className="px-6 py-3 text-right text-blue-700 font-medium">{fmt(week.realistic)}</td>
                        <td className="px-6 py-3 text-right text-red-700 font-medium">{fmt(week.worst_case)}</td>
                        <td className="px-6 py-3 text-zinc-500 text-xs max-w-[200px] truncate">
                          {week.key_event || "\u2014"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action Items */}
          {forecast.action_items && forecast.action_items.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <div className="border-b border-zinc-200 px-6 py-4">
                <h2 className="text-base font-semibold text-zinc-900">Action Items</h2>
              </div>
              <div className="p-6 space-y-3">
                {forecast.action_items.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 rounded-lg bg-zinc-50 p-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        priorityColors[item.priority] || priorityColors.medium
                      }`}
                    >
                      {item.priority}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-900">{item.action}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {item.impact}
                        </span>
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                          <ArrowRight className="h-3 w-3" />
                          {item.deadline}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw Analysis Fallback */}
          {forecast.raw_analysis && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h2 className="text-base font-semibold text-zinc-900 mb-4">Analysis</h2>
              <pre className="whitespace-pre-wrap text-sm text-zinc-700">{forecast.raw_analysis}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

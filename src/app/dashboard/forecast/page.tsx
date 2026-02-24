import { TrendingUp } from "lucide-react";

export default function ForecastPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Cash Forecast</h1>
        <p className="text-sm text-zinc-500 mt-1">
          AI-powered cash flow projections
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white py-16">
        <TrendingUp className="h-10 w-10 text-zinc-300 mb-4" />
        <p className="text-sm font-medium text-zinc-500">
          Upload transactions to generate forecasts
        </p>
        <p className="text-xs text-zinc-400 mt-1">
          This module will project your cash flow for the next 90 days
        </p>
      </div>
    </div>
  );
}

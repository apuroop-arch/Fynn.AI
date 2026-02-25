"use client";

import { useState } from "react";
import {
  Landmark,
  Loader2,
  AlertTriangle,
  RefreshCw,
  DollarSign,
  Calendar,
  ShieldCheck,
  TrendingDown,
  Lightbulb,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Calculator,
} from "lucide-react";

interface DeductionItem {
  name: string;
  amount: number;
}

interface Deduction {
  category: string;
  amount_ytd: number;
  projected_annual: number;
  confidence: "high" | "medium" | "low";
  items?: DeductionItem[];
}

interface QuarterSchedule {
  quarter: string;
  due_date: string;
  amount_due: number;
  status: "paid" | "upcoming" | "overdue";
  days_until_due: number | null;
}

interface OptimizationTip {
  tip: string;
  potential_savings: number;
  category: "deduction" | "timing" | "structure" | "retirement";
  priority: "high" | "medium" | "low";
}

interface CalcStep {
  description: string;
  amount: number;
  formula?: string;
  note?: string;
  items_summary?: string;
  social_security?: number;
  social_security_formula?: string;
  medicare?: number;
  medicare_formula?: string;
}

interface BracketCalc {
  bracket: string;
  range_low: number;
  range_high: number | string;
  taxable_in_bracket: number;
  tax_from_bracket: number;
  formula: string;
}

interface TaxCalcSteps {
  step_1_gross_income?: CalcStep;
  step_2_deductions?: CalcStep;
  step_3_net_self_employment_income?: CalcStep;
  step_4_se_tax_base?: CalcStep;
  step_5_se_tax?: CalcStep;
  step_6_se_deduction?: CalcStep;
  step_7_adjusted_gross_income?: CalcStep;
  step_8_standard_deduction?: CalcStep;
  step_9_taxable_income?: CalcStep;
  step_10_federal_tax_brackets?: BracketCalc[];
  step_11_total_federal_income_tax?: CalcStep;
  step_12_total_tax?: CalcStep & { effective_rate?: number; effective_rate_formula?: string };
}

interface TaxData {
  income_summary?: {
    gross_income_ytd: number;
    total_expenses_ytd: number;
    net_income_ytd: number;
    projected_annual_income: number;
    projected_annual_expenses: number;
    projected_net_income: number;
    months_of_data?: number;
    projection_method?: string;
  };
  deductions?: Deduction[];
  tax_calculation_steps?: TaxCalcSteps;
  tax_estimates?: {
    us_federal?: {
      taxable_income: number;
      estimated_tax: number;
      self_employment_tax: number;
      total_federal: number;
      effective_rate: number;
    };
    quarterly_payment: number;
    monthly_reserve: number;
  };
  quarterly_schedule?: QuarterSchedule[];
  reserve_status?: {
    recommended_reserve: number;
    current_quarter: string;
    next_payment_date: string;
    next_payment_amount: number;
    months_of_data: number;
    confidence_level: "high" | "medium" | "low";
  };
  optimization_tips?: OptimizationTip[];
  summary?: {
    headline: string;
    monthly_set_aside: number;
    risk_level: "on_track" | "underpaid" | "overpaid";
    total_tax_burden_pct: number;
  };
  raw_analysis?: string;
}

const priorityColors = {
  high: "bg-red-50 text-red-700 ring-red-600/20",
  medium: "bg-yellow-50 text-yellow-700 ring-yellow-600/20",
  low: "bg-blue-50 text-blue-700 ring-blue-600/20",
};

const confidenceColors = {
  high: "text-emerald-600",
  medium: "text-yellow-600",
  low: "text-red-600",
};

const statusConfig = {
  paid: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", icon: CheckCircle2, label: "Paid" },
  upcoming: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: Clock, label: "Upcoming" },
  overdue: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: AlertCircle, label: "Overdue" },
};

const riskConfig = {
  on_track: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", icon: ShieldCheck, label: "On Track" },
  underpaid: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: AlertTriangle, label: "Underpaid" },
  overpaid: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: TrendingDown, label: "Overpaid" },
};

export default function TaxPage() {
  const [tax, setTax] = useState<TaxData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [noData, setNoData] = useState(false);
  const [showCalcSteps, setShowCalcSteps] = useState(false);
  const [expandedDeductions, setExpandedDeductions] = useState<Record<number, boolean>>({});

  const runCalculation = async () => {
    setLoading(true);
    setError("");
    setNoData(false);

    try {
      const res = await fetch("/api/tax/analyze", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      if (!data.tax) {
        setNoData(true);
        return;
      }

      setTax(data.tax);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tax calculation failed");
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

  const fmtExact = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const pct = (n: number) => `${n.toFixed(1)}%`;

  const toggleDeduction = (idx: number) => {
    setExpandedDeductions((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Tax Reserve</h1>
          <p className="text-sm text-zinc-500 mt-1">
            AI-estimated quarterly tax obligations with full calculation transparency
          </p>
        </div>
        <button
          onClick={runCalculation}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {loading ? "Calculating..." : "Calculate Taxes"}
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
          <Landmark className="h-10 w-10 text-zinc-300 mb-4" />
          <p className="text-sm font-medium text-zinc-500">No data to calculate</p>
          <p className="text-xs text-zinc-400 mt-1">Upload bank statements or invoices first</p>
        </div>
      )}

      {!tax && !loading && !noData && !error && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white py-16">
          <Landmark className="h-10 w-10 text-zinc-300 mb-4" />
          <p className="text-sm font-medium text-zinc-500">
            Click &quot;Calculate Taxes&quot; to estimate your tax obligations
          </p>
          <p className="text-xs text-zinc-400 mt-1">Powered by Claude AI</p>
        </div>
      )}

      {tax && (
        <div className="space-y-6">
          {/* Risk Status Banner */}
          {tax.summary && (
            <div
              className={`rounded-xl border p-6 ${
                riskConfig[tax.summary.risk_level]?.bg || "bg-blue-50"
              } ${riskConfig[tax.summary.risk_level]?.border || "border-blue-200"}`}
            >
              <div className="flex items-center gap-3">
                {(() => {
                  const RiskIcon = riskConfig[tax.summary.risk_level]?.icon || ShieldCheck;
                  return (
                    <RiskIcon
                      className={`h-6 w-6 ${
                        riskConfig[tax.summary.risk_level]?.text || "text-blue-700"
                      }`}
                    />
                  );
                })()}
                <div>
                  <p
                    className={`text-sm font-semibold uppercase ${
                      riskConfig[tax.summary.risk_level]?.text || "text-blue-700"
                    }`}
                  >
                    {riskConfig[tax.summary.risk_level]?.label || "Status"}
                  </p>
                  <p className="text-sm text-zinc-700 mt-0.5">{tax.summary.headline}</p>
                </div>
              </div>
            </div>
          )}

          {/* Key Metrics Cards */}
          {tax.summary && tax.tax_estimates && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-zinc-500" />
                  <span className="text-xs font-medium text-zinc-500 uppercase">Monthly Set-Aside</span>
                </div>
                <p className="text-2xl font-bold text-zinc-900">{fmt(tax.summary.monthly_set_aside)}</p>
              </div>
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-orange-600" />
                  <span className="text-xs font-medium text-orange-600 uppercase">Quarterly Payment</span>
                </div>
                <p className="text-2xl font-bold text-orange-700">{fmt(tax.tax_estimates.quarterly_payment)}</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Landmark className="h-4 w-4 text-red-600" />
                  <span className="text-xs font-medium text-red-600 uppercase">Est. Annual Tax</span>
                </div>
                <p className="text-2xl font-bold text-red-700">{fmt(tax.tax_estimates.us_federal?.total_federal || 0)}</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium text-blue-600 uppercase">Effective Rate</span>
                </div>
                <p className="text-2xl font-bold text-blue-700">{pct(tax.summary.total_tax_burden_pct)}</p>
              </div>
            </div>
          )}

          {/* Income Summary */}
          {tax.income_summary && (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <div className="border-b border-zinc-200 px-6 py-4">
                <h2 className="text-base font-semibold text-zinc-900">Income Summary</h2>
                {tax.income_summary.projection_method && (
                  <p className="text-xs text-zinc-400 mt-1">{tax.income_summary.projection_method}</p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-100">
                <div className="p-6">
                  <p className="text-xs font-medium text-zinc-500 uppercase mb-1">Gross Income (YTD)</p>
                  <p className="text-xl font-bold text-zinc-900">{fmt(tax.income_summary.gross_income_ytd)}</p>
                  <p className="text-xs text-zinc-400 mt-1">Projected annual: {fmt(tax.income_summary.projected_annual_income)}</p>
                </div>
                <div className="p-6">
                  <p className="text-xs font-medium text-zinc-500 uppercase mb-1">Expenses (YTD)</p>
                  <p className="text-xl font-bold text-zinc-900">{fmt(tax.income_summary.total_expenses_ytd)}</p>
                  <p className="text-xs text-zinc-400 mt-1">Projected annual: {fmt(tax.income_summary.projected_annual_expenses)}</p>
                </div>
                <div className="p-6">
                  <p className="text-xs font-medium text-zinc-500 uppercase mb-1">Net Income (YTD)</p>
                  <p className="text-xl font-bold text-emerald-700">{fmt(tax.income_summary.net_income_ytd)}</p>
                  <p className="text-xs text-zinc-400 mt-1">Projected annual: {fmt(tax.income_summary.projected_net_income)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Full Tax Calculation Breakdown */}
          {tax.tax_calculation_steps && (
            <div className="rounded-xl border border-indigo-200 bg-white overflow-hidden">
              <button
                onClick={() => setShowCalcSteps(!showCalcSteps)}
                className="w-full border-b border-indigo-100 px-6 py-4 flex items-center justify-between hover:bg-indigo-50/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-base font-semibold text-zinc-900">Full Tax Calculation Breakdown</h2>
                  <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">Step-by-step</span>
                </div>
                {showCalcSteps ? (
                  <ChevronUp className="h-5 w-5 text-zinc-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-zinc-400" />
                )}
              </button>

              {showCalcSteps && (
                <div className="p-6 space-y-1">
                  {/* Step 1: Gross Income */}
                  {tax.tax_calculation_steps.step_1_gross_income && (
                    <div className="flex justify-between items-center py-3 border-b border-zinc-100">
                      <div>
                        <p className="text-sm font-medium text-zinc-900">Step 1: {tax.tax_calculation_steps.step_1_gross_income.description}</p>
                      </div>
                      <span className="text-sm font-semibold text-zinc-900 tabular-nums">{fmtExact(tax.tax_calculation_steps.step_1_gross_income.amount)}</span>
                    </div>
                  )}

                  {/* Step 2: Deductions */}
                  {tax.tax_calculation_steps.step_2_deductions && (
                    <div className="flex justify-between items-center py-3 border-b border-zinc-100">
                      <div>
                        <p className="text-sm font-medium text-zinc-900">Step 2: {tax.tax_calculation_steps.step_2_deductions.description}</p>
                        {tax.tax_calculation_steps.step_2_deductions.items_summary && (
                          <p className="text-xs text-zinc-400 mt-0.5">{tax.tax_calculation_steps.step_2_deductions.items_summary}</p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-red-600 tabular-nums">-{fmtExact(tax.tax_calculation_steps.step_2_deductions.amount)}</span>
                    </div>
                  )}

                  {/* Step 3: Net SE Income */}
                  {tax.tax_calculation_steps.step_3_net_self_employment_income && (
                    <div className="flex justify-between items-center py-3 border-b border-zinc-200 bg-zinc-50 -mx-6 px-6">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">Step 3: {tax.tax_calculation_steps.step_3_net_self_employment_income.description}</p>
                        {tax.tax_calculation_steps.step_3_net_self_employment_income.formula && (
                          <p className="text-xs text-indigo-600 font-mono mt-0.5">{tax.tax_calculation_steps.step_3_net_self_employment_income.formula}</p>
                        )}
                      </div>
                      <span className="text-sm font-bold text-zinc-900 tabular-nums">{fmtExact(tax.tax_calculation_steps.step_3_net_self_employment_income.amount)}</span>
                    </div>
                  )}

                  {/* Step 4: SE Tax Base */}
                  {tax.tax_calculation_steps.step_4_se_tax_base && (
                    <div className="flex justify-between items-center py-3 border-b border-zinc-100">
                      <div>
                        <p className="text-sm font-medium text-zinc-900">Step 4: {tax.tax_calculation_steps.step_4_se_tax_base.description}</p>
                        {tax.tax_calculation_steps.step_4_se_tax_base.formula && (
                          <p className="text-xs text-indigo-600 font-mono mt-0.5">{tax.tax_calculation_steps.step_4_se_tax_base.formula}</p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-zinc-900 tabular-nums">{fmtExact(tax.tax_calculation_steps.step_4_se_tax_base.amount)}</span>
                    </div>
                  )}

                  {/* Step 5: SE Tax */}
                  {tax.tax_calculation_steps.step_5_se_tax && (
                    <div className="py-3 border-b border-zinc-100">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-zinc-900">Step 5: {tax.tax_calculation_steps.step_5_se_tax.description}</p>
                          {tax.tax_calculation_steps.step_5_se_tax.formula && (
                            <p className="text-xs text-indigo-600 font-mono mt-0.5">{tax.tax_calculation_steps.step_5_se_tax.formula}</p>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-red-700 tabular-nums">{fmtExact(tax.tax_calculation_steps.step_5_se_tax.amount)}</span>
                      </div>
                      {(tax.tax_calculation_steps.step_5_se_tax.social_security !== undefined || tax.tax_calculation_steps.step_5_se_tax.medicare !== undefined) && (
                        <div className="mt-2 ml-4 space-y-1 text-xs text-zinc-500">
                          {tax.tax_calculation_steps.step_5_se_tax.social_security !== undefined && (
                            <div className="flex justify-between">
                              <span>Social Security (12.4%): <span className="font-mono text-zinc-400">{tax.tax_calculation_steps.step_5_se_tax.social_security_formula}</span></span>
                              <span className="tabular-nums">{fmtExact(tax.tax_calculation_steps.step_5_se_tax.social_security)}</span>
                            </div>
                          )}
                          {tax.tax_calculation_steps.step_5_se_tax.medicare !== undefined && (
                            <div className="flex justify-between">
                              <span>Medicare (2.9%): <span className="font-mono text-zinc-400">{tax.tax_calculation_steps.step_5_se_tax.medicare_formula}</span></span>
                              <span className="tabular-nums">{fmtExact(tax.tax_calculation_steps.step_5_se_tax.medicare)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 6: SE Deduction */}
                  {tax.tax_calculation_steps.step_6_se_deduction && (
                    <div className="flex justify-between items-center py-3 border-b border-zinc-100">
                      <div>
                        <p className="text-sm font-medium text-zinc-900">Step 6: {tax.tax_calculation_steps.step_6_se_deduction.description}</p>
                        {tax.tax_calculation_steps.step_6_se_deduction.formula && (
                          <p className="text-xs text-indigo-600 font-mono mt-0.5">{tax.tax_calculation_steps.step_6_se_deduction.formula}</p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-zinc-900 tabular-nums">-{fmtExact(tax.tax_calculation_steps.step_6_se_deduction.amount)}</span>
                    </div>
                  )}

                  {/* Step 7: AGI */}
                  {tax.tax_calculation_steps.step_7_adjusted_gross_income && (
                    <div className="flex justify-between items-center py-3 border-b border-zinc-100">
                      <div>
                        <p className="text-sm font-medium text-zinc-900">Step 7: {tax.tax_calculation_steps.step_7_adjusted_gross_income.description}</p>
                        {tax.tax_calculation_steps.step_7_adjusted_gross_income.formula && (
                          <p className="text-xs text-indigo-600 font-mono mt-0.5">{tax.tax_calculation_steps.step_7_adjusted_gross_income.formula}</p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-zinc-900 tabular-nums">{fmtExact(tax.tax_calculation_steps.step_7_adjusted_gross_income.amount)}</span>
                    </div>
                  )}

                  {/* Step 8: Standard Deduction */}
                  {tax.tax_calculation_steps.step_8_standard_deduction && (
                    <div className="flex justify-between items-center py-3 border-b border-zinc-100">
                      <div>
                        <p className="text-sm font-medium text-zinc-900">Step 8: {tax.tax_calculation_steps.step_8_standard_deduction.description}</p>
                        {tax.tax_calculation_steps.step_8_standard_deduction.note && (
                          <p className="text-xs text-zinc-400 mt-0.5">{tax.tax_calculation_steps.step_8_standard_deduction.note}</p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-zinc-900 tabular-nums">-{fmtExact(tax.tax_calculation_steps.step_8_standard_deduction.amount)}</span>
                    </div>
                  )}

                  {/* Step 9: Taxable Income */}
                  {tax.tax_calculation_steps.step_9_taxable_income && (
                    <div className="flex justify-between items-center py-3 border-b border-zinc-200 bg-zinc-50 -mx-6 px-6">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">Step 9: {tax.tax_calculation_steps.step_9_taxable_income.description}</p>
                        {tax.tax_calculation_steps.step_9_taxable_income.formula && (
                          <p className="text-xs text-indigo-600 font-mono mt-0.5">{tax.tax_calculation_steps.step_9_taxable_income.formula}</p>
                        )}
                      </div>
                      <span className="text-sm font-bold text-zinc-900 tabular-nums">{fmtExact(tax.tax_calculation_steps.step_9_taxable_income.amount)}</span>
                    </div>
                  )}

                  {/* Step 10: Tax Brackets */}
                  {tax.tax_calculation_steps.step_10_federal_tax_brackets && tax.tax_calculation_steps.step_10_federal_tax_brackets.length > 0 && (
                    <div className="py-3 border-b border-zinc-100">
                      <p className="text-sm font-semibold text-zinc-900 mb-3">Step 10: Federal Income Tax by Bracket</p>
                      <div className="rounded-lg border border-zinc-200 overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-zinc-50 border-b border-zinc-200">
                              <th className="text-left px-4 py-2 font-medium text-zinc-500">Bracket</th>
                              <th className="text-left px-4 py-2 font-medium text-zinc-500">Range</th>
                              <th className="text-right px-4 py-2 font-medium text-zinc-500">Taxable</th>
                              <th className="text-right px-4 py-2 font-medium text-zinc-500">Tax</th>
                              <th className="text-left px-4 py-2 font-medium text-zinc-500">Formula</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tax.tax_calculation_steps.step_10_federal_tax_brackets.map((b, idx) => (
                              <tr key={idx} className={`border-b border-zinc-50 ${b.taxable_in_bracket > 0 ? "" : "opacity-40"}`}>
                                <td className="px-4 py-2 font-semibold text-zinc-900">{b.bracket}</td>
                                <td className="px-4 py-2 text-zinc-500">
                                  {fmt(b.range_low)} - {typeof b.range_high === "number" ? fmt(b.range_high) : b.range_high}
                                </td>
                                <td className="px-4 py-2 text-right font-medium text-zinc-700 tabular-nums">{fmtExact(b.taxable_in_bracket)}</td>
                                <td className="px-4 py-2 text-right font-semibold text-red-700 tabular-nums">{fmtExact(b.tax_from_bracket)}</td>
                                <td className="px-4 py-2 text-zinc-400 font-mono">{b.formula}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Step 11: Total Federal Income Tax */}
                  {tax.tax_calculation_steps.step_11_total_federal_income_tax && (
                    <div className="flex justify-between items-center py-3 border-b border-zinc-100">
                      <div>
                        <p className="text-sm font-medium text-zinc-900">Step 11: {tax.tax_calculation_steps.step_11_total_federal_income_tax.description}</p>
                      </div>
                      <span className="text-sm font-semibold text-red-700 tabular-nums">{fmtExact(tax.tax_calculation_steps.step_11_total_federal_income_tax.amount)}</span>
                    </div>
                  )}

                  {/* Step 12: Total Tax */}
                  {tax.tax_calculation_steps.step_12_total_tax && (
                    <div className="flex justify-between items-center py-4 bg-indigo-50 -mx-6 px-6 rounded-b-lg mt-2">
                      <div>
                        <p className="text-sm font-bold text-indigo-900">Step 12: {tax.tax_calculation_steps.step_12_total_tax.description}</p>
                        {tax.tax_calculation_steps.step_12_total_tax.formula && (
                          <p className="text-xs text-indigo-600 font-mono mt-0.5">{tax.tax_calculation_steps.step_12_total_tax.formula}</p>
                        )}
                        {tax.tax_calculation_steps.step_12_total_tax.effective_rate_formula && (
                          <p className="text-xs text-indigo-500 font-mono mt-0.5">Effective rate: {tax.tax_calculation_steps.step_12_total_tax.effective_rate_formula}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-indigo-900 tabular-nums">{fmtExact(tax.tax_calculation_steps.step_12_total_tax.amount)}</span>
                        {tax.tax_calculation_steps.step_12_total_tax.effective_rate !== undefined && (
                          <p className="text-xs font-semibold text-indigo-600">{pct(tax.tax_calculation_steps.step_12_total_tax.effective_rate)} effective</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Quarterly Schedule */}
          {tax.quarterly_schedule && tax.quarterly_schedule.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <div className="border-b border-zinc-200 px-6 py-4">
                <h2 className="text-base font-semibold text-zinc-900">Quarterly Payment Schedule</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 p-6">
                {tax.quarterly_schedule.map((q, idx) => {
                  const config = statusConfig[q.status] || statusConfig.upcoming;
                  const StatusIcon = config.icon;
                  return (
                    <div key={idx} className={`rounded-xl border p-4 ${config.bg} ${config.border}`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-lg font-bold ${config.text}`}>{q.quarter}</span>
                        <StatusIcon className={`h-5 w-5 ${config.text}`} />
                      </div>
                      <p className="text-2xl font-bold text-zinc-900">{fmt(q.amount_due)}</p>
                      <p className="text-xs text-zinc-500 mt-1">Due: {q.due_date}</p>
                      <div className="mt-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.text} ${config.bg} ring-1 ring-inset ${config.border}`}>
                          {config.label}
                          {q.days_until_due !== null && q.status === "upcoming" && ` (${q.days_until_due}d)`}
                          {q.days_until_due !== null && q.status === "overdue" && ` (${Math.abs(q.days_until_due)}d late)`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Deductions Table */}
          {tax.deductions && tax.deductions.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <div className="border-b border-zinc-200 px-6 py-4">
                <h2 className="text-base font-semibold text-zinc-900">Deductible Expenses</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50">
                      <th className="text-left px-6 py-3 text-xs font-medium text-zinc-500 uppercase">Category</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-zinc-500 uppercase">YTD Amount</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-zinc-500 uppercase">Projected Annual</th>
                      <th className="text-center px-6 py-3 text-xs font-medium text-zinc-500 uppercase">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tax.deductions.map((d, idx) => (
                      <>
                        <tr
                          key={idx}
                          className={`border-b border-zinc-50 hover:bg-zinc-50 transition-colors ${d.items && d.items.length > 0 ? "cursor-pointer" : ""}`}
                          onClick={() => d.items && d.items.length > 0 && toggleDeduction(idx)}
                        >
                          <td className="px-6 py-3 font-medium text-zinc-900">
                            <div className="flex items-center gap-2">
                              {d.items && d.items.length > 0 && (
                                expandedDeductions[idx] ? <ChevronUp className="h-3 w-3 text-zinc-400" /> : <ChevronDown className="h-3 w-3 text-zinc-400" />
                              )}
                              {d.category}
                            </div>
                          </td>
                          <td className="px-6 py-3 text-right text-zinc-700">{fmt(d.amount_ytd)}</td>
                          <td className="px-6 py-3 text-right text-zinc-700">{fmt(d.projected_annual)}</td>
                          <td className="px-6 py-3 text-center">
                            <span className={`text-xs font-medium capitalize ${confidenceColors[d.confidence] || "text-zinc-500"}`}>
                              {d.confidence}
                            </span>
                          </td>
                        </tr>
                        {expandedDeductions[idx] && d.items && d.items.map((item, iIdx) => (
                          <tr key={`${idx}-${iIdx}`} className="bg-zinc-50/50">
                            <td className="px-6 py-2 pl-12 text-xs text-zinc-500">{item.name}</td>
                            <td className="px-6 py-2 text-right text-xs text-zinc-500">{fmt(item.amount)}</td>
                            <td className="px-6 py-2" />
                            <td className="px-6 py-2" />
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Optimization Tips */}
          {tax.optimization_tips && tax.optimization_tips.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <div className="border-b border-zinc-200 px-6 py-4 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                <h2 className="text-base font-semibold text-zinc-900">Tax Optimization Tips</h2>
              </div>
              <div className="p-6 space-y-3">
                {tax.optimization_tips.map((tip, idx) => (
                  <div key={idx} className="flex items-start gap-3 rounded-lg bg-zinc-50 p-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        priorityColors[tip.priority] || priorityColors.medium
                      }`}
                    >
                      {tip.priority}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-900">{tip.tip}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Potential savings: {fmt(tip.potential_savings)}
                        </span>
                        <span className="text-xs text-zinc-400 capitalize">{tip.category}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs text-amber-800">
              <span className="font-semibold">Disclaimer:</span> These tax estimates are for planning purposes only and are not professional tax advice.
              Fynn provides financial intelligence for informational purposes. Consult a qualified tax professional or CPA for
              official tax preparation and filing. Actual tax obligations may vary based on filing status, state taxes, additional
              income sources, and other factors not captured here.
            </p>
          </div>

          {/* Raw Analysis Fallback */}
          {tax.raw_analysis && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h2 className="text-base font-semibold text-zinc-900 mb-4">Analysis</h2>
              <pre className="whitespace-pre-wrap text-sm text-zinc-700">{tax.raw_analysis}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

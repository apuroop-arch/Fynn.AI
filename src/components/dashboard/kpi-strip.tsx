"use client";

import { SearchX, MailCheck, Wallet, Landmark } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  trend?: string;
}

function KpiCard({ label, value, icon: Icon, trend }: KpiCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
        <Icon className="h-5 w-5 text-emerald-600" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-500 truncate">{label}</p>
        <p className="text-lg font-semibold text-zinc-900">{value}</p>
        {trend && (
          <p className="text-xs text-emerald-600 font-medium">{trend}</p>
        )}
      </div>
    </div>
  );
}

export function KpiStrip() {
  // TODO: Fetch real data from API
  const kpis: KpiCardProps[] = [
    {
      label: "Total Leakage Identified",
      value: "$0.00",
      icon: SearchX,
    },
    {
      label: "Total Recovered",
      value: "$0.00",
      icon: MailCheck,
    },
    {
      label: "Cash Position",
      value: "$0.00",
      icon: Wallet,
    },
    {
      label: "Next Tax Reserve",
      value: "$0.00",
      icon: Landmark,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} {...kpi} />
      ))}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { SearchX, MailCheck, Wallet, Landmark } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
}

function KpiCard({ label, value, icon: Icon }: KpiCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
        <Icon className="h-5 w-5 text-emerald-600" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-500 truncate">{label}</p>
        <p className="text-lg font-semibold text-zinc-900">{value}</p>
      </div>
    </div>
  );
}

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function KpiStrip() {
  const [data, setData] = useState<{
    cashPosition: number;
    totalLeakage: number;
    totalRecovered: number;
    taxReserve: number;
    currency: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/kpis")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json && !json.error) setData(json);
      })
      .catch(() => {});
  }, []);

  const currency = data?.currency ?? "USD";

  const kpis: KpiCardProps[] = [
    {
      label: "Total Leakage Identified",
      value: data ? fmt(data.totalLeakage, currency) : "$0.00",
      icon: SearchX,
    },
    {
      label: "Total Recovered",
      value: data ? fmt(data.totalRecovered, currency) : "$0.00",
      icon: MailCheck,
    },
    {
      label: "Cash Position",
      value: data ? fmt(data.cashPosition, currency) : "$0.00",
      icon: Wallet,
    },
    {
      label: "Next Tax Reserve",
      value: data ? fmt(data.taxReserve, currency) : "$0.00",
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

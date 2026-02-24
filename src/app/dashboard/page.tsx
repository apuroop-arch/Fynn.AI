import { KpiStrip } from "@/components/dashboard/kpi-strip";
import Link from "next/link";
import {
  Upload,
  SearchX,
  MailCheck,
  FileText,
} from "lucide-react";

const quickActions = [
  {
    label: "Upload Bank Statement",
    href: "/dashboard/upload",
    icon: Upload,
    description: "Import CSV transactions",
  },
  {
    label: "Detect Leakage",
    href: "/dashboard/leakage",
    icon: SearchX,
    description: "Find revenue leaks",
  },
  {
    label: "Recover Invoices",
    href: "/dashboard/recovery",
    icon: MailCheck,
    description: "Generate recovery emails",
  },
  {
    label: "Weekly Briefing",
    href: "/dashboard/briefing",
    icon: FileText,
    description: "View your AI briefing",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Your financial intelligence overview
        </p>
      </div>

      <KpiStrip />

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-emerald-200 hover:bg-emerald-50/50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                <action.icon className="h-5 w-5 text-zinc-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900">
                  {action.label}
                </p>
                <p className="text-xs text-zinc-500">{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

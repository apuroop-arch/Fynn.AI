"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  SearchX,
  MailCheck,
  Users,
  TrendingUp,
  Landmark,
  Settings,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leakage Detector", href: "/dashboard/leakage", icon: SearchX },
  { label: "Invoice Recovery", href: "/dashboard/recovery", icon: MailCheck },
  {
    label: "Profitability",
    href: "/dashboard/profitability",
    icon: Users,
  },
  { label: "Cash Forecast", href: "/dashboard/forecast", icon: TrendingUp },
  { label: "Tax Reserve", href: "/dashboard/tax", icon: Landmark },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r lg:border-zinc-200 lg:bg-white lg:min-h-screen">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-zinc-200">
        <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">F</span>
        </div>
        <span className="text-xl font-bold text-zinc-900">Fynn</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

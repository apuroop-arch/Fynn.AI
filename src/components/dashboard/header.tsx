"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { Bell } from "lucide-react";

export function Header() {
  const { user } = useUser();

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 lg:px-6">
      <div className="flex items-center gap-3 lg:hidden">
        <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">F</span>
        </div>
        <span className="text-lg font-bold text-zinc-900">Fynn</span>
      </div>

      <div className="hidden lg:block">
        <h2 className="text-sm text-zinc-500">
          Welcome back,{" "}
          <span className="font-medium text-zinc-900">
            {user?.firstName ?? "there"}
          </span>
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <span className="hidden sm:inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          Free Plan
        </span>

        <button
          type="button"
          className="relative rounded-lg p-2 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 transition-colors"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  );
}

"use client";

import { useUser } from "@clerk/nextjs";

export default function SettingsPage() {
  const { user } = useUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Manage your account and preferences
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-900">Profile</h2>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-600">
              Name
            </label>
            <p className="mt-1 text-sm text-zinc-900">
              {user?.fullName ?? "—"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-600">
              Email
            </label>
            <p className="mt-1 text-sm text-zinc-900">
              {user?.primaryEmailAddress?.emailAddress ?? "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-900">
            Subscription
          </h2>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-900">Free Plan</p>
              <p className="text-xs text-zinc-500">
                Basic features with limited AI analysis
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
            >
              Upgrade
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

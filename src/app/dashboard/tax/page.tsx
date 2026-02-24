import { Landmark } from "lucide-react";

export default function TaxPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Tax Reserve</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Estimated tax obligations and reserve recommendations
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white py-16">
        <Landmark className="h-10 w-10 text-zinc-300 mb-4" />
        <p className="text-sm font-medium text-zinc-500">
          Upload transactions to calculate tax reserves
        </p>
        <p className="text-xs text-zinc-400 mt-1">
          This module will estimate quarterly tax obligations
        </p>
      </div>
    </div>
  );
}

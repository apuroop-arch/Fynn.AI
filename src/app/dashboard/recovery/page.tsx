"use client";

import { useState } from "react";
import {
  MailCheck,
  Loader2,
  AlertTriangle,
  Send,
  Clipboard,
  Check,
} from "lucide-react";

interface RecoveryEmail {
  sequence_number: number;
  subject_line: string;
  body: string;
  tone: "friendly" | "professional" | "firm";
  tone_assessment: string;
}

interface Invoice {
  id: string;
  client_name: string;
  amount: number;
  currency: string;
  due_date: string;
}

const toneColors = {
  friendly: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  professional: "bg-blue-50 text-blue-700 ring-blue-600/20",
  firm: "bg-red-50 text-red-700 ring-red-600/20",
};

export default function RecoveryPage() {
  const [invoiceId, setInvoiceId] = useState("");
  const [emails, setEmails] = useState<RecoveryEmail[]>([]);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const generate = async () => {
    if (!invoiceId.trim()) {
      setError("Enter an invoice ID");
      return;
    }

    setLoading(true);
    setError("");
    setEmails([]);

    try {
      const res = await fetch("/api/recovery/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setEmails(data.emails);
      setInvoice(data.invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (email: RecoveryEmail, idx: number) => {
    const text = `Subject: ${email.subject_line}\n\n${email.body}`;
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const openGmail = (email: RecoveryEmail) => {
    const subject = encodeURIComponent(email.subject_line);
    const body = encodeURIComponent(email.body);
    window.open(
      `https://mail.google.com/mail/?view=cm&su=${subject}&body=${body}`,
      "_blank"
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">
          Invoice Recovery Engine
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          AI-generated recovery email sequences with escalating tone
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Input */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-base font-semibold text-zinc-900 mb-4">
          Generate Recovery Sequence
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            placeholder="Enter invoice ID (UUID)"
            className="flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MailCheck className="h-4 w-4" />
            )}
            {loading ? "Generating..." : "Generate Emails"}
          </button>
        </div>
      </div>

      {/* Invoice Context */}
      {invoice && (
        <div className="rounded-xl border border-zinc-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-900">
                {invoice.client_name}
              </p>
              <p className="text-xs text-zinc-500">
                Due: {invoice.due_date} | {invoice.currency}{" "}
                {invoice.amount.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Email Sequence */}
      {emails.length > 0 && (
        <div className="space-y-4">
          {emails.map((email, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-zinc-200 bg-white"
            >
              <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-600">
                    {email.sequence_number}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {email.subject_line}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {email.tone_assessment}
                    </p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${toneColors[email.tone]}`}
                >
                  {email.tone}
                </span>
              </div>

              <div className="px-6 py-4">
                <div className="prose prose-sm max-w-none text-zinc-700 whitespace-pre-wrap">
                  {email.body}
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-zinc-100 px-6 py-3">
                <button
                  onClick={() => copyToClipboard(email, idx)}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  {copiedIdx === idx ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Clipboard className="h-3.5 w-3.5" />
                  )}
                  {copiedIdx === idx ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={() => openGmail(email)}
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                  Open in Gmail
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {emails.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white py-16">
          <MailCheck className="h-10 w-10 text-zinc-300 mb-4" />
          <p className="text-sm font-medium text-zinc-500">
            Enter an invoice ID to generate recovery emails
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            3-email sequence with friendly to firm tone escalation
          </p>
        </div>
      )}
    </div>
  );
}

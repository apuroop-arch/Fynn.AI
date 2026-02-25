"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// ── Animated Counter Component ────────────────────────────────
function AnimatedCounter({ target, prefix = "$", suffix = "" }: { target: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 2000;
          const steps = 60;
          const increment = target / steps;
          let current = 0;
          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              setCount(target);
              clearInterval(timer);
            } else {
              setCount(Math.floor(current));
            }
          }, duration / steps);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}

// ── Feature Card ──────────────────────────────────────────────
function FeatureCard({
  icon,
  title,
  description,
  metric,
}: {
  icon: string;
  title: string;
  description: string;
  metric: string;
}) {
  return (
    <div className="group relative bg-white rounded-2xl p-6 border border-gray-100 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-50 transition-all duration-300 hover:-translate-y-1">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-2xl group-hover:bg-emerald-100 transition-colors">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-3">{description}</p>
          <div className="text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full inline-block">
            {metric}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pricing Card ──────────────────────────────────────────────
function PricingCard({
  name,
  price,
  annualPrice,
  description,
  features,
  highlighted,
  isAnnual,
}: {
  name: string;
  price: number;
  annualPrice: number;
  description: string;
  features: string[];
  highlighted: boolean;
  isAnnual: boolean;
}) {
  const displayPrice = isAnnual ? annualPrice : price;

  return (
    <div className={`relative rounded-2xl p-8 flex flex-col ${highlighted ? "bg-gray-900 text-white ring-2 ring-emerald-500 shadow-2xl shadow-emerald-500/10 scale-[1.02]" : "bg-white text-gray-900 border border-gray-200"}`}>
      {highlighted && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
          Most Popular
        </div>
      )}
      <div className="mb-6">
        <h3 className={`text-xl font-bold mb-1 ${highlighted ? "text-white" : "text-gray-900"}`}>{name}</h3>
        <p className={`text-sm ${highlighted ? "text-gray-400" : "text-gray-500"}`}>{description}</p>
      </div>
      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className={`text-5xl font-bold tracking-tight ${highlighted ? "text-white" : "text-gray-900"}`}>${displayPrice}</span>
          <span className={`text-sm ${highlighted ? "text-gray-400" : "text-gray-500"}`}>/mo</span>
        </div>
        {isAnnual && <p className="text-emerald-400 text-sm mt-1 font-medium">Billed annually &middot; 2 months free</p>}
      </div>
      <ul className="space-y-3 mb-8 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${highlighted ? "text-emerald-400" : "text-emerald-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className={highlighted ? "text-gray-300" : "text-gray-600"}>{f}</span>
          </li>
        ))}
      </ul>
      <Link href="/sign-up" className={`block w-full text-center py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200 ${highlighted ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25" : "bg-gray-100 hover:bg-gray-200 text-gray-900"}`}>
        Start 14-Day Free Trial
      </Link>
    </div>
  );
}

// ── Testimonial ───────────────────────────────────────────────
function Testimonial({ quote, name, role, amount }: { quote: string; name: string; role: string; amount: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <div className="flex items-center gap-1 mb-4">
        {[...Array(5)].map((_, i) => (
          <svg key={i} className="w-4 h-4 text-amber-400 fill-current" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <p className="text-gray-600 text-sm leading-relaxed mb-4">&ldquo;{quote}&rdquo;</p>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">{name}</p>
          <p className="text-xs text-gray-500">{role}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-emerald-600">{amount}</p>
          <p className="text-xs text-gray-500">recovered</p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ██  MAIN LANDING PAGE                                     ██
// ══════════════════════════════════════════════════════════════

export default function LandingPage() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* ── NAVBAR ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-100" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">F</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Fynn<span className="text-emerald-600">.ai</span></span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Features</a>
              <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
              <a href="#how-it-works" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">How It Works</a>
              <Link href="/sign-in" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Sign In</Link>
              <Link href="/sign-up" className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-emerald-600/20">Start Free Trial</Link>
            </div>
            <Link href="/sign-up" className="md:hidden bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg">Try Free</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, #059669 1px, transparent 0)`, backgroundSize: "40px 40px" }} />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-emerald-100/40 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-medium px-4 py-1.5 rounded-full mb-8">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              AI-Powered Financial Intelligence
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 leading-[1.1] tracking-tight mb-6">
              The AI CFO<br /><span className="text-emerald-600">you deserve</span> but<br />can&apos;t afford
            </h1>
            <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-4 leading-relaxed">
              Fynn finds the money you&apos;re losing. Unpaid invoices, wasted subscriptions, underpriced contracts &mdash; the average freelancer loses{" "}
              <span className="text-gray-900 font-semibold">$12,000&ndash;$18,000/year</span> to preventable leakage.
            </p>
            <p className="text-base text-gray-400 mb-10">
              For <span className="text-emerald-600 font-bold">$49/month</span>, Fynn delivers CFO-grade intelligence that traditionally costs $800+/month.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link href="/sign-up" className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base px-8 py-4 rounded-xl transition-all duration-200 hover:shadow-xl hover:shadow-emerald-600/20 hover:-translate-y-0.5">
                Start 14-Day Free Trial &rarr;
              </Link>
              <Link href="/demo" className="w-full sm:w-auto bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold text-base px-8 py-4 rounded-xl border border-gray-200 transition-all duration-200">
                Try Demo &mdash; No Signup
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                Bank-grade encryption
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                GDPR &amp; CCPA Compliant
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                First insights in under 10 minutes
              </div>
            </div>
          </div>
          <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center shadow-sm">
              <p className="text-3xl font-bold text-emerald-600"><AnimatedCounter target={4200} prefix="$" /></p>
              <p className="text-sm text-gray-500 mt-1">Avg. leakage found per user</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center shadow-sm">
              <p className="text-3xl font-bold text-emerald-600"><AnimatedCounter target={10} prefix="" suffix=" min" /></p>
              <p className="text-sm text-gray-500 mt-1">Time to first insight</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center shadow-sm">
              <p className="text-3xl font-bold text-emerald-600">7</p>
              <p className="text-sm text-gray-500 mt-1">Intelligence modules</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROBLEM / SOLUTION ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Your accounting software tells you what happened.<br />
              <span className="text-emerald-600">Fynn tells you what to do about it.</span>
            </h2>
            <p className="text-gray-500 text-lg">QuickBooks and Xero report your past. Fynn navigates your future with specific, dollar-quantified actions.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl p-8 border border-red-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Without Fynn</h3>
              </div>
              <ul className="space-y-3">
                {["Invoices slip through the cracks — $3,500 uncollected", "Paying $45/mo for subscriptions you forgot about", "No idea which clients are actually profitable", "Tax surprise every quarter", "10+ hours/month on financial admin"].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-600"><span className="text-red-400 mt-0.5">✗</span>{item}</li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl p-8 border border-emerald-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">With Fynn</h3>
              </div>
              <ul className="space-y-3">
                {["AI chases your invoices with context-aware emails", "Waste subscriptions flagged and annualized instantly", "Clients ranked by true profitability, not revenue", "Monthly tax reserve calculated to the dollar", "Monday morning briefing — 300 words, zero jargon"].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-600"><span className="text-emerald-500 mt-0.5">✓</span>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">7 Intelligence Modules.<br />One <span className="text-emerald-600">$49/month</span> subscription.</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">Each module solves a specific financial pain point with dollar-quantified recommendations.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            <FeatureCard icon="🔍" title="Revenue Leakage Detector" description="Finds every dollar you're losing to unpaid invoices, wasted subscriptions, scope creep, and duplicate charges." metric="Avg. $4,200 found per user" />
            <FeatureCard icon="📧" title="Invoice Recovery Engine" description="AI drafts context-aware follow-up emails that reference specific projects, relationships, and payment history." metric="3-email escalation sequence" />
            <FeatureCard icon="📊" title="Client Profitability Ranker" description="Ranks clients by true profit after accounting for payment delays, revision cycles, and communication overhead." metric="Health Score 0–100 per client" />
            <FeatureCard icon="📈" title="90-Day Cash Forecast" description="Probabilistic 3-scenario forecast that tells you exactly when cash drops below your safety threshold." metric="Optimistic / Realistic / Worst Case" />
            <FeatureCard icon="🧾" title="Tax Reserve Calculator" description="Calculates your exact quarterly tax reserve across US, UK, EU, and UAE jurisdictions." metric="Within 2% of IRS/HMRC worksheets" />
            <FeatureCard icon="💰" title="Pricing Leak Identifier" description="Benchmarks your rates against market data and calculates cumulative income lost to underpricing." metric="P25 / P50 / P75 benchmarks" />
          </div>
          <div className="mt-8 max-w-5xl mx-auto">
            <div className="bg-gray-900 rounded-2xl p-8 sm:p-10 flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1">
                <div className="text-emerald-400 text-sm font-medium uppercase tracking-wider mb-3">+ Weekly Financial Briefing</div>
                <h3 className="text-2xl font-bold text-white mb-3">Your Monday morning financial navigator</h3>
                <p className="text-gray-400 leading-relaxed">Every Monday at 7 AM, Fynn delivers a 300-word plain-English briefing to your inbox. Written like a trusted business partner &mdash; not a dashboard, not charts &mdash; a personal narrative about your money this week.</p>
              </div>
              <div className="flex-shrink-0 bg-gray-800 rounded-xl p-5 max-w-sm w-full border border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                  <span className="text-xs text-gray-500">Monday 7:00 AM</span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed italic">&ldquo;Good morning &mdash; your net position this week is $12,340, up $1,200 from last week. Your biggest concern: TechCorp&apos;s $2,100 invoice is now 47 days overdue and their payment speed is declining. I&apos;d recommend sending the follow-up today...&rdquo;</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">First insights in <span className="text-emerald-600">under 10 minutes</span></h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: "01", title: "Connect your data", desc: "Link Xero, QuickBooks, or upload a CSV/PDF bank statement. We read your data — never write to it." },
              { step: "02", title: "AI analyzes everything", desc: "Fynn's AI scans your invoices, transactions, subscriptions, and client patterns to find every leakage point." },
              { step: "03", title: "Get dollar-specific actions", desc: "\"Chase TechCorp's $2,100 invoice.\" \"Cancel your $45/mo unused Figma license.\" Specific amounts, specific actions." },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="text-5xl font-bold text-emerald-100 mb-4">{item.step}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Real money recovered for real freelancers</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Testimonial quote="Fynn found two invoices I'd completely forgotten about. One was $2,100 from a client who always pays late. The recovery email worked on the first try." name="Alex M." role="Independent Consultant, NYC" amount="$3,850" />
            <Testimonial quote="I was paying for 4 subscriptions I hadn't used in months. Fynn flagged them all in my first report. That's $180/month I was burning." name="Jordan P." role="Freelance Designer, London" amount="$2,160/yr" />
            <Testimonial quote="The Monday morning briefing is the feature I didn't know I needed. It's like having a CFO who actually knows my business writing me a personal note." name="Priya S." role="Marketing Consultant, Austin" amount="$5,200" />
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Less than your cheapest subscription waste</h2>
            <p className="text-gray-500 text-lg mb-8">14-day free trial on all plans. Cancel anytime.</p>
            <div className="flex items-center justify-center gap-3 mb-8">
              <span className={`text-sm font-medium ${!isAnnual ? "text-gray-900" : "text-gray-400"}`}>Monthly</span>
              <button onClick={() => setIsAnnual(!isAnnual)} className={`relative w-14 h-7 rounded-full transition-colors duration-200 ${isAnnual ? "bg-emerald-600" : "bg-gray-300"}`}>
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-200 ${isAnnual ? "translate-x-7" : ""}`} />
              </button>
              <span className={`text-sm font-medium ${isAnnual ? "text-gray-900" : "text-gray-400"}`}>Annual</span>
              {isAnnual && <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">2 months free</span>}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
            <PricingCard name="Solo" price={49} annualPrice={41} description="For independent freelancers" isAnnual={isAnnual} highlighted={false} features={["Revenue Leakage Detector (monthly)", "Invoice Recovery Engine (manual send)", "Client Profitability (top 3 clients)", "Tax Reserve Calculator (1 jurisdiction)", "CSV/PDF upload", "3 months data history", "Email support (48hr)"]} />
            <PricingCard name="Growth" price={149} annualPrice={124} description="For growing freelancers & small agencies" isAnnual={isAnnual} highlighted={true} features={["Everything in Solo, plus:", "Revenue Leakage Detector (weekly)", "Invoice Recovery (auto-drafts)", "Client Profitability (all clients)", "90-Day Cash Forecast", "Weekly Financial Briefing", "Xero or QuickBooks integration", "Multi-currency support", "12 months data history", "Email support (24hr)"]} />
            <PricingCard name="Scale" price={299} annualPrice={249} description="For agencies & consultancies" isAnnual={isAnnual} highlighted={false} features={["Everything in Growth, plus:", "Revenue Leakage Detector (daily)", "Invoice Recovery (auto-send)", "Client Profitability + Health Score", "Cash Forecast + Scenarios", "Pricing Leak Identifier", "All integrations", "All jurisdictions", "24 months data history", "Priority support (4hr)"]} />
          </div>
        </div>
      </section>

      {/* ── INTEGRATIONS ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Works with your existing tools</h2>
          <p className="text-gray-500 text-lg mb-12">Connect in 2 minutes. Read-only access &mdash; Fynn never writes to your accounts.</p>
          <div className="flex flex-wrap items-center justify-center gap-8 max-w-3xl mx-auto">
            {[
              { name: "Xero", status: "Available" },
              { name: "QuickBooks", status: "Available" },
              { name: "CSV / Excel", status: "Available" },
              { name: "PDF Upload", status: "Available" },
              { name: "Stripe", status: "Coming Soon" },
              { name: "Plaid", status: "Coming Soon" },
            ].map((tool, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center">
                  <span className="text-lg font-bold text-gray-400">{tool.name.charAt(0)}</span>
                </div>
                <span className="text-sm font-medium text-gray-700">{tool.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${tool.status === "Available" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>{tool.status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-900 rounded-3xl p-10 sm:p-16 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Stop losing money you&apos;ve already earned</h2>
              <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">The average freelancer loses $12,000&ndash;$18,000/year to preventable leakage. Fynn finds it in 10 minutes.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/sign-up" className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-base px-8 py-4 rounded-xl transition-all duration-200 hover:shadow-xl hover:shadow-emerald-500/25">Start 14-Day Free Trial &rarr;</Link>
                <Link href="/demo" className="w-full sm:w-auto text-gray-400 hover:text-white font-medium text-base px-8 py-4 transition-colors">or try the demo first</Link>
              </div>
              <p className="text-gray-600 text-xs mt-6">No credit card required to start &middot; Cancel anytime &middot; 7-day money-back guarantee</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center"><span className="text-white font-bold text-xs">F</span></div>
              <span className="text-lg font-bold text-gray-900">Fynn<span className="text-emerald-600">.ai</span></span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <Link href="/privacy" className="hover:text-gray-900 transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-gray-900 transition-colors">Terms of Service</Link>
              <a href="mailto:hello@fynn.ai" className="hover:text-gray-900 transition-colors">Contact</a>
            </div>
            <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} Fynn Technologies Inc.</p>
          </div>
          <p className="text-center text-xs text-gray-400 mt-8">Fynn provides financial intelligence for informational purposes. Consult a qualified financial advisor for regulated financial advice.</p>
        </div>
      </footer>
    </div>
  );
}
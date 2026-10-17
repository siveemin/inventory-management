"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers";
import { useSettings } from "@/lib/settings";

const features = [
  {
    id: "floor",
    kicker: "Warehouses",
    title: "Every warehouse has its own count",
    body: "Phnom Penh, Siem Reap, and the port keep separate bins. Transfers move stock only when the other side receives it.",
  },
  {
    id: "invoice",
    kicker: "Invoices",
    title: "Dollars and riel on the same page",
    body: "A sale prints in Khmer and English, with the exchange rate from Settings written under the total.",
  },
  {
    id: "counter",
    kicker: "Counter",
    title: "Scan, sell, deduct",
    body: "A camera or a wedge scanner adds the line. Confirming the sale takes the quantity off the shelf.",
  },
];

const steps = [
  { n: "01", title: "Receive", body: "A purchase order becomes stock when the cartons arrive." },
  { n: "02", title: "Count", body: "Low stock is the shelf under its minimum, not a guess." },
  { n: "03", title: "Sell", body: "Walk-in or a named customer. The warehouse you pick is the one that drops." },
  { n: "04", title: "Print", body: "The invoice is A5, bilingual, and ready for the counter." },
];

export default function LandingPage() {
  const { system } = useSettings();
  const { user } = useAuth();
  const enter = user ? "/dashboard" : "/login";
  const enterLabel = user ? "Open the books" : "Sign in";

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <a href="#top" className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-forest font-serif text-lg text-white">ស</span>
            <span className="min-w-0">
              <span className="block truncate font-serif text-xl leading-none">{system.name}</span>
              <span className="mt-1 block truncate text-xs text-ink-soft">{system.subtitle}</span>
            </span>
          </a>
          <nav className="hidden items-center gap-7 text-sm text-ink-soft md:flex">
            <a href="#floor" className="hover:text-ink">Warehouses</a>
            <a href="#invoice" className="hover:text-ink">Invoices</a>
            <a href="#counter" className="hover:text-ink">Counter</a>
          </nav>
          <Link href={enter} className="shrink-0 rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep">
            {enterLabel}
          </Link>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-forest">ភ្នំពេញ · សៀមរាប · ព្រះសីហនុ</p>
            <h1 className="mt-4 max-w-xl font-serif text-[2.6rem] leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.4rem]">
              The warehouse, kept in a quiet book.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-ink-soft sm:text-lg">
              {system.name} is the inventory desk for a Cambodian trading shop: stock across warehouses, sales in USD and KHR, and a Khmer invoice when the customer is waiting.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href={enter} className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper hover:bg-black">
                {enterLabel}
              </Link>
              <a href="#day" className="rounded-full border border-line bg-white px-5 py-3 text-sm text-ink hover:border-forest">
                See the day
              </a>
            </div>
          </div>

          <Ledger name={system.name} subtitle={system.subtitle} />
        </section>

        <section id="day" className="border-y border-line bg-white/60">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <div key={step.n}>
                <p className="font-serif text-sm text-copper">{step.n}</p>
                <h2 className="mt-2 font-serif text-2xl">{step.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-5 py-16 md:grid-cols-3">
          {features.map((feature) => (
            <article id={feature.id} key={feature.id} className="scroll-mt-24 rounded-[22px] border border-line bg-card p-6 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-forest">{feature.kicker}</p>
              <h2 className="mt-3 font-serif text-3xl leading-tight">{feature.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{feature.body}</p>
            </article>
          ))}
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="overflow-hidden rounded-[28px] bg-sidebar px-6 py-10 text-[#f6f1e8] sm:px-10 sm:py-14">
            <div className="grid items-end gap-8 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/50">For the counter and the warehouse</p>
                <h2 className="mt-3 max-w-lg font-serif text-4xl leading-tight sm:text-5xl">Open the book. The shelf is already counted.</h2>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <Link href={enter} className="rounded-full bg-forest px-5 py-3 text-sm font-medium text-white hover:bg-forest-deep">
                  {enterLabel}
                </Link>
                <Link href="/login" className="rounded-full border border-white/20 px-5 py-3 text-sm text-white/80 hover:border-white/40">
                  Demo sign-in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-ink-soft">
          <p className="font-serif text-ink">{system.name}</p>
          <p>USD · KHR · វិក្កយបត្រខ្មែរ</p>
        </div>
      </footer>
    </div>
  );
}

function Ledger({ name, subtitle }: { name: string; subtitle: string }) {
  const lines = [
    ["Jasmine rice 5kg", "2", "$13.00", "52,000៛"],
    ["Kampot pepper", "1", "$5.40", "21,600៛"],
    ["Kraft bags", "4", "$8.00", "32,000៛"],
  ];
  return (
    <div className="login-panel rounded-[28px] p-4 text-[#f6f1e8] shadow-[0_24px_60px_rgba(20,19,17,0.18)] sm:p-6">
      <div className="rounded-[22px] bg-[#fffcf8] p-5 text-ink sm:p-7">
        <div className="flex items-start justify-between gap-4 border-b border-forest/30 pb-4">
          <div>
            <p className="font-serif text-3xl">{name}</p>
            <p className="text-xs text-ink-soft">{subtitle}</p>
          </div>
          <div className="text-right">
            <p className="text-xs tracking-[0.16em] text-forest">វិក្កយបត្រ</p>
            <p className="font-serif text-lg">INVOICE</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-ink-soft">លេខ / No. SO-2026-0076 · Lotus Mart · Toul Kork</p>
        <div className="mt-4 grid gap-3 text-sm">
          {lines.map((line) => (
            <div key={line[0]} className="grid grid-cols-[1fr_auto_auto] items-baseline gap-3 border-b border-line pb-3">
              <p>{line[0]} <span className="text-ink-soft">× {line[1]}</span></p>
              <p className="tabular-nums">{line[2]}</p>
              <p className="hidden tabular-nums text-ink-soft sm:block">{line[3]}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-end justify-between">
          <p className="text-xs text-ink-soft">1 USD = 4,000 KHR</p>
          <div className="text-right">
            <p className="font-serif text-3xl">$26.40</p>
            <p className="text-sm text-ink-soft">105,600៛</p>
          </div>
        </div>
      </div>
    </div>
  );
}

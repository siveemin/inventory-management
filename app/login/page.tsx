"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useAuth, useToast } from "@/components/providers";
import { Button, Field, TextInput } from "@/components/ui";
import { useI18n, useSettings } from "@/lib/settings";
import { readSavedEmail, saveEmail } from "@/lib/storage";

const noSubscribe = () => () => {};

const demos = [
  ["Admin", "admin@sovann.kh", "admin123"],
  ["Warehouse", "warehouse@sovann.kh", "warehouse123"],
  ["Sales", "sales@sovann.kh", "sales123"],
  ["Staff", "staff@sovann.kh", "staff123"],
];

// Demo shortcuts appear on every environment, including the deployed site.
const showDemos = true;

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const { system } = useSettings();
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  // The last email signed in with "Remember me" is filled in for next time.
  const savedEmail = useSyncExternalStore(noSubscribe, readSavedEmail, () => "");
  const [typedEmail, setEmail] = useState<string | null>(null);
  const email = typedEmail ?? (savedEmail || (showDemos ? "admin@sovann.kh" : ""));
  const [password, setPassword] = useState(showDemos ? "admin123" : "");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, router, user]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await login(email, password, remember);
      saveEmail(email, remember);
      router.replace("/dashboard");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not sign in", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="login-panel hidden flex-col justify-between p-12 text-[#f6f1e8] lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#1F7A4D] font-serif text-2xl">ស</span>
          <span className="text-sm tracking-[0.18em] uppercase text-white/60">Phnom Penh</span>
        </div>
        <div>
          <p className="font-serif text-6xl leading-[0.95]">{system.name}</p>
          <p className="mt-4 max-w-md text-lg text-white/70">{system.subtitle}. Stock and sales for warehouses that trade in dollars and riel.</p>
        </div>
        <p className="text-sm text-white/50">USD · KHR · Khmer invoices · three warehouses</p>
      </section>
      <section className="grid place-items-center bg-paper px-5 py-10 sm:px-6 sm:py-16">
        <form onSubmit={onSubmit} className="w-full max-w-md">
          <p className="font-serif text-3xl lg:hidden">{system.name}</p>
          <h1 className="mt-1 font-serif text-3xl sm:text-4xl lg:mt-0">{t("login.welcome")}</h1>
          <p className="mt-2 text-sm text-ink-soft">{t("login.subtitle")}</p>
          <div className="mt-8 grid gap-4">
            <Field label={t("login.email")}>
              <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" />
            </Field>
            <Field label={t("login.password")}>
              <TextInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              {t("login.remember")}
            </label>
            <Button type="submit" disabled={busy}>{busy ? "…" : t("login.submit")}</Button>
          </div>
          {showDemos ? (
          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">{t("login.demo")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {demos.map(([label, demoEmail, demoPassword]) => (
                <button
                  key={demoEmail}
                  type="button"
                  onClick={() => { setEmail(demoEmail); setPassword(demoPassword); }}
                  className="rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:border-forest"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          ) : null}
        </form>
      </section>
    </div>
  );
}

"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { formatKhr, formatUsd, formatWhen, type DateFormat } from "./format";
import { translate, type Lang } from "./i18n";

export type SystemSettings = { name: string; subtitle: string };
export type Preferences = { language: Lang; dateFormat: DateFormat; timezone: string };

const defaultSystem: SystemSettings = { name: "IMS", subtitle: "Inventory Management System" };
const defaultPrefs: Preferences = {
  language: "en",
  dateFormat: "DD/MM/YYYY",
  timezone: "Asia/Phnom_Penh",
};

type SettingsValue = {
  system: SystemSettings;
  rate: number;
  prefs: Preferences;
  ready: boolean;
  updateSystem: (next: SystemSettings) => void;
  updateRate: (next: number) => void;
  updatePrefs: (next: Preferences) => void;
};

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [system, setSystem] = useState(defaultSystem);
  const [rate, setRate] = useState(4000);
  const [prefs, setPrefs] = useState(defaultPrefs);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const storedSystem = localStorage.getItem("systemSettings");
      if (storedSystem) setSystem({ ...defaultSystem, ...JSON.parse(storedSystem) });
      const storedRate = localStorage.getItem("invoiceExchangeRate");
      if (storedRate) setRate(Number(storedRate) || 4000);
      const storedPrefs = localStorage.getItem("preferences");
      if (storedPrefs) setPrefs({ ...defaultPrefs, ...JSON.parse(storedPrefs) });
    } catch {
      /* keep defaults */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = prefs.language === "km" ? "km" : "en";
    document.documentElement.dataset.lang = prefs.language;
    document.title = system.name || "IMS";
  }, [prefs.language, ready, system.name]);

  const value = useMemo<SettingsValue>(
    () => ({
      system,
      rate,
      prefs,
      ready,
      updateSystem: (next) => {
        setSystem(next);
        localStorage.setItem("systemSettings", JSON.stringify(next));
      },
      updateRate: (next) => {
        const safe = Number.isFinite(next) && next > 0 ? next : 4000;
        setRate(safe);
        localStorage.setItem("invoiceExchangeRate", String(safe));
      },
      updatePrefs: (next) => {
        setPrefs(next);
        localStorage.setItem("preferences", JSON.stringify(next));
      },
    }),
    [prefs, rate, ready, system],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("Settings missing");
  return ctx;
}

export function useI18n() {
  const { prefs } = useSettings();
  return {
    lang: prefs.language,
    t: (key: string) => translate(prefs.language, key),
  };
}

export function useFormat() {
  const { prefs, rate } = useSettings();
  return {
    rate,
    usd: (n: number) => formatUsd(n),
    khr: (n: number) => formatKhr((n || 0) * rate),
    khrAmount: (n: number) => formatKhr(n),
    date: (value: string | Date | null | undefined) => formatWhen(value, prefs, false),
    dateTime: (value: string | Date | null | undefined) => formatWhen(value, prefs, true),
  };
}

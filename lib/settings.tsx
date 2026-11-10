"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { useHydrated } from "./client";
import { formatKhr, formatUsd, formatWhen, type Currency, type DateFormat } from "./format";
import { translate, type Lang } from "./i18n";

export type SystemSettings = { name: string; subtitle: string };
export type Preferences = { language: Lang; dateFormat: DateFormat; timezone: string; currency: Currency };

const defaultSystem: SystemSettings = { name: "IMS", subtitle: "Inventory Management System" };
const defaultPrefs: Preferences = {
  language: "en",
  dateFormat: "DD/MM/YYYY",
  timezone: "Asia/Phnom_Penh",
  currency: "KHR",
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

// Settings live in localStorage; this event tells every reader in this tab to re-read.
const SETTINGS_EVENT = "ims:settings";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SETTINGS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SETTINGS_EVENT, onChange);
  };
}

function readStored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

function useStored(key: string) {
  return useSyncExternalStore(subscribe, () => readStored(key), () => null);
}

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const storedSystem = useStored("systemSettings");
  const storedRate = useStored("invoiceExchangeRate");
  const storedPrefs = useStored("preferences");
  const ready = useHydrated();
  const system = useMemo(() => parse(storedSystem, defaultSystem), [storedSystem]);
  const rate = Number(storedRate) || 4000;
  const prefs = useMemo(() => parse(storedPrefs, defaultPrefs), [storedPrefs]);

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
      updateSystem: (next) => writeStored("systemSettings", JSON.stringify(next)),
      updateRate: (next) => {
        const safe = Number.isFinite(next) && next > 0 ? next : 4000;
        writeStored("invoiceExchangeRate", String(safe));
      },
      updatePrefs: (next) => writeStored("preferences", JSON.stringify(next)),
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
  const currency: Currency = prefs.currency === "USD" ? "USD" : "KHR";
  const inKhr = currency === "KHR";
  return {
    rate,
    currency,
    /** Display a stored USD amount in the chosen currency. */
    amount: (n: number) => (inKhr ? formatKhr((n || 0) * rate) : formatUsd(n)),
    /** The same amount in the other currency, for a secondary line. */
    other: (n: number) => (inKhr ? formatUsd(n) : formatKhr((n || 0) * rate)),
    /** Convert a stored USD amount to the number shown on charts / in inputs. */
    toDisplay: (n: number) => (inKhr ? Math.round((n || 0) * rate) : n || 0),
    /** Convert a typed amount in the chosen currency back to stored USD. */
    fromDisplay: (n: number) => (inKhr ? (n || 0) / rate : n || 0),
    usd: (n: number) => formatUsd(n),
    khr: (n: number) => formatKhr((n || 0) * rate),
    khrAmount: (n: number) => formatKhr(n),
    date: (value: string | Date | null | undefined) => formatWhen(value, prefs, false),
    dateTime: (value: string | Date | null | undefined) => formatWhen(value, prefs, true),
  };
}

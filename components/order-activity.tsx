"use client";

import { useState } from "react";
import { Field, TextInput } from "./ui";
import { useApi } from "@/lib/client";
import { useFormat, useI18n } from "@/lib/settings";

/** "2026-11-10T14:30" for a datetime-local input, in the viewer's local time. */
export function nowLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** The ISO time to send for a datetime-local value ("" means now). */
export function whenToIso(local: string) {
  return local ? new Date(local).toISOString() : undefined;
}

/** Day-and-hour picker for when goods were taken or returned. Defaults to now. */
export function WhenField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useI18n();
  return (
    <Field label={t("when.label")} hint={t("when.hint")}>
      <TextInput type="datetime-local" value={value} max={nowLocal()} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

/** Keep a "When" value that starts at the moment the form opens. */
export function useWhen() {
  return useState(nowLocal);
}

type Activity = {
  id: string;
  type: string;
  quantity: number;
  notes: string | null;
  createdAt: string;
  product: { name: string };
  user: { name: string } | null;
};

/** Every take and return on an order, with day and hour, oldest first. */
export function OrderActivity({ orderId, version = 0 }: { orderId: string; version?: number }) {
  const { t } = useI18n();
  const { dateTime } = useFormat();
  const log = useApi<{ data: Activity[] }>(`/api/sales-orders/${orderId}/activity?v=${version}`);
  const rows = log.data?.data || [];
  if (!rows.length) return null;

  const label = (row: Activity) => {
    if (row.type === "SALE") return t("log.took");
    if (row.type === "SALE_RETURN") return row.quantity >= 0 ? t("log.returned") : t("log.unreturned");
    return row.notes?.includes("(edited)") ? t("log.corrected") : t("log.putBack");
  };
  const tone = (row: Activity) =>
    row.type === "SALE" ? "bg-[#e5f0f6] text-[#1d5678]" : row.type === "SALE_RETURN" ? "bg-[#e5f4ea] text-[#17663a]" : "bg-[#f1ebe3] text-[#665e54]";

  return (
    <div className="border-t border-line p-4 sm:p-5">
      <p className="mb-3 font-medium">{t("log.title")}</p>
      <ol className="grid gap-2">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="shrink-0 tabular-nums text-ink-soft sm:w-32">{dateTime(row.createdAt)}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(row)}`}>{label(row)}</span>
            <span className="font-semibold tabular-nums">{Math.abs(row.quantity)}</span>
            {/* Phones: product and who recorded it go on their own line. */}
            <span className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
              {row.product.name}
              {row.user ? <span className="ml-2 text-xs text-ink-soft sm:hidden">· {row.user.name}</span> : null}
            </span>
            {row.user ? <span className="hidden text-xs text-ink-soft sm:inline">{row.user.name}</span> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

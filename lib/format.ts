export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";

export function round2(n: number) {
  return Math.round((n || 0) * 100) / 100;
}

/**
 * Money is stored in USD. Prices typed in riel (e.g. 1,500 ៛ at 4,000/$ = $0.375)
 * need more than cents, or they come back as 1,520 ៛. Six decimals keeps riel exact.
 */
export function roundMoney(n: number) {
  return Math.round((n || 0) * 1e6) / 1e6;
}

export type Currency = "KHR" | "USD";

export function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
}

export function formatKhr(n: number) {
  return `${Math.round(n || 0).toLocaleString("en-US")} ៛`;
}

export function formatQty(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n || 0);
}

export function salesTotals(lines: { quantity: number; unitPrice: number }[], discount: number, taxPct: number) {
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const base = Math.max(0, subtotal - discount);
  const total = base * (1 + taxPct / 100);
  return { subtotal: roundMoney(subtotal), total: roundMoney(total) };
}

export function sellingUnit(price: number, discountPct: number) {
  return roundMoney(price * (1 - (discountPct || 0) / 100));
}

export function toDateInput(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function dayKey(date: Date, timeZone = "Asia/Phnom_Penh") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatWhen(
  value: string | Date | null | undefined,
  prefs: { dateFormat: DateFormat; timezone: string },
  withTime = false,
) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: prefs.timezone || "Asia/Phnom_Penh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit" as const, minute: "2-digit" as const, hourCycle: "h23" as const } : {}),
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const day = get("day");
  const month = get("month");
  const year = get("year");
  const dateStr =
    prefs.dateFormat === "MM/DD/YYYY"
      ? `${month}/${day}/${year}`
      : prefs.dateFormat === "YYYY-MM-DD"
        ? `${year}-${month}-${day}`
        : `${day}/${month}/${year}`;
  return withTime ? `${dateStr} ${get("hour")}:${get("minute")}` : dateStr;
}

export function slugify(name: string) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "category";
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (value: unknown) => {
    const text = value == null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [headers.join(","), ...rows.map((row) => headers.map((key) => esc(row[key])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export const statusTone: Record<string, "green" | "yellow" | "red" | "gray" | "blue"> = {
  ACTIVE: "green",
  INACTIVE: "gray",
  DRAFT: "gray",
  SUBMITTED: "blue",
  APPROVED: "green",
  PARTIALLY_RECEIVED: "yellow",
  RECEIVED: "green",
  CANCELLED: "red",
  CONFIRMED: "blue",
  PROCESSING: "yellow",
  COMPLETED: "green",
  PENDING_APPROVAL: "yellow",
  IN_TRANSIT: "blue",
  STOCK_IN: "green",
  STOCK_OUT: "red",
  ADJUSTMENT: "yellow",
  SALE: "blue",
  PURCHASE_RECEIVE: "green",
  TRANSFER_IN: "green",
  TRANSFER_OUT: "yellow",
  SALE_REVERSAL: "gray",
  SALE_RETURN: "green",
};

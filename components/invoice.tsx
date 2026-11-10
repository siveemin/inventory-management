"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { formatKhr, formatUsd } from "@/lib/format";
import { useFormat, useI18n, useSettings } from "@/lib/settings";
import type { InvoiceData, SalesOrder } from "@/lib/types";
import { Button, cx } from "./ui";

export function toInvoice(order: SalesOrder, walkIn: string): InvoiceData {
  const consign = order.kind === "CONSIGN";
  return {
    orderNumber: order.orderNumber,
    orderDate: order.orderDate,
    customerName: order.customer?.name || walkIn,
    customerPhone: order.customer?.phone || null,
    warehouseName: order.warehouse?.name || "",
    consign,
    // Take & return lists everything taken; a normal sale lists only what was sold.
    items: order.items
      .filter((item) => consign || item.quantity - item.returnedQty > 0)
      .map((item) => ({
        name: item.product?.name || "Item",
        sku: item.product?.sku,
        date: item.createdAt || order.orderDate,
        taken: item.quantity,
        returned: item.returnedQty,
        quantity: item.quantity - item.returnedQty,
        unitPrice: item.unitPrice,
      })),
    discount: order.discount,
    taxPct: order.taxPct,
    subtotal: order.subtotal,
    total: order.total,
    notes: order.notes,
  };
}

export type Paper = "A5" | "A4" | "80mm";
const PAPERS: Paper[] = ["80mm", "A5", "A4"];
const PAPER_KEY = "invoicePaper";
const sheetWidth: Record<Paper, string> = { "80mm": "72mm", A5: "148mm", A4: "210mm" };
const pageRule: Record<Paper, string> = {
  "80mm": "@page { size: 80mm auto; margin: 3mm; }",
  A5: "@page { size: A5; margin: 8mm; }",
  A4: "@page { size: A4; margin: 12mm; }",
};

function readPaper(): Paper {
  try {
    const saved = localStorage.getItem(PAPER_KEY);
    return saved === "A5" || saved === "A4" || saved === "80mm" ? saved : "A5";
  } catch {
    return "A5";
  }
}

/** Print only the .invoice-print-root content, on the chosen paper, from this page (no pop-up window). */
export function printSheet(paper: Paper) {
  const style = document.createElement("style");
  style.textContent = pageRule[paper];
  document.head.appendChild(style);
  document.body.classList.add("printing-invoice");
  const done = () => {
    document.body.classList.remove("printing-invoice");
    style.remove();
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}

export function KhmerInvoice({ order }: { order: InvoiceData }) {
  const { t } = useI18n();
  const [paper, setPaper] = useState<Paper>(readPaper);

  function choose(next: Paper) {
    setPaper(next);
    try {
      localStorage.setItem(PAPER_KEY, next);
    } catch {
      /* storage blocked */
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full border border-line bg-white p-1" role="group" aria-label={t("invoice.paper")}>
          {PAPERS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => choose(item)}
              className={cx("rounded-full px-3 py-1.5 text-sm", paper === item ? "bg-ink text-white" : "text-ink-soft")}
            >
              {item === "80mm" ? t("invoice.receipt") : item}
            </button>
          ))}
        </div>
        <Button onClick={() => printSheet(paper)}>🖨 {t("action.print")}</Button>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-[#f1ebe3] p-3">
        <InvoiceSheet order={order} paper={paper} />
      </div>
      {/* The copy that actually prints: a direct child of <body>, shown only while printing. */}
      {typeof document !== "undefined"
        ? createPortal(<div className="invoice-print-root"><InvoiceSheet order={order} paper={paper} printing /></div>, document.body)
        : null}
    </div>
  );
}

function InvoiceSheet({ order, paper, printing }: { order: InvoiceData; paper: Paper; printing?: boolean }) {
  const { system, rate, prefs } = useSettings();
  const { date } = useFormat();
  const khrFirst = prefs.currency !== "USD";
  const main = (usd: number) => (khrFirst ? formatKhr(usd * rate) : formatUsd(usd));
  const second = (usd: number) => (khrFirst ? formatUsd(usd) : formatKhr(usd * rate));
  const receipt = paper === "80mm";
  const tax = order.total - Math.max(0, order.subtotal - order.discount);

  return (
    <div
      className={cx("invoice-sheet mx-auto bg-white text-[#1c1915]", receipt ? "p-2 text-[11px]" : "p-6 text-sm", printing ? "" : "shadow-sm")}
      style={{ width: printing ? "100%" : sheetWidth[paper], maxWidth: printing ? sheetWidth[paper] : undefined }}
    >
      {/* Header */}
      <div className={cx("border-b-2 border-[#1F7A4D] pb-3", receipt ? "text-center" : "flex items-start justify-between gap-4")}>
        <div>
          <p className={cx("font-serif leading-tight", receipt ? "text-lg" : "text-3xl")}>{system.name}</p>
          <p className="text-[#6f675e]">{system.subtitle}</p>
        </div>
        <div className={receipt ? "mt-1" : "text-right"}>
          <p className="font-bold text-[#1F7A4D]">{order.consign ? "វិក្កយបត្រ យកទៅលក់" : "វិក្កយបត្រ"}</p>
          <p className="font-serif">{order.consign ? "TAKE & RETURN INVOICE" : "INVOICE"}</p>
        </div>
      </div>

      {/* Order details */}
      <div className={cx("mt-3 grid gap-x-4 gap-y-1", receipt ? "grid-cols-1" : "grid-cols-2")}>
        <Info label="លេខ / No." value={order.orderNumber} />
        <Info label="ថ្ងៃ / Date" value={date(order.orderDate)} />
        <Info label="អតិថិជន / Customer" value={order.customerName + (order.customerPhone ? ` · ${order.customerPhone}` : "")} />
        {order.warehouseName ? <Info label="ឃ្លាំង / From" value={order.warehouseName} /> : null}
      </div>

      {/* Lines */}
      <table className="mt-3 w-full border-collapse text-left">
        <thead>
          <tr className="border-y border-[#1c1915] text-[#6f675e]">
            {order.consign ? <th className="py-1.5 pr-1 font-normal">ថ្ងៃ<br />Date</th> : null}
            <th className="py-1.5 pr-1 font-normal">ទំនិញ<br />Item</th>
            {order.consign ? (
              <>
                <th className="px-1 text-right font-normal">យក<br />Took</th>
                <th className="px-1 text-right font-normal">សង<br />Back</th>
                <th className="px-1 text-right font-normal">លក់<br />Sold</th>
              </>
            ) : (
              <th className="px-1 text-right font-normal">ចំនួន<br />Qty</th>
            )}
            {receipt ? null : <th className="px-1 text-right font-normal">តម្លៃ<br />Price</th>}
            <th className="pl-1 text-right font-normal">សរុប<br />Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, index) => (
            <tr key={`${item.name}-${index}`} className="border-b border-[#e4dcd0] align-top">
              {order.consign ? <td className="whitespace-nowrap py-1.5 pr-1 text-[#6f675e]">{shortDate(item.date)}</td> : null}
              <td className="py-1.5 pr-1">
                {item.name}
                {receipt ? <span className="block text-[#6f675e]">{item.quantity} × {main(item.unitPrice)}</span> : null}
              </td>
              {order.consign ? (
                <>
                  <td className="px-1 text-right tabular-nums">{item.taken}</td>
                  <td className="px-1 text-right tabular-nums">{item.returned}</td>
                  <td className="px-1 text-right font-bold tabular-nums">{item.quantity}</td>
                </>
              ) : (
                <td className="px-1 text-right tabular-nums">{item.quantity}</td>
              )}
              {receipt ? null : <td className="px-1 text-right tabular-nums">{main(item.unitPrice)}</td>}
              <td className="pl-1 text-right tabular-nums">{main(item.quantity * item.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className={cx("mt-3", receipt ? "" : "ml-auto w-64")}>
        <Row label="សរុបរង / Subtotal" value={main(order.subtotal)} />
        {order.discount ? <Row label="បញ្ចុះតម្លៃ / Discount" value={`− ${main(order.discount)}`} /> : null}
        {order.taxPct ? <Row label={`ពន្ធ / Tax ${order.taxPct}%`} value={main(tax)} /> : null}
        <div className="mt-1 flex items-baseline justify-between gap-3 border-t-2 border-[#1c1915] pt-1.5">
          <span className="font-bold">{order.consign ? "ត្រូវបង់ / To pay" : "សរុប / Total"}</span>
          <span className="text-right">
            <span className={cx("block font-bold tabular-nums", receipt ? "text-base" : "text-2xl")}>{main(order.total)}</span>
            <span className="block text-[#6f675e] tabular-nums">{second(order.total)}</span>
          </span>
        </div>
      </div>

      {order.notes ? <p className="mt-3 text-[#6f675e]">{order.notes}</p> : null}

      {/* Signatures: both sides confirm goods handed over (and returned). */}
      {receipt ? null : (
        <div className="mt-10 grid grid-cols-2 gap-8 text-center text-[#6f675e]">
          <div className="border-t border-[#1c1915] pt-1">ហត្ថលេខាអតិថិជន<br />Customer</div>
          <div className="border-t border-[#1c1915] pt-1">ហត្ថលេខាអ្នកលក់<br />Seller</div>
        </div>
      )}
      <p className="mt-4 text-center text-[#6f675e]">
        សូមអរគុណ · Thank you
        <br />1 USD = {rate.toLocaleString("en-US")} ៛
      </p>
    </div>
  );
}

/** "10/11 14:30" — day, month and hour the goods were taken. */
function shortDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(d.getDate())}/${two(d.getMonth() + 1)} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-[#6f675e]">{label}: </span>
      <span className="font-medium">{value}</span>
    </p>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-[#6f675e]">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

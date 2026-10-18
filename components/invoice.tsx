"use client";

import { useRef } from "react";
import { formatKhr, formatUsd } from "@/lib/format";
import { useFormat, useI18n, useSettings } from "@/lib/settings";
import type { InvoiceData, SalesOrder } from "@/lib/types";
import { Button } from "./ui";

export function toInvoice(order: SalesOrder, walkIn: string): InvoiceData {
  return {
    orderNumber: order.orderNumber,
    orderDate: order.orderDate,
    customerName: order.customer?.name || walkIn,
    warehouseName: order.warehouse?.name || "",
    items: order.items.map((item) => ({
      name: item.product?.name || "Item",
      sku: item.product?.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    discount: order.discount,
    taxPct: order.taxPct,
    subtotal: order.subtotal,
    total: order.total,
    notes: order.notes,
  };
}

export function KhmerInvoice({ order }: { order: InvoiceData }) {
  const ref = useRef<HTMLDivElement>(null);
  const { system, rate } = useSettings();
  const { date } = useFormat();
  const { t } = useI18n();

  function print() {
    const node = ref.current;
    if (!node) return;
    const win = window.open("", "_blank", "width=720,height=900");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>${order.orderNumber}</title>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560&family=Noto+Sans+Khmer:wght@400;600&display=swap" />
      <style>
        body { margin: 0; background: #fff; }
        @page { size: A5; margin: 10mm; }
      </style></head><body>${node.outerHTML}</body></html>`);
    win.document.close();
    win.onload = () => win.print();
    setTimeout(() => win.print(), 500);
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={print}>{t("action.print")}</Button>
      </div>
      <div ref={ref} id="invoice-sheet" className="mx-auto w-full max-w-[148mm] overflow-x-auto bg-white p-4 text-[#1c1915] shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#1F7A4D] pb-4">
          <div>
            <p className="font-serif text-3xl">{system.name}</p>
            <p className="text-xs text-[#6f675e]">{system.subtitle}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-[#1F7A4D]" style={{ fontFamily: "var(--font-khmer), sans-serif" }}>វិក្កយបត្រ</p>
            <p className="font-serif text-xl">INVOICE</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <p><span className="text-[#6f675e]">លេខ / No.</span><br />{order.orderNumber}</p>
          <p><span className="text-[#6f675e]">កាលបរិច្ឆេទ / Date</span><br />{date(order.orderDate)}</p>
          <p><span className="text-[#6f675e]">អតិថិជន / Customer</span><br />{order.customerName}</p>
          <p><span className="text-[#6f675e]">ឃ្លាំង / Warehouse</span><br />{order.warehouseName}</p>
        </div>
        <table className="mt-5 w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#e4dcd0] text-[#6f675e]">
              <th className="py-2">ទំនិញ / Item</th>
              <th>បរិមាណ</th>
              <th>USD</th>
              <th>KHR</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={`${item.name}-${index}`} className="border-b border-[#f1ebe3]">
                <td className="py-2">{item.name}</td>
                <td>{item.quantity}</td>
                <td>{formatUsd(item.unitPrice)}</td>
                <td>{formatKhr(item.unitPrice * rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 ml-auto w-56 text-sm">
          <Row label="សរុបរង / Subtotal" value={formatUsd(order.subtotal)} />
          <Row label="បញ្ចុះតម្លៃ / Discount" value={formatUsd(order.discount)} />
          <Row label={`ពន្ធ / Tax ${order.taxPct}%`} value={formatUsd(order.total - Math.max(0, order.subtotal - order.discount))} />
          <div className="mt-2 border-t border-[#1c1915] pt-2">
            <p className="font-serif text-2xl">{formatUsd(order.total)}</p>
            <p>{formatKhr(order.total * rate)}</p>
          </div>
        </div>
        {order.notes ? <p className="mt-4 text-xs text-[#6f675e]">{order.notes}</p> : null}
        <p className="mt-6 text-center text-xs text-[#6f675e]">អរគុណ · Thank you<br />1 USD = {rate.toLocaleString("en-US")} KHR</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-[#6f675e]">{label}</span>
      <span>{value}</span>
    </div>
  );
}

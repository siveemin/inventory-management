"use client";

import Link from "next/link";
import { Button, Card } from "./ui";
import { useApi } from "@/lib/client";
import { useFormat, useI18n } from "@/lib/settings";

export type OpenInvoice = {
  id: string;
  orderNumber: string;
  orderDate: string;
  total: number;
  warehouseId: string;
  _count: { items: number };
};

/** A customer's one open invoice: everything they took and have not paid for yet. */
export function useOpenInvoice(customerId: string | null | undefined) {
  const res = useApi<{ data: OpenInvoice | null }>(customerId ? `/api/customers/${customerId}/open-invoice` : null);
  return { invoice: customerId ? res.data?.data ?? null : null, reload: res.reload };
}

export function OpenInvoiceCard({ customerId }: { customerId: string }) {
  const { t } = useI18n();
  const money = useFormat();
  const { invoice } = useOpenInvoice(customerId);
  return (
    <Card className={`mb-4 p-4 sm:p-5 ${invoice ? "border-[#e8c98f] bg-[#fdf6e7]" : ""}`}>
      {invoice ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">{t("open.invoice")} · {invoice.orderNumber}</p>
            <p className="mt-1 font-serif text-3xl tabular-nums text-copper">{money.amount(invoice.total)}</p>
            <p className="text-sm text-ink-soft">{t("open.since")} {money.date(invoice.orderDate)} · {invoice._count.items} {t("history.products")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/sales-orders/${invoice.id}?add=1`}><Button variant="outline">+ {t("action.addProducts")}</Button></Link>
            <Link href={`/sales-orders/${invoice.id}?print=1`}><Button variant="outline">🖨 {t("action.print")}</Button></Link>
            <Link href={`/sales-orders/${invoice.id}`}><Button>{t("open.view")}</Button></Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">{t("open.none")}</p>
            <p className="text-sm text-ink-soft">{t("open.noneHint")}</p>
          </div>
          <Link href={`/sales-orders/new?customer=${customerId}&kind=CONSIGN`}><Button>+ {t("open.start")}</Button></Link>
        </div>
      )}
    </Card>
  );
}

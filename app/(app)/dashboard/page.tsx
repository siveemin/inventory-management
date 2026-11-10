"use client";

import Link from "next/link";
import { SalesLine, StockBars } from "@/components/charts";
import { useAuth } from "@/components/providers";
import { Card, ErrorNote, LoadingBlock, PageHeader, StatusBadge, Table, Td, Th } from "@/components/ui";
import { useApi } from "@/lib/client";
import { useFormat, useI18n } from "@/lib/settings";
import type { LowStockRow } from "@/lib/types";

type Dashboard = {
  kpis: { products: number; stockValue: number; lowStock: number; pendingOrders: number };
  stockByCategory: { name: string; quantity: number }[];
  sales: { date: string; label: string; total: number }[];
  activity: { id: string; product: string; type: string; quantity: number; warehouse: string; createdAt: string }[];
  lowStock: LowStockRow[];
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const money = useFormat();
  const { data, loading, error } = useApi<Dashboard>("/api/dashboard");
  const hour = new Date().getHours();
  const greet = hour < 12 ? t("greet.morning") : hour < 17 ? t("greet.afternoon") : t("greet.evening");

  return (
    <div>
      <PageHeader title={`${greet}, ${user?.name.split(" ")[0] || ""}`} subtitle={t("sub.dashboard")} />
      <ErrorNote message={error} />
      {loading || !data ? <LoadingBlock /> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 2xl:grid-cols-4">
            <Kpi label={t("dash.products")} value={String(data.kpis.products)} hint={t("sub.products")} />
            <Kpi label={t("dash.value")} value={money.amount(data.kpis.stockValue)} hint={t("dash.valueHint")} />
            <Kpi label={t("dash.low")} value={String(data.kpis.lowStock)} hint={t("sub.lowStock")} />
            <Kpi label={t("dash.pending")} value={String(data.kpis.pendingOrders)} hint={t("sub.orders")} />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Card className="p-4 sm:p-5">
              <h2 className="mb-3 font-serif text-xl sm:text-2xl">{t("dash.byCategory")}</h2>
              <StockBars data={data.stockByCategory} />
            </Card>
            <Card className="p-4 sm:p-5">
              <h2 className="mb-3 font-serif text-xl sm:text-2xl">{t("dash.sales30")}</h2>
              <SalesLine data={data.sales.map((row) => ({ ...row, total: money.toDisplay(row.total) }))} />
            </Card>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <h2 className="px-4 pt-4 font-serif text-xl sm:px-5 sm:pt-5 sm:text-2xl">{t("dash.activity")}</h2>
              {/* Phones: stacked rows instead of a wide table that scrolls sideways. */}
              <ul className="grid gap-0 px-4 pb-2 pt-2 sm:hidden">
                {data.activity.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-3 border-b border-line py-3 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.product}</p>
                      <p className="truncate text-xs text-ink-soft">{row.warehouse} · {money.dateTime(row.createdAt)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-medium tabular-nums">{row.quantity > 0 ? `+${row.quantity}` : row.quantity}</span>
                      <StatusBadge status={row.type} label={t(`status.${row.type}`)} />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden sm:block">
              <Table>
                <thead><tr><Th>{t("label.product")}</Th><Th>{t("label.type")}</Th><Th>{t("label.quantity")}</Th><Th>{t("label.warehouse")}</Th><Th>{t("label.date")}</Th></tr></thead>
                <tbody>
                  {data.activity.map((row) => (
                    <tr key={row.id} className="border-t border-line">
                      <Td>{row.product}</Td>
                      <Td><StatusBadge status={row.type} label={t(`status.${row.type}`)} /></Td>
                      <Td className="tabular-nums">{row.quantity > 0 ? `+${row.quantity}` : row.quantity}</Td>
                      <Td>{row.warehouse}</Td>
                      <Td>{money.dateTime(row.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              </div>
            </Card>
            <Card className="p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-serif text-xl sm:text-2xl">{t("dash.lowTable")}</h2>
                <Link href="/low-stock" className="text-sm text-forest">{t("nav.lowStock")}</Link>
              </div>
              <div className="grid gap-3">
                {data.lowStock.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 border-b border-line pb-3 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.product}</p>
                      <p className="truncate text-xs text-ink-soft">{row.warehouse} · {row.sku}</p>
                    </div>
                    <p className="shrink-0 text-sm tabular-nums text-copper">{row.quantity} / {row.minStock}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft sm:text-[11px] sm:tracking-[0.16em]">{label}</p>
      <p className="mt-2 break-all font-serif text-2xl leading-none tracking-tight tabular-nums sm:mt-3 sm:text-[2rem] 2xl:text-4xl">{value}</p>
      <p className="mt-2 line-clamp-2 text-xs text-ink-soft sm:text-sm">{hint}</p>
    </Card>
  );
}

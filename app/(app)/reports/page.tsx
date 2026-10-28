"use client";

import { useMemo, useState } from "react";
import { SalesLine, TopBars, ValuePie } from "@/components/charts";
import { Button, Card, EmptyState, ErrorNote, LoadingBlock, PageHeader, StatusBadge, Table, Td, Th } from "@/components/ui";
import { qs, useApi } from "@/lib/client";
import { downloadCsv, toDateInput } from "@/lib/format";
import { useFormat, useI18n } from "@/lib/settings";
import type { Meta, StockMove } from "@/lib/types";

type SalesReport = { tab: "sales"; revenue: number; orders: number; average: number; series: { label: string; total: number }[] };
type InventoryReport = { tab: "inventory"; skus: number; value: number; lowStock: number; categories: { name: string; amount: number }[] };
type MovementReport = { tab: "movement"; data: StockMove[]; total: number };
type TopReport = { tab: "top"; products: { name: string; sku: string; quantity: number; revenue: number }[] };

export default function ReportsPage() {
  const { t } = useI18n();
  const money = useFormat();
  const [tab, setTab] = useState("sales");
  const [from, setFrom] = useState(() => toDateInput(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(() => toDateInput());
  const [type, setType] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const meta = useApi<Meta>("/api/meta");
  const report = useApi<SalesReport | InventoryReport | MovementReport | TopReport>(
    qs("/api/reports", { tab, from, to, type, warehouseId }),
  );
  const tabs = [
    ["sales", "report.sales"],
    ["inventory", "report.inventory"],
    ["movement", "report.movement"],
    ["top", "report.top"],
  ] as const;

  const exportRows = useMemo(() => {
    const data = report.data;
    if (!data) return [];
    if (data.tab === "sales") return data.series.map((row) => ({ date: row.label, total: row.total }));
    if (data.tab === "inventory") return data.categories.map((row) => ({ category: row.name, value: row.amount }));
    if (data.tab === "top") return data.products;
    return data.data.map((row) => ({
      date: row.createdAt,
      product: row.product?.name,
      sku: row.product?.sku,
      warehouse: row.warehouse?.name,
      type: row.type,
      quantity: row.quantity,
      notes: row.notes,
    }));
  }, [report.data]);

  return (
    <div>
      <PageHeader
        title={t("page.reports")}
        subtitle={t("sub.reports")}
        actions={<Button variant="outline" onClick={() => downloadCsv(`${tab}-report.csv`, exportRows)}>{t("action.export")}</Button>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map(([id, key]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-full px-4 py-2 text-sm ${tab === id ? "bg-ink text-white" : "border border-line bg-white"}`}>{t(key)}</button>
        ))}
      </div>
      {tab !== "inventory" ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-full min-w-0 rounded-xl border border-line bg-white px-3 py-2 text-sm sm:w-auto" />
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="w-full min-w-0 rounded-xl border border-line bg-white px-3 py-2 text-sm sm:w-auto" />
          {tab === "movement" ? (
            <>
              <select value={type} onChange={(event) => setType(event.target.value)} className="w-full min-w-0 rounded-xl border border-line bg-white px-3 py-2 text-sm sm:w-auto">
                <option value="">{t("label.type")}</option>
                {["STOCK_IN", "STOCK_OUT", "ADJUSTMENT", "SALE", "PURCHASE_RECEIVE", "TRANSFER_IN", "TRANSFER_OUT", "SALE_REVERSAL"].map((item) => <option key={item} value={item}>{t(`status.${item}`)}</option>)}
              </select>
              <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="w-full min-w-0 rounded-xl border border-line bg-white px-3 py-2 text-sm sm:w-auto">
                <option value="">{t("label.warehouse")}</option>
                {meta.data?.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
              </select>
            </>
          ) : null}
        </div>
      ) : null}
      <ErrorNote message={report.error} />
      {report.loading || !report.data ? <LoadingBlock /> : report.data.tab === "sales" ? (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            <Stat label={t("report.revenue")} value={money.usd(report.data.revenue)} />
            <Stat label={t("report.orders")} value={String(report.data.orders)} />
            <Stat label={t("report.avg")} value={money.usd(report.data.average)} />
          </div>
          <Card className="p-5"><SalesLine data={report.data.series} /></Card>
        </div>
      ) : report.data.tab === "inventory" ? (
        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="grid gap-4">
            <Stat label={t("report.skus")} value={String(report.data.skus)} />
            <Stat label={t("report.value")} value={money.usd(report.data.value)} />
            <Stat label={t("report.low")} value={String(report.data.lowStock)} />
          </div>
          <Card className="p-5"><ValuePie data={report.data.categories} /></Card>
        </div>
      ) : report.data.tab === "top" ? (
        <Card className="p-5">{report.data.products.length ? <TopBars data={report.data.products} /> : <EmptyState title={t("empty.title")} />}</Card>
      ) : (
        <Card>
          {report.data.data.length === 0 ? <EmptyState title={t("empty.title")} /> : (
            <Table>
              <thead><tr><Th>{t("label.date")}</Th><Th>{t("label.product")}</Th><Th>{t("label.warehouse")}</Th><Th>{t("label.type")}</Th><Th>{t("label.quantity")}</Th><Th>{t("label.notes")}</Th></tr></thead>
              <tbody>
                {report.data.data.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <Td>{money.dateTime(row.createdAt)}</Td>
                    <Td>{row.product?.name}</Td>
                    <Td>{row.warehouse?.name}</Td>
                    <Td><StatusBadge status={row.type} label={t(`status.${row.type}`)} /></Td>
                    <Td className="tabular-nums">{row.quantity}</Td>
                    <Td>{row.notes}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-line bg-card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">{label}</p>
      <p className="mt-2 font-serif text-3xl tabular-nums">{value}</p>
    </div>
  );
}

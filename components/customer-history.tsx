"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, EmptyState, LoadingBlock, Pagination, StatusBadge } from "./ui";
import { qs, useApi } from "@/lib/client";
import { useFormat, useI18n } from "@/lib/settings";

type HistoryOrder = {
  id: string;
  orderNumber: string;
  orderDate: string;
  status: string;
  kind: "SALE" | "CONSIGN";
  total: number;
  warehouse?: { name: string } | null;
  items: { id: string; quantity: number; returnedQty: number; unitPrice: number; product?: { name: string; sku: string } }[];
};

type History = {
  data: HistoryOrder[];
  total: number;
  page: number;
  pageSize: number;
  summary: { orders: number; spent: number; owed: number; openOrders: number; lastVisit: string | null };
};

const filters = ["", "CONSIGN", "UNPAID"] as const;

export function CustomerHistory({ customerId }: { customerId: string }) {
  const { t } = useI18n();
  const money = useFormat();
  const [filter, setFilter] = useState<(typeof filters)[number]>("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const history = useApi<History>(qs(`/api/customers/${customerId}/history`, { filter, page }));
  const summary = history.data?.summary;

  return (
    <>
      {summary ? (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label={t("history.orders")} value={String(summary.orders)} />
          <Tile label={t("history.spent")} value={money.amount(summary.spent)} />
          <Tile label={t("history.owed")} value={money.amount(summary.owed)} hint={summary.openOrders ? `${summary.openOrders} ${t("history.open")}` : undefined} warn={summary.owed > 0} />
          <Tile label={t("history.last")} value={summary.lastVisit ? money.date(summary.lastVisit) : "—"} />
        </div>
      ) : null}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <h2 className="font-serif text-xl sm:text-2xl">{t("history.title")}</h2>
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item || "ALL"}
                type="button"
                onClick={() => { setFilter(item); setPage(1); }}
                className={`rounded-full px-3 py-1.5 text-sm ${filter === item ? "bg-ink text-white" : "border border-line bg-white"}`}
              >
                {t(`history.filter.${item || "ALL"}`)}
              </button>
            ))}
          </div>
        </div>
        {history.loading ? <LoadingBlock /> : !history.data?.data.length ? <EmptyState title={t("empty.title")} /> : (
          <ul className="mt-3">
            {history.data.data.map((order) => {
              const open = openId === order.id;
              const consign = order.kind === "CONSIGN";
              const unpaid = consign && ["CONFIRMED", "PROCESSING"].includes(order.status);
              return (
                <li key={order.id} className="border-t border-line">
                  <button type="button" onClick={() => setOpenId(open ? null : order.id)} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[#fbf8f2] sm:px-5">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {money.date(order.orderDate)} · {order.orderNumber}
                      </p>
                      <p className="text-xs text-ink-soft">
                        {consign ? t("kind.CONSIGN") : t("kind.SALE")} · {order.items.length} {t("history.products")}{order.warehouse ? ` · ${order.warehouse.name}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {unpaid ? <span className="rounded-full bg-[#fbf3d8] px-2.5 py-1 text-[11px] font-semibold text-[#8a5a10]">{t("history.unpaid")}</span> : <StatusBadge status={order.status} label={t(`status.${order.status}`)} />}
                      <span className="font-medium tabular-nums">{money.amount(order.total)}</span>
                      <span className="text-ink-soft">{open ? "▴" : "▾"}</span>
                    </div>
                  </button>
                  {open ? (
                    <div className="bg-[#fbf8f2] px-4 pb-4 sm:px-5">
                      <ul className="grid gap-2 pt-2 sm:hidden">
                        {order.items.map((item) => {
                          const sold = item.quantity - item.returnedQty;
                          return (
                            <li key={item.id} className="text-sm">
                              <div className="flex justify-between gap-3">
                                <span>{item.product?.name}</span>
                                <span className="shrink-0 tabular-nums">{money.amount(sold * item.unitPrice)}</span>
                              </div>
                              <p className="text-xs text-ink-soft tabular-nums">
                                {consign ? `${t("label.taken")} ${item.quantity} · ${t("label.returned")} ${item.returnedQty} · ` : ""}
                                {t("label.sold")} {sold} × {money.amount(item.unitPrice)}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="hidden overflow-x-auto sm:block">
                        <table className="w-full min-w-[30rem] text-sm">
                          <thead>
                            <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-ink-soft">
                              <th className="py-2 pr-3">{t("label.product")}</th>
                              {consign ? <><th className="pr-3">{t("label.taken")}</th><th className="pr-3">{t("label.returned")}</th><th className="pr-3">{t("label.sold")}</th></> : <th className="pr-3">{t("label.quantity")}</th>}
                              <th className="pr-3">{t("label.price")}</th>
                              <th className="text-right">{t("label.total")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map((item) => {
                              const sold = item.quantity - item.returnedQty;
                              return (
                                <tr key={item.id} className="border-t border-line">
                                  <td className="py-2 pr-3">{item.product?.name}</td>
                                  {consign ? <><td className="pr-3">{item.quantity}</td><td className="pr-3">{item.returnedQty}</td><td className="pr-3 font-medium">{sold}</td></> : <td className="pr-3">{item.quantity}</td>}
                                  <td className="pr-3 tabular-nums">{money.amount(item.unitPrice)}</td>
                                  <td className="text-right tabular-nums">{money.amount(sold * item.unitPrice)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-sm">
                        <Link href={`/sales-orders/${order.id}`} className="text-forest">{t("history.openOrder")} →</Link>
                        {order.status !== "CANCELLED" ? <Link href={`/sales-orders/${order.id}?print=1`} className="text-forest">🖨 {t("action.print")}</Link> : null}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <Pagination page={page} pageSize={history.data?.pageSize || 10} total={history.data?.total || 0} onPage={setPage} />
      </Card>
    </>
  );
}

function Tile({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft sm:text-[11px]">{label}</p>
      <p className={`mt-2 break-all font-serif text-xl tabular-nums sm:text-2xl ${warn ? "text-copper" : ""}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-soft">{hint}</p> : null}
    </Card>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useCustomerPrices } from "@/components/customer-prices";
import { KhmerInvoice, toInvoice } from "@/components/invoice";
import { blankLine, LineEditor, type DraftLine } from "@/components/lines";
import { useOpenInvoice } from "@/components/open-invoice";
import { nowLocal, OrderActivity, useWhen, WhenField, whenToIso } from "@/components/order-activity";
import { useAuth, useToast } from "@/components/providers";
import { QuickCustomerButton } from "@/components/quick-customer";
import { ReturnsModal } from "@/components/returns-modal";
import { Button, Card, cx, EmptyState, LoadingBlock, Modal, PageHeader, SearchBar } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import { salesTotals } from "@/lib/format";
import { useFormat, useI18n } from "@/lib/settings";
import type { Meta, PageResult, Party, SalesOrder } from "@/lib/types";

/** Tap a customer: their open invoice appears, and products are added right here. */
export default function InvoicesPage() {
  // The selected customer lives in the URL (?customer=…), which needs a Suspense boundary.
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Invoices />
    </Suspense>
  );
}

function Invoices() {
  const { t } = useI18n();
  const money = useFormat();
  const router = useRouter();
  const selected = useSearchParams().get("customer") || "";
  const [search, setSearch] = useState("");
  const customers = useApi<PageResult<Party>>("/api/customers?status=ACTIVE&pageSize=100");

  const list = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = customers.data?.data || [];
    const shown = needle ? rows.filter((row) => `${row.name} ${row.phone || ""}`.toLowerCase().includes(needle)) : rows;
    // Customers who owe money first, then by name.
    return [...shown].sort((a, b) => (b.openInvoice?.total || 0) - (a.openInvoice?.total || 0) || a.name.localeCompare(b.name));
  }, [customers.data, search]);
  const current = customers.data?.data.find((row) => row.id === selected);
  const pick = (id: string) => router.replace(`/invoices?customer=${id}`, { scroll: false });

  return (
    <div>
      <PageHeader title={t("inv.title")} subtitle={t("inv.sub")} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="h-fit">
          <div className="grid gap-2 p-3">
            <SearchBar value={search} onChange={setSearch} placeholder={t("inv.searchCustomer")} />
            <QuickCustomerButton onCreated={(id) => { customers.reload(); pick(id); }} />
          </div>
          {customers.loading && !customers.data ? <LoadingBlock /> : (
            <ul className="max-h-[22rem] overflow-y-auto border-t border-line lg:max-h-[70vh]">
              {list.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => pick(row.id)}
                    className={cx(
                      "flex w-full items-center justify-between gap-3 border-b border-line px-4 py-3 text-left",
                      row.id === selected ? "bg-ink text-white" : "hover:bg-[#fbf8f2]",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{row.name}</span>
                      {row.phone ? <span className={cx("block text-xs", row.id === selected ? "text-white/70" : "text-ink-soft")}>{row.phone}</span> : null}
                    </span>
                    <span className={cx("shrink-0 text-sm tabular-nums", row.openInvoice ? (row.id === selected ? "font-semibold" : "font-semibold text-copper") : "opacity-50")}>
                      {row.openInvoice ? money.amount(row.openInvoice.total) : "—"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {current ? (
          <CustomerInvoice key={current.id} customer={current} onChanged={customers.reload} />
        ) : (
          <Card><EmptyState title={t("inv.pick")} body={t("inv.pickHint")} /></Card>
        )}
      </div>
    </div>
  );
}

function CustomerInvoice({ customer, onChanged }: { customer: Party; onChanged: () => void }) {
  const { t } = useI18n();
  const money = useFormat();
  const toast = useToast();
  const { user } = useAuth();
  const meta = useApi<Meta>("/api/meta");
  const { invoice: open, reload: reloadOpen } = useOpenInvoice(customer.id);
  const order = useApi<SalesOrder>(open ? `/api/sales-orders/${open.id}` : null);
  const invoice = open && order.data?.id === open.id ? order.data : null;
  const { priceFor } = useCustomerPrices(customer.id);
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [busy, setBusy] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [returnsOpen, setReturnsOpen] = useState(false);
  const [paidOpen, setPaidOpen] = useState(false);
  const [when, setWhen] = useWhen();
  const [version, setVersion] = useState(0);
  const top = useRef<HTMLDivElement>(null);

  // On a phone the invoice sits below the name list: bring it into view after a tap.
  useEffect(() => {
    if (window.innerWidth < 1024) top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const filled = lines.filter((line) => line.productId);
  const adding = salesTotals(filled.map((line) => ({ quantity: Number(line.quantity) || 0, unitPrice: Number(line.price) || 0 })), 0, 0).total;
  const warehouseId = open?.warehouseId || user?.warehouseId || meta.data?.warehouses[0]?.id || "";

  // Refresh this invoice, the open-invoice lookup (via cache) and the totals in the name list.
  function refresh() {
    order.reload();
    onChanged();
    setVersion((n) => n + 1);
  }

  async function addProducts() {
    setBusy(true);
    try {
      await api("/api/sales-orders", {
        method: "POST",
        body: JSON.stringify({
          kind: "CONSIGN",
          status: "CONFIRMED",
          customerId: customer.id,
          warehouseId,
          at: whenToIso(when),
          items: filled.map((line) => ({ productId: line.productId, quantity: Number(line.quantity), unitPrice: Number(line.price) })),
        }),
      });
      toast(t("open.added"));
      setLines([blankLine()]);
      setWhen(nowLocal());
      // A first add creates the invoice, so look it up again as well.
      reloadOpen();
      refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save", "bad");
    } finally {
      setBusy(false);
    }
  }

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!invoice) return false;
    setBusy(true);
    try {
      await api(`/api/sales-orders/${invoice.id}`, { method: "PATCH", body: JSON.stringify({ action, ...extra }) });
      toast(t("common.saved"));
      refresh();
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not update", "bad");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const taken = invoice?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const returned = invoice?.items.reduce((sum, item) => sum + item.returnedQty, 0) ?? 0;

  return (
    <div ref={top} className="min-w-0 scroll-mt-20">
    <Card>
      {/* Header: who, and what they owe */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-4 sm:p-5">
        <div>
          <h2 className="font-serif text-2xl">{customer.name}</h2>
          <p className="text-sm text-ink-soft">
            {invoice ? `${t("open.invoice")} · ${invoice.orderNumber} · ${t("open.since")} ${money.date(invoice.orderDate)}` : t("open.none")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">{t("label.amountDue")}</p>
          <p className="font-serif text-3xl tabular-nums text-copper">{money.amount(invoice?.total || 0)}</p>
        </div>
      </div>

      {/* Lines already on the invoice */}
      {open && !invoice ? <LoadingBlock /> : invoice && invoice.items.length ? (
        <>
        {/* Phones: one compact row per line instead of a 7-column table. */}
        <ul className="sm:hidden">
          {invoice.items.map((item) => {
            const sold = item.quantity - item.returnedQty;
            return (
              <li key={item.id} className="border-b border-line px-4 py-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{item.product?.name}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{money.amount(sold * item.unitPrice)}</span>
                </div>
                <p className="mt-0.5 text-xs text-ink-soft">{money.dateTime(item.createdAt || invoice.orderDate)}</p>
                <p className="mt-1 text-xs tabular-nums">
                  {t("label.taken")} {item.quantity} · {t("label.returned")} {item.returnedQty} · <b>{t("label.sold")} {sold}</b> × {money.amount(item.unitPrice)}
                </p>
              </li>
            );
          })}
          <li className="flex justify-between px-4 py-3 text-sm font-semibold">
            <span>{t("label.total")} · {t("label.sold")} {taken - returned}</span>
            <span className="tabular-nums">{money.amount(invoice.total)}</span>
          </li>
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2 sm:px-5">{t("label.dateTaken")}</th>
                <th className="py-2 pr-3">{t("label.product")}</th>
                <th className="py-2 pr-3 text-right">{t("label.taken")}</th>
                <th className="py-2 pr-3 text-right">{t("label.returned")}</th>
                <th className="py-2 pr-3 text-right">{t("label.sold")}</th>
                <th className="py-2 pr-3 text-right">{t("label.price")}</th>
                <th className="px-4 py-2 text-right sm:px-5">{t("label.total")}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="whitespace-nowrap px-4 py-2 text-ink-soft sm:px-5">{money.dateTime(item.createdAt || invoice.orderDate)}</td>
                  <td className="py-2 pr-3">{item.product?.name}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{item.returnedQty}</td>
                  <td className="py-2 pr-3 text-right font-semibold tabular-nums">{item.quantity - item.returnedQty}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{money.amount(item.unitPrice)}</td>
                  <td className="px-4 py-2 text-right tabular-nums sm:px-5">{money.amount((item.quantity - item.returnedQty) * item.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink font-semibold">
                <td className="px-4 py-2 sm:px-5" colSpan={2}>{t("label.total")}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{taken}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{returned}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{taken - returned}</td>
                <td />
                <td className="px-4 py-2 text-right tabular-nums sm:px-5">{money.amount(invoice.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        </>
      ) : (
        <p className="px-4 py-6 text-sm text-ink-soft sm:px-5">{t("inv.empty")}</p>
      )}

      {/* Add products right here, at this customer's prices */}
      <div className="border-t border-line bg-[#fbf8f2] p-4 sm:p-5">
        <p className="mb-3 font-medium">+ {t("action.addProducts")}</p>
        <LineEditor lines={lines} onChange={setLines} products={meta.data?.products || []} showPrice priceLabel={t("label.price")} priceOf={priceFor} />
        <div className="mt-3 max-w-xs"><WhenField value={when} onChange={setWhen} /></div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-soft">{filled.length ? `+ ${money.amount(adding)}` : ""}</p>
          <Button disabled={busy || filled.length === 0} onClick={addProducts}>{t("open.addTo")}</Button>
        </div>
      </div>

      {invoice ? <OrderActivity orderId={invoice.id} version={version} /> : null}

      {/* Settle */}
      {invoice ? (
        <div className="flex flex-wrap gap-2 border-t border-line p-4 sm:p-5">
          <Button variant="outline" disabled={busy} onClick={() => setReturnsOpen(true)}>{t("action.recordReturns")}</Button>
          <Button variant="outline" onClick={() => setPrintOpen(true)}>🖨 {t("action.print")}</Button>
          <Button disabled={busy} onClick={() => setPaidOpen(true)}>{t("action.markPaid")}</Button>
          <Link href={`/sales-orders/${invoice.id}`} className="ml-auto self-center text-sm text-forest">{t("inv.full")} →</Link>
        </div>
      ) : null}

      {invoice ? (
        <>
          <Modal open={printOpen} title={t("action.print")} onClose={() => setPrintOpen(false)} wide>
            <KhmerInvoice order={toInvoice(invoice, t("label.walkIn"))} />
          </Modal>
          {returnsOpen ? (
            <ReturnsModal order={invoice} busy={busy} onClose={() => setReturnsOpen(false)} onSave={async (returns, at) => { if (await act("RETURN", { returns, at })) setReturnsOpen(false); }} />
          ) : null}
          <Modal open={paidOpen} title={t("action.markPaid")} onClose={() => setPaidOpen(false)}>
            <p className="text-sm">{t("inv.paidConfirm")}</p>
            <p className="mt-2 font-serif text-3xl tabular-nums">{money.amount(invoice.total)}</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPaidOpen(false)}>{t("action.close")}</Button>
              <Button disabled={busy} onClick={async () => { if (await act("COMPLETE")) { setPaidOpen(false); reloadOpen(); } }}>{t("action.markPaid")}</Button>
            </div>
          </Modal>
        </>
      ) : null}
    </Card>
    </div>
  );
}

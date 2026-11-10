"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useCustomerPrices } from "@/components/customer-prices";
import { KhmerInvoice, toInvoice } from "@/components/invoice";
import { OrderActivity, useWhen, WhenField, whenToIso } from "@/components/order-activity";
import { ReturnsModal } from "@/components/returns-modal";
import { MoneyInput } from "@/components/money-input";
import { blankLine, LineEditor, type DraftLine } from "@/components/lines";
import { useToast } from "@/components/providers";
import { Button, Card, ErrorNote, Field, LoadingBlock, Modal, PageHeader, StatusBadge, Table, Td, Th } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import { salesTotals } from "@/lib/format";
import { useFormat, useI18n } from "@/lib/settings";
import type { Meta, SalesOrder } from "@/lib/types";

export default function SalesOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { t } = useI18n();
  const money = useFormat();
  const toast = useToast();
  const order = useApi<SalesOrder>(`/api/sales-orders/${params.id}`);
  const [busy, setBusy] = useState(false);
  // ?print=1 (e.g. from a customer's history) opens the invoice straight away.
  const [printOpen, setPrintOpen] = useState(useSearchParams().get("print") === "1");
  const [addOpen, setAddOpen] = useState(useSearchParams().get("add") === "1");
  const [returnOpen, setReturnOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  // Bumped after every change so the day-and-hour log reloads too.
  const [version, setVersion] = useState(0);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      await api(`/api/sales-orders/${params.id}`, { method: "PATCH", body: JSON.stringify({ action, ...extra }) });
      toast(t("common.saved"));
      order.reload();
      setVersion((n) => n + 1);
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not update", "bad");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const data = order.data;
  const consign = data?.kind === "CONSIGN";
  const open = data ? ["CONFIRMED", "PROCESSING"].includes(data.status) : false;
  const sold = (item: SalesOrder["items"][number]) => item.quantity - item.returnedQty;
  const taken = data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const returned = data?.items.reduce((sum, item) => sum + item.returnedQty, 0) ?? 0;

  return (
    <div>
      <Link href="/sales-orders" className="text-sm text-forest">{t("action.back")}</Link>
      <ErrorNote message={order.error} />
      {!data ? <LoadingBlock /> : (
        <>
          <PageHeader
            title={data.orderNumber}
            subtitle={`${consign ? `${t("kind.CONSIGN")} · ` : ""}${data.customer?.name || t("label.walkIn")} · ${data.warehouse?.name || ""}`}
            actions={<StatusBadge status={data.status} label={t(`status.${data.status}`)} />}
          />
          {consign && open ? <p className="mb-4 rounded-2xl border border-line bg-[#fbf3e2] px-4 py-3 text-sm">{t("note.unpaid")}</p> : null}
          {consign ? (
            <Card className="mb-4 grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
              <Stat label={t("label.taken")} value={String(taken)} />
              <Stat label={t("label.returned")} value={String(returned)} />
              <Stat label={t("label.sold")} value={String(taken - returned)} />
              <Stat label={t("label.amountDue")} value={money.amount(data.total)} strong />
            </Card>
          ) : null}
          <Card className="mb-4 grid gap-2 p-5 text-sm md:grid-cols-4">
            <p>{t("label.date")}: {money.date(data.orderDate)}</p>
            <p>{t("label.delivery")}: {money.date(data.deliveryDate)}</p>
            <p>{t("label.discount")}: {money.amount(data.discount)}</p>
            <p>{t("label.total")}: {money.amount(data.total)}</p>
          </Card>
          <Card>
            <Table>
              <thead>
                <tr>
                  {consign ? <Th>{t("label.dateTaken")}</Th> : null}
                  <Th>{t("label.product")}</Th>
                  {consign ? <><Th>{t("label.taken")}</Th><Th>{t("label.returned")}</Th><Th>{t("label.sold")}</Th></> : <Th>{t("label.quantity")}</Th>}
                  <Th>{t("label.price")}</Th>
                  <Th>{t("label.total")}</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="border-t border-line">
                    {consign ? <Td className="whitespace-nowrap text-ink-soft">{money.dateTime(item.createdAt || data.orderDate)}</Td> : null}
                    <Td>{item.product?.name}<div className="text-xs text-ink-soft">{item.product?.sku}</div></Td>
                    {consign ? <><Td>{item.quantity}</Td><Td>{item.returnedQty}</Td><Td className="font-medium">{sold(item)}</Td></> : <Td>{item.quantity}</Td>}
                    <Td className="tabular-nums">{money.amount(item.unitPrice)}</Td>
                    <Td className="tabular-nums">{money.amount(sold(item) * item.unitPrice)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {consign ? <OrderActivity orderId={data.id} version={version} /> : null}
          </Card>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.status === "DRAFT" ? <Button disabled={busy} onClick={() => act("CONFIRM")}>{t("action.confirm")}</Button> : null}
            {consign && open ? (
              <>
                <Button variant="outline" disabled={busy} onClick={() => setAddOpen(true)}>{t("action.addProducts")}</Button>
                <Button variant="outline" disabled={busy} onClick={() => setReturnOpen(true)}>{t("action.recordReturns")}</Button>
                <Button disabled={busy} onClick={() => act("COMPLETE")}>{t("action.markPaid")}</Button>
              </>
            ) : (
              <>
                {data.status === "CONFIRMED" ? <Button disabled={busy} onClick={() => act("PROCESS")}>{t("action.process")}</Button> : null}
                {open ? <Button disabled={busy} onClick={() => act("COMPLETE")}>{t("action.complete")}</Button> : null}
              </>
            )}
            {["DRAFT", "CONFIRMED", "PROCESSING"].includes(data.status) ? <Button variant="danger" disabled={busy} onClick={() => act("CANCEL")}>{t("action.cancel")}</Button> : null}
            {data.status !== "CANCELLED" ? <Button variant="outline" disabled={busy} onClick={() => setEditOpen(true)}>✎ {t("action.edit")}</Button> : null}
            {data.status !== "CANCELLED" ? <Button variant="outline" onClick={() => setPrintOpen(true)}>{t("action.print")}</Button> : null}
          </div>
          <Modal open={printOpen} title={t("action.print")} onClose={() => setPrintOpen(false)} wide>
            <KhmerInvoice order={toInvoice(data, t("label.walkIn"))} />
          </Modal>
          {addOpen ? <AddProductsModal customerId={data.customerId} busy={busy} onClose={() => setAddOpen(false)} onSave={async (items, at) => { if (await act("ADD_ITEMS", { items, at })) setAddOpen(false); }} /> : null}
          {editOpen ? <EditItemsModal order={data} busy={busy} onClose={() => setEditOpen(false)} onSave={async (body) => { if (await act("EDIT_ITEMS", body)) setEditOpen(false); }} /> : null}
          {returnOpen ? <ReturnsModal order={data} busy={busy} onClose={() => setReturnOpen(false)} onSave={async (returns, at) => { if (await act("RETURN", { returns, at })) setReturnOpen(false); }} /> : null}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs text-ink-soft">{label}</p>
      <p className={strong ? "font-serif text-2xl tabular-nums text-forest" : "text-xl tabular-nums"}>{value}</p>
    </div>
  );
}

function AddProductsModal({ customerId, busy, onClose, onSave }: { customerId?: string | null; busy: boolean; onClose: () => void; onSave: (items: unknown[], at?: string) => void }) {
  const { t } = useI18n();
  const meta = useApi<Meta>("/api/meta");
  const { priceFor } = useCustomerPrices(customerId);
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [when, setWhen] = useWhen();
  const items = lines.filter((line) => line.productId).map((line) => ({ productId: line.productId, quantity: Number(line.quantity), unitPrice: Number(line.price) }));
  return (
    <Modal open title={t("action.addProducts")} onClose={onClose} wide>
      <LineEditor
        lines={lines}
        onChange={setLines}
        products={meta.data?.products || []}
        showPrice
        priceLabel={t("label.price")}
        priceOf={priceFor}
      />
      <div className="mt-4 max-w-xs"><WhenField value={when} onChange={setWhen} /></div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>{t("action.close")}</Button>
        <Button disabled={busy || items.length === 0} onClick={() => onSave(items, whenToIso(when))}>{t("action.save")}</Button>
      </div>
    </Modal>
  );
}

function EditItemsModal({ order, busy, onClose, onSave }: { order: SalesOrder; busy: boolean; onClose: () => void; onSave: (body: Record<string, unknown>) => void }) {
  const { t } = useI18n();
  const money = useFormat();
  const meta = useApi<Meta>("/api/meta");
  const { priceFor } = useCustomerPrices(order.customerId);
  // Line keys are the existing line ids, so returns already recorded stay with their line.
  const [lines, setLines] = useState<DraftLine[]>(() =>
    order.items.map((item) => ({ key: item.id, productId: item.productId, quantity: String(item.quantity), price: String(item.unitPrice) })),
  );
  const [discount, setDiscount] = useState(String(order.discount));
  const filled = lines.filter((line) => line.productId);
  const totals = salesTotals(
    filled.map((line) => {
      const returned = order.items.find((item) => item.id === line.key && item.productId === line.productId)?.returnedQty || 0;
      return { quantity: Math.max(0, (Number(line.quantity) || 0) - returned), unitPrice: Number(line.price) || 0 };
    }),
    Number(discount) || 0,
    order.taxPct,
  );
  return (
    <Modal open title={`${t("action.edit")} · ${order.orderNumber}`} onClose={onClose} wide>
      {["CONFIRMED", "PROCESSING", "COMPLETED"].includes(order.status) ? <p className="mb-4 rounded-2xl bg-[#fbf3e2] px-4 py-3 text-sm">{t("edit.stockHint")}</p> : null}
      <LineEditor lines={lines} onChange={setLines} products={meta.data?.products || []} showPrice priceLabel={t("label.price")} priceOf={priceFor} />
      <div className="mt-4 max-w-xs">
        <Field label={t("label.discount")}><MoneyInput value={discount} onChange={setDiscount} /></Field>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-ink-soft">{t("label.total")}</p>
          <p className="font-serif text-3xl tabular-nums">{money.amount(totals.total)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>{t("action.close")}</Button>
          <Button
            disabled={busy || filled.length === 0}
            onClick={() => onSave({
              discount: Number(discount) || 0,
              items: filled.map((line) => ({ id: line.key, productId: line.productId, quantity: Number(line.quantity), unitPrice: Number(line.price) })),
            })}
          >
            {t("action.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

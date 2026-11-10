"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/providers";
import { Button, Card, ErrorNote, LoadingBlock, PageHeader, StatusBadge, Table, Td, TextInput, Th } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import { useFormat, useI18n } from "@/lib/settings";
import type { PurchaseOrder } from "@/lib/types";

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { t } = useI18n();
  const money = useFormat();
  const toast = useToast();
  const order = useApi<PurchaseOrder>(`/api/purchase-orders/${params.id}`);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function act(action: string, lines?: { id: string; quantity: number }[]) {
    setBusy(true);
    try {
      await api(`/api/purchase-orders/${params.id}`, { method: "PATCH", body: JSON.stringify({ action, lines }) });
      toast(t("common.saved"));
      order.reload();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not update", "bad");
    } finally {
      setBusy(false);
    }
  }

  const data = order.data;
  const canReceive = data && ["APPROVED", "PARTIALLY_RECEIVED"].includes(data.status);

  return (
    <div>
      <Link href="/purchase-orders" className="text-sm text-forest">{t("action.back")}</Link>
      <ErrorNote message={order.error} />
      {!data ? <LoadingBlock /> : (
        <>
          <PageHeader
            title={data.orderNumber}
            subtitle={`${data.supplier?.name || ""} · ${data.warehouse?.name || ""}`}
            actions={<StatusBadge status={data.status} label={t(`status.${data.status}`)} />}
          />
          <Card className="mb-4 grid gap-2 p-5 text-sm md:grid-cols-3">
            <p>{t("label.date")}: {money.date(data.orderDate)}</p>
            <p>{t("label.expected")}: {money.date(data.expectedDelivery)}</p>
            <p>{t("label.total")}: {money.amount(data.total)}</p>
            {data.notes ? <p className="md:col-span-3">{data.notes}</p> : null}
          </Card>
          <Card>
            <Table>
              <thead><tr><Th>{t("label.product")}</Th><Th>{t("label.quantity")}</Th><Th>{t("label.cost")}</Th><Th>{t("label.received")}</Th>{canReceive ? <Th>{t("action.receive")}</Th> : null}</tr></thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="border-t border-line">
                    <Td>{item.product?.name}<div className="text-xs text-ink-soft">{item.product?.sku}</div></Td>
                    <Td className="tabular-nums">{item.quantity}</Td>
                    <Td className="tabular-nums">{money.amount(item.unitCost)}</Td>
                    <Td className="tabular-nums">{item.receivedQty}</Td>
                    {canReceive ? (
                      <Td>
                        <TextInput
                          type="number"
                          min="0"
                          className="max-w-28"
                          value={qty[item.id] ?? String(Math.max(0, item.quantity - item.receivedQty))}
                          onChange={(event) => setQty((current) => ({ ...current, [item.id]: event.target.value }))}
                        />
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.status === "DRAFT" ? <Button disabled={busy} onClick={() => act("SUBMIT")}>{t("action.submit")}</Button> : null}
            {data.status === "SUBMITTED" ? <Button disabled={busy} onClick={() => act("APPROVE")}>{t("action.approve")}</Button> : null}
            {canReceive ? (
              <Button disabled={busy} onClick={() => act("RECEIVE", data.items.map((item) => ({ id: item.id, quantity: Number(qty[item.id] ?? Math.max(0, item.quantity - item.receivedQty)) })))}>
                {t("action.receive")}
              </Button>
            ) : null}
            {["DRAFT", "SUBMITTED", "APPROVED"].includes(data.status) ? <Button variant="danger" disabled={busy} onClick={() => act("CANCEL")}>{t("action.cancel")}</Button> : null}
          </div>
        </>
      )}
    </div>
  );
}

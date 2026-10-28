"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { blankLine, LineEditor, type DraftLine } from "@/components/lines";
import { useAuth, useToast } from "@/components/providers";
import { Button, Card, Field, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import { salesTotals, sellingUnit, toDateInput } from "@/lib/format";
import { useFormat, useI18n } from "@/lib/settings";
import type { Meta } from "@/lib/types";

export default function NewSalesOrderPage() {
  const { t } = useI18n();
  const money = useFormat();
  const toast = useToast();
  const router = useRouter();
  const { user } = useAuth();
  const meta = useApi<Meta>("/api/meta");
  const [customerId, setCustomerId] = useState("");
  const [pickedWarehouseId, setWarehouseId] = useState("");
  const [delivery, setDelivery] = useState(toDateInput());
  const [discount, setDiscount] = useState("0");
  const [taxPct, setTaxPct] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [busy, setBusy] = useState(false);

  // Until the user picks one, sell from their own warehouse (or the first one).
  const warehouseId = pickedWarehouseId || user?.warehouseId || meta.data?.warehouses[0]?.id || "";

  const totals = salesTotals(
    lines.filter((line) => line.productId).map((line) => ({ quantity: Number(line.quantity) || 0, unitPrice: Number(line.price) || 0 })),
    Number(discount) || 0,
    Number(taxPct) || 0,
  );

  async function save(status: "DRAFT" | "CONFIRMED") {
    setBusy(true);
    try {
      const order = await api<{ id: string }>("/api/sales-orders", {
        method: "POST",
        body: JSON.stringify({
          customerId: customerId || null,
          warehouseId,
          deliveryDate: delivery,
          discount: Number(discount) || 0,
          taxPct: Number(taxPct) || 0,
          notes,
          status,
          items: lines.filter((line) => line.productId).map((line) => ({ productId: line.productId, quantity: Number(line.quantity), unitPrice: Number(line.price) })),
        }),
      });
      router.push(`/sales-orders/${order.id}`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title={t("page.newSale")} subtitle={t("sub.sales")} />
      <Card className="grid gap-5 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t("label.customer")}>
            <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">{t("label.walkIn")}</option>
              {meta.data?.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </Select>
          </Field>
          <Field label={t("label.warehouse")}>
            <Select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
              {meta.data?.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </Select>
          </Field>
          <Field label={t("label.delivery")}><TextInput type="date" value={delivery} onChange={(event) => setDelivery(event.target.value)} /></Field>
        </div>
        <LineEditor
          lines={lines}
          onChange={setLines}
          products={meta.data?.products || []}
          showPrice
          priceLabel={t("label.price")}
          priceOf={(product) => sellingUnit(product.sellingPrice, product.discountPct)}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("label.discount")}><TextInput type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} /></Field>
          <Field label={t("label.tax")}><TextInput type="number" min="0" step="0.1" value={taxPct} onChange={(event) => setTaxPct(event.target.value)} /></Field>
        </div>
        <Field label={t("label.notes")}><TextArea value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-ink-soft">{t("label.subtotal")} {money.usd(totals.subtotal)}</p>
            <p className="font-serif text-3xl tabular-nums">{money.usd(totals.total)}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={busy} onClick={() => save("DRAFT")}>{t("action.saveDraft")}</Button>
            <Button disabled={busy} onClick={() => save("CONFIRMED")}>{t("action.confirm")}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

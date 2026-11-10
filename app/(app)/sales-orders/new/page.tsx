"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useCustomerPrices } from "@/components/customer-prices";
import { useOpenInvoice } from "@/components/open-invoice";
import { QuickCustomerButton } from "@/components/quick-customer";
import { blankLine, LineEditor, type DraftLine } from "@/components/lines";
import { MoneyInput } from "@/components/money-input";
import { useAuth, useToast } from "@/components/providers";
import { Button, Card, Field, LoadingBlock, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import { salesTotals, toDateInput } from "@/lib/format";
import { useFormat, useI18n } from "@/lib/settings";
import type { Meta } from "@/lib/types";

export default function NewSalesOrderPage() {
  // ?customer=…&kind=CONSIGN (from a customer's page) pre-fills the form; reading the URL needs Suspense.
  return (
    <Suspense fallback={<LoadingBlock />}>
      <NewSalesOrder />
    </Suspense>
  );
}

function NewSalesOrder() {
  const { t } = useI18n();
  const params = useSearchParams();
  const money = useFormat();
  const toast = useToast();
  const router = useRouter();
  const { user } = useAuth();
  const meta = useApi<Meta>("/api/meta");
  const [customerId, setCustomerId] = useState(params.get("customer") || "");
  const [kind, setKind] = useState<"SALE" | "CONSIGN">(params.get("kind") === "CONSIGN" ? "CONSIGN" : "SALE");
  const [pickedWarehouseId, setWarehouseId] = useState("");
  const [delivery, setDelivery] = useState(toDateInput());
  const [discount, setDiscount] = useState("0");
  const [taxPct, setTaxPct] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [busy, setBusy] = useState(false);
  const [rememberPrices, setRememberPrices] = useState(true);
  const { prices, priceFor } = useCustomerPrices(customerId);
  // Take & return goes onto the customer's one open invoice when they already have one.
  const { invoice: openInvoice } = useOpenInvoice(kind === "CONSIGN" ? customerId : null);

  // When the customer (and so their price list) changes, re-price lines already added.
  const [pricedWith, setPricedWith] = useState(prices);
  if (pricedWith !== prices) {
    setPricedWith(prices);
    const products = meta.data?.products || [];
    setLines(lines.map((line) => {
      const product = products.find((item) => item.id === line.productId);
      return product ? { ...line, price: String(priceFor(product)) } : line;
    }));
  }

  // Until the user picks one, sell from their own warehouse (or the first one).
  const warehouseId = openInvoice?.warehouseId || pickedWarehouseId || user?.warehouseId || meta.data?.warehouses[0]?.id || "";

  const totals = salesTotals(
    lines.filter((line) => line.productId).map((line) => ({ quantity: Number(line.quantity) || 0, unitPrice: Number(line.price) || 0 })),
    Number(discount) || 0,
    Number(taxPct) || 0,
  );

  async function save(status: "DRAFT" | "CONFIRMED") {
    setBusy(true);
    try {
      const order = await api<{ id: string; appended?: boolean }>("/api/sales-orders", {
        method: "POST",
        body: JSON.stringify({
          customerId: customerId || null,
          kind,
          warehouseId,
          deliveryDate: delivery,
          discount: Number(discount) || 0,
          taxPct: Number(taxPct) || 0,
          notes,
          status,
          items: lines.filter((line) => line.productId).map((line) => ({ productId: line.productId, quantity: Number(line.quantity), unitPrice: Number(line.price) })),
        }),
      });
      // Remember prices typed on this order as the customer's own prices.
      if (customerId && rememberPrices) {
        const products = meta.data?.products || [];
        const changed = lines.filter((line) => {
          const product = products.find((item) => item.id === line.productId);
          return product && line.price !== "" && Math.abs(Number(line.price) - priceFor(product)) > 1e-6;
        });
        await Promise.all(changed.map((line) => api(`/api/customers/${customerId}/prices`, {
          method: "PUT",
          body: JSON.stringify({ productId: line.productId, price: Number(line.price) }),
        })));
      }
      if (order.appended) toast(t("open.added"));
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
        <Field label={t("label.orderType")} hint={kind === "CONSIGN" ? t("hint.consign") : undefined}>
          <Select value={kind} onChange={(event) => setKind(event.target.value as "SALE" | "CONSIGN")}>
            <option value="SALE">{t("kind.SALE")}</option>
            <option value="CONSIGN">{t("kind.CONSIGN")}</option>
          </Select>
        </Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t("label.customer")}>
            <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">{t("label.walkIn")}</option>
              {meta.data?.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </Select>
            <QuickCustomerButton onCreated={(id) => { meta.reload(); setCustomerId(id); }} />
          </Field>
          <Field label={t("label.warehouse")}>
            <Select value={warehouseId} disabled={Boolean(openInvoice)} onChange={(event) => setWarehouseId(event.target.value)}>
              {meta.data?.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </Select>
          </Field>
          <Field label={t("label.delivery")}><TextInput type="date" value={delivery} onChange={(event) => setDelivery(event.target.value)} /></Field>
        </div>
        {openInvoice ? (
          <p className="rounded-2xl border border-[#e8c98f] bg-[#fdf6e7] px-4 py-3 text-sm">
            {t("open.willAdd")} <b>{openInvoice.orderNumber}</b> · {t("open.invoice")} <b className="tabular-nums">{money.amount(openInvoice.total)}</b>
          </p>
        ) : null}
        <LineEditor
          lines={lines}
          onChange={setLines}
          products={meta.data?.products || []}
          showPrice
          priceLabel={t("label.price")}
          priceOf={priceFor}
        />
        {customerId ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[#1F7A4D]" checked={rememberPrices} onChange={(event) => setRememberPrices(event.target.checked)} />
            {t("prices.remember")}
          </label>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("label.discount")}><MoneyInput value={discount} onChange={setDiscount} /></Field>
          <Field label={t("label.tax")}><TextInput type="number" min="0" step="0.1" value={taxPct} onChange={(event) => setTaxPct(event.target.value)} /></Field>
        </div>
        <Field label={t("label.notes")}><TextArea value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-ink-soft">{t("label.subtotal")} {money.amount(totals.subtotal)}</p>
            <p className="font-serif text-3xl tabular-nums">{money.amount(totals.total)}</p>
          </div>
          <div className="flex gap-2">
            {kind === "SALE" ? <Button variant="outline" disabled={busy} onClick={() => save("DRAFT")}>{t("action.saveDraft")}</Button> : null}
            <Button disabled={busy || (kind === "CONSIGN" && !customerId)} onClick={() => save("CONFIRMED")}>
              {openInvoice ? t("open.addTo") : t("action.confirm")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

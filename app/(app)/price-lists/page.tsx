"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useCustomerPrices } from "@/components/customer-prices";
import { printSheet } from "@/components/invoice";
import { MoneyInput } from "@/components/money-input";
import { useToast } from "@/components/providers";
import { Button, Card, EmptyState, Field, LoadingBlock, PageHeader, SearchBar, Select, Table, Td, Th } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import { formatKhr, formatUsd, sellingUnit } from "@/lib/format";
import { useFormat, useI18n, useSettings } from "@/lib/settings";
import type { Meta, MetaProduct } from "@/lib/types";

/** Choose a customer and set every product's price for them on one sheet. */
export default function PriceListsPage() {
  // The chosen customer lives in the URL (?customer=…), which needs a Suspense boundary.
  return (
    <Suspense fallback={<LoadingBlock />}>
      <PriceLists />
    </Suspense>
  );
}

function PriceLists() {
  const { t } = useI18n();
  const router = useRouter();
  const meta = useApi<Meta>("/api/meta");
  const customerId = useSearchParams().get("customer") || "";
  const customer = meta.data?.customers.find((item) => item.id === customerId);

  return (
    <div>
      <PageHeader title={t("pricelist.title")} subtitle={t("pricelist.sub")} />
      <Card className="mb-4 p-4 sm:p-5">
        <Field label={t("label.customer")}>
          <Select value={customerId} onChange={(event) => router.replace(event.target.value ? `/price-lists?customer=${event.target.value}` : "/price-lists")}>
            <option value="">{t("pricelist.choose")}</option>
            {meta.data?.customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        </Field>
      </Card>
      {!meta.data ? <LoadingBlock /> : !customer ? <EmptyState title={t("pricelist.choose")} body={t("pricelist.chooseHint")} /> : (
        // Keyed by customer so unsaved edits never carry over to someone else.
        <PriceSheet key={customer.id} customerId={customer.id} customerName={customer.name} products={meta.data.products} categories={meta.data.categories} />
      )}
    </div>
  );
}

function PriceSheet({
  customerId,
  customerName,
  products,
  categories,
}: {
  customerId: string;
  customerName: string;
  products: MetaProduct[];
  categories: { id: string; name: string }[];
}) {
  const { t } = useI18n();
  const money = useFormat();
  const toast = useToast();
  const { prices, list } = useCustomerPrices(customerId);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const active = useMemo(() => products.filter((product) => product.status === "ACTIVE"), [products]);
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? active.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(needle)) : active;
  }, [active, search]);
  const categoryName = (id: string) => categories.find((item) => item.id === id)?.name || "";

  const saved = (id: string) => (prices.has(id) ? String(prices.get(id)) : "");
  const value = (id: string) => edits[id] ?? saved(id);
  const normal = (product: MetaProduct) => sellingUnit(product.sellingPrice, product.discountPct);
  /** What this customer pays: their own price if set, else the normal price. */
  const effective = (product: MetaProduct) => (value(product.id) === "" ? normal(product) : Number(value(product.id)));
  const changed = Object.keys(edits).filter((id) => edits[id] !== saved(id) && !(edits[id] !== "" && saved(id) !== "" && Number(edits[id]) === Number(saved(id))));
  const specialCount = active.filter((product) => value(product.id) !== "").length;

  async function save() {
    setBusy(true);
    try {
      await api(`/api/customers/${customerId}/prices`, {
        method: "PUT",
        body: JSON.stringify({ prices: changed.map((productId) => ({ productId, price: edits[productId] === "" ? null : Number(edits[productId]) })) }),
      });
      toast(t("common.saved"));
      setEdits({});
      list.reload();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div>
          <h2 className="font-serif text-xl sm:text-2xl">{customerName}</h2>
          <p className="text-sm text-ink-soft">{t("pricelist.hint")} · {specialCount} {t("pricelist.special")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/customers/${customerId}`}><Button variant="ghost">{t("pricelist.customerPage")}</Button></Link>
          <Button variant="outline" onClick={() => printSheet("A4")}>🖨 {t("pricelist.print")}</Button>
          <Button disabled={busy || changed.length === 0} onClick={save}>
            {t("action.save")}{changed.length ? ` (${changed.length})` : ""}
          </Button>
        </div>
      </div>
      <div className="px-4 pb-3 sm:px-5">
        <SearchBar value={search} onChange={setSearch} placeholder={t("lines.search")} />
      </div>
      {list.loading ? <LoadingBlock /> : (
        <Table>
          <thead>
            <tr>
              <Th>{t("label.product")}</Th>
              <Th>{t("prices.normal")}</Th>
              <Th>{t("prices.custom")}</Th>
              <Th className="text-right">{t("pricelist.pays")}</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((product) => {
              const own = value(product.id) !== "";
              const dirty = changed.includes(product.id);
              return (
                <tr key={product.id} className={`border-t border-line ${dirty ? "bg-[#fbf3e2]" : ""}`}>
                  <Td>
                    {product.name}
                    <div className="text-xs text-ink-soft">{product.sku} · {categoryName(product.categoryId)}</div>
                  </Td>
                  <Td className="tabular-nums text-ink-soft">{money.amount(normal(product))}</Td>
                  <Td className="w-44">
                    <MoneyInput
                      value={value(product.id)}
                      placeholder={String(money.toDisplay(normal(product)))}
                      aria-label={`${product.name} ${t("prices.custom")}`}
                      onChange={(usd) => setEdits((current) => ({ ...current, [product.id]: usd }))}
                    />
                  </Td>
                  <Td className={`text-right tabular-nums ${own ? "font-semibold text-forest" : ""}`}>{money.amount(effective(product))}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {typeof document !== "undefined"
        ? createPortal(
            <div className="invoice-print-root">
              <PrintedPriceList customerName={customerName} rows={active.map((product) => ({ name: product.name, sku: product.sku, price: effective(product), own: value(product.id) !== "" }))} />
            </div>,
            document.body,
          )
        : null}
    </Card>
  );
}

function PrintedPriceList({ customerName, rows }: { customerName: string; rows: { name: string; sku: string; price: number; own: boolean }[] }) {
  const { system, rate, prefs } = useSettings();
  const { date } = useFormat();
  const khr = prefs.currency !== "USD";
  const main = (usd: number) => (khr ? formatKhr(usd * rate) : formatUsd(usd));
  return (
    <div className="invoice-sheet mx-auto bg-white p-2 text-sm text-[#1c1915]" style={{ maxWidth: "190mm" }}>
      <div className="flex items-start justify-between gap-4 border-b-2 border-[#1F7A4D] pb-3">
        <div>
          <p className="font-serif text-3xl">{system.name}</p>
          <p className="text-[#6f675e]">{system.subtitle}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-[#1F7A4D]">តារាងតម្លៃ</p>
          <p className="font-serif">PRICE LIST</p>
        </div>
      </div>
      <div className="mt-3 flex justify-between gap-4">
        <p><span className="text-[#6f675e]">អតិថិជន / Customer: </span><span className="font-bold">{customerName}</span></p>
        <p><span className="text-[#6f675e]">ថ្ងៃ / Date: </span>{date(new Date())}</p>
      </div>
      <table className="mt-3 w-full border-collapse text-left">
        <thead>
          <tr className="border-y border-[#1c1915] text-[#6f675e]">
            <th className="py-1.5 font-normal">ល.រ<br />No.</th>
            <th className="py-1.5 font-normal">ទំនិញ<br />Item</th>
            <th className="py-1.5 font-normal">លេខកូដ<br />SKU</th>
            <th className="py-1.5 text-right font-normal">តម្លៃ<br />Price</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.sku} className="border-b border-[#e4dcd0]">
              <td className="py-1.5 pr-2 text-[#6f675e]">{index + 1}</td>
              <td className="py-1.5 pr-2">{row.name}</td>
              <td className="py-1.5 pr-2 text-[#6f675e]">{row.sku}</td>
              <td className={`py-1.5 text-right tabular-nums ${row.own ? "font-bold" : ""}`}>{main(row.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-center text-[#6f675e]">សូមអរគុណ · Thank you</p>
    </div>
  );
}

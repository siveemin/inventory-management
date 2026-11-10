"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { MoneyInput } from "./money-input";
import { useToast } from "./providers";
import { Button, Card, EmptyState, Select, Table, Td, Th } from "./ui";
import { api, useApi } from "@/lib/client";
import { sellingUnit } from "@/lib/format";
import { useFormat, useI18n } from "@/lib/settings";
import type { Meta } from "@/lib/types";

export type CustomerPriceRow = {
  id: string;
  customerId: string;
  productId: string;
  price: number;
  product: { name: string; sku: string; sellingPrice: number; discountPct: number };
};

type Priced = { id: string; sellingPrice: number; discountPct: number };

/**
 * The price to charge a customer for a product: their own price when one is set,
 * otherwise the product's normal selling price (after its discount).
 */
export function useCustomerPrices(customerId: string | null | undefined) {
  const list = useApi<{ data: CustomerPriceRow[] }>(customerId ? `/api/customers/${customerId}/prices` : null);
  const prices = useMemo(() => {
    const map = new Map<string, number>();
    // Ignore rows still on screen from a previously selected customer.
    for (const row of list.data?.data || []) if (row.customerId === customerId) map.set(row.productId, row.price);
    return map;
  }, [list.data, customerId]);
  const priceFor = useCallback(
    (product: Priced) => prices.get(product.id) ?? sellingUnit(product.sellingPrice, product.discountPct),
    [prices],
  );
  return { prices, priceFor, list };
}

export function CustomerPricesCard({ customerId }: { customerId: string }) {
  const { t } = useI18n();
  const money = useFormat();
  const toast = useToast();
  const meta = useApi<Meta>("/api/meta");
  const { list } = useCustomerPrices(customerId);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [newProductId, setNewProductId] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = (list.data?.data || []).filter((row) => row.customerId === customerId);
  const taken = new Set(rows.map((row) => row.productId));
  const choices = (meta.data?.products || []).filter((product) => !taken.has(product.id));

  async function save(productId: string, price: string | null) {
    setBusy(true);
    try {
      await api(`/api/customers/${customerId}/prices`, { method: "PUT", body: JSON.stringify({ productId, price }) });
      toast(t("common.saved"));
      setEdits((current) => {
        const next = { ...current };
        delete next[productId];
        return next;
      });
      list.reload();
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save", "bad");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-4">
      <div className="px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-xl sm:text-2xl">{t("prices.title")}</h2>
          <Link href={`/price-lists?customer=${customerId}`} className="text-sm font-medium text-forest">{t("pricelist.openAll")} →</Link>
        </div>
        <p className="mt-1 text-sm text-ink-soft">{t("prices.hint")}</p>
      </div>
      <div className="grid gap-2 p-4 sm:grid-cols-[1fr_180px_auto] sm:p-5">
        <Select value={newProductId} onChange={(event) => {
          const id = event.target.value;
          setNewProductId(id);
          const product = meta.data?.products.find((item) => item.id === id);
          setNewPrice(product ? String(sellingUnit(product.sellingPrice, product.discountPct)) : "");
        }}>
          <option value="">{t("prices.pick")}</option>
          {choices.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}
        </Select>
        <MoneyInput value={newPrice} onChange={setNewPrice} aria-label={t("prices.custom")} />
        <Button disabled={busy || !newProductId || newPrice === ""} onClick={async () => {
          if (await save(newProductId, newPrice)) {
            setNewProductId("");
            setNewPrice("");
          }
        }}>{t("action.add")}</Button>
      </div>
      {rows.length === 0 ? <EmptyState title={t("prices.none")} /> : (
        <Table>
          <thead><tr><Th>{t("label.product")}</Th><Th>{t("prices.normal")}</Th><Th>{t("prices.custom")}</Th><Th /></tr></thead>
          <tbody>
            {rows.map((row) => {
              const normal = sellingUnit(row.product.sellingPrice, row.product.discountPct);
              const draft = edits[row.productId];
              const changed = draft !== undefined && draft !== "" && Number(draft) !== row.price;
              return (
                <tr key={row.id} className="border-t border-line">
                  <Td>{row.product.name}<div className="text-xs text-ink-soft">{row.product.sku}</div></Td>
                  <Td className="tabular-nums text-ink-soft">{money.amount(normal)}</Td>
                  <Td className="w-48"><MoneyInput value={draft ?? String(row.price)} onChange={(usd) => setEdits({ ...edits, [row.productId]: usd })} /></Td>
                  <Td className="whitespace-nowrap text-right">
                    {changed ? <Button disabled={busy} onClick={() => save(row.productId, draft)}>{t("action.save")}</Button> : null}{" "}
                    <Button variant="ghost" disabled={busy} onClick={() => save(row.productId, null)}>{t("lines.remove")}</Button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

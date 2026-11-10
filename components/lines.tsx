"use client";

import { useMemo, useState } from "react";
import { sellingUnit } from "@/lib/format";
import { useI18n } from "@/lib/settings";
import type { MetaProduct } from "@/lib/types";
import { MoneyInput } from "./money-input";
import { Button, inputClass } from "./ui";

export type DraftLine = { key: string; productId: string; quantity: string; price: string };

export function blankLine(): DraftLine {
  return { key: Math.random().toString(36).slice(2), productId: "", quantity: "1", price: "" };
}

export function LineEditor({
  lines,
  onChange,
  products,
  showPrice,
  priceOf,
  priceLabel,
}: {
  lines: DraftLine[];
  onChange: (lines: DraftLine[]) => void;
  products: MetaProduct[];
  showPrice?: boolean;
  priceOf?: (product: MetaProduct) => number;
  priceLabel?: string;
}) {
  const { t } = useI18n();
  function update(key: string, patch: Partial<DraftLine>) {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }
  return (
    <div className="grid gap-3">
      {lines.map((line) => (
        <div key={line.key} className="grid gap-2 rounded-2xl border border-line bg-[#fbf8f2] p-3 md:grid-cols-[1.4fr_120px_140px_auto]">
          <ProductPick
            products={products}
            value={line.productId}
            onSelect={(product) => update(line.key, { productId: product.id, price: String(priceOf ? priceOf(product) : sellingUnit(product.sellingPrice, product.discountPct)) })}
          />
          <input className={inputClass} type="number" min="1" step="1" value={line.quantity} onChange={(event) => update(line.key, { quantity: event.target.value })} />
          {showPrice ? (
            <MoneyInput value={line.price} aria-label={priceLabel} onChange={(usd) => update(line.key, { price: usd })} />
          ) : <span />}
          <Button variant="ghost" onClick={() => onChange(lines.filter((item) => item.key !== line.key))}>{t("lines.remove")}</Button>
        </div>
      ))}
      <Button variant="outline" onClick={() => onChange([...lines, blankLine()])}>{t("lines.add")}</Button>
    </div>
  );
}

function ProductPick({ products, value, onSelect }: { products: MetaProduct[]; value: string; onSelect: (product: MetaProduct) => void }) {
  const { t } = useI18n();
  const selected = products.find((product) => product.id === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = products.filter((product) => product.status === "ACTIVE");
    if (!needle) return list.slice(0, 8);
    return list.filter((product) => `${product.name} ${product.sku} ${product.barcode || ""}`.toLowerCase().includes(needle)).slice(0, 8);
  }, [products, query]);
  return (
    <div className="relative">
      <input
        className={inputClass}
        placeholder={t("lines.search")}
        value={open ? query : selected ? `${selected.name} · ${selected.sku}` : ""}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
      />
      {open ? (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-line bg-white shadow-lg">
          {matches.length === 0 ? <p className="px-3 py-2 text-sm text-ink-soft">{t("lines.none")}</p> : matches.map((product) => (
            <button
              type="button"
              key={product.id}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-mist"
              onMouseDown={(event) => { event.preventDefault(); onSelect(product); setOpen(false); }}
            >
              <span className="font-medium">{product.name}</span>
              <span className="ml-2 text-ink-soft">{product.sku}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

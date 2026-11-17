"use client";

import { useState } from "react";
import { useToast } from "@/components/providers";
import { Button, Card, EmptyState, ErrorNote, Field, LoadingBlock, Modal, PageHeader, Pagination, SearchBar, Select, StatusBadge, Table, Td, TextArea, TextInput, Th } from "@/components/ui";
import { api, qs, useApi } from "@/lib/client";
import { useFormat, useI18n } from "@/lib/settings";
import type { InventoryRow, Meta, PageResult, StockMove } from "@/lib/types";

export default function InventoryPage() {
  const { t } = useI18n();
  const money = useFormat();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<InventoryRow | null>(null);
  const [adjust, setAdjust] = useState<InventoryRow | null>(null);
  const [type, setType] = useState("STOCK_IN");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const meta = useApi<Meta>("/api/meta");
  const list = useApi<PageResult<InventoryRow>>(qs("/api/inventory", { search, warehouseId, page }));
  const history = useApi<{ data: StockMove[] }>(selected ? `/api/inventory/${selected.productId}/history?warehouseId=${selected.warehouseId}` : null);

  async function saveAdjust(event: React.FormEvent) {
    event.preventDefault();
    if (!adjust) return;
    setBusy(true);
    try {
      await api("/api/inventory/adjust", {
        method: "POST",
        body: JSON.stringify({ productId: adjust.productId, warehouseId: adjust.warehouseId, type, quantity: Number(quantity), notes }),
      });
      toast(t("common.saved"));
      setAdjust(null);
      list.reload();
      history.reload();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not adjust", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title={t("page.inventory")} subtitle={t("sub.inventory")} />
      <ErrorNote message={list.error} />
      <Card>
        <div className="flex flex-wrap gap-2 p-4">
          <SearchBar value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder={`${t("label.name")} / ${t("label.sku")}`} />
          <Select value={warehouseId} onChange={(event) => { setWarehouseId(event.target.value); setPage(1); }} className="max-w-none sm:max-w-xs">
            <option value="">{t("label.warehouse")}</option>
            {meta.data?.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
          </Select>
        </div>
        {list.loading ? <LoadingBlock /> : !list.data?.data.length ? <EmptyState title={t("empty.title")} body={t("empty.body")} /> : (
          <Table>
            <thead>
              <tr>
                <Th>{t("label.product")}</Th><Th>{t("label.sku")}</Th><Th>{t("label.warehouse")}</Th><Th>{t("label.quantity")}</Th>
                <Th>{t("label.reserved")}</Th><Th>{t("label.available")}</Th><Th>{t("label.bin")}</Th><Th>{t("label.updated")}</Th><Th />
              </tr>
            </thead>
            <tbody>
              {list.data.data.map((row) => (
                <tr key={row.id} className="cursor-pointer border-t border-line hover:bg-[#fbf8f2]" onClick={() => setSelected(row)}>
                  <Td className="font-medium">{row.product?.name}</Td>
                  <Td>{row.product?.sku}</Td>
                  <Td>{row.warehouse?.name}</Td>
                  <Td className="tabular-nums">{row.quantity}</Td>
                  <Td className="tabular-nums">{row.reserved}</Td>
                  <Td className="tabular-nums">{row.quantity - row.reserved}</Td>
                  <Td>{row.bin}</Td>
                  <Td>{money.dateTime(row.updatedAt)}</Td>
                  <Td>
                    <Button variant="subtle" className="px-3 py-1.5" onClick={(event) => { event.stopPropagation(); setAdjust(row); setType("STOCK_IN"); setQuantity("1"); setNotes(""); }}>{t("stock.adjust")}</Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination page={page} pageSize={list.data?.pageSize || 10} total={list.data?.total || 0} onPage={setPage} />
      </Card>

      {selected ? (
        <div className="fixed inset-0 z-40">
          <button className="absolute inset-0 bg-black/30" onClick={() => setSelected(null)} aria-label="Close" />
          <aside className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l border-line bg-card p-6 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">{selected.product?.sku}</p>
            <h2 className="font-serif text-3xl">{selected.product?.name}</h2>
            <p className="mt-1 text-sm text-ink-soft">{selected.warehouse?.name}</p>
            <div className="mt-6 grid gap-3">
              {(history.data?.data || []).map((move) => (
                <div key={move.id} className="rounded-2xl border border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={move.type} label={t(`status.${move.type}`)} />
                    <span className="tabular-nums">{move.quantity > 0 ? `+${move.quantity}` : move.quantity}</span>
                  </div>
                  <p className="mt-2 text-xs text-ink-soft">{money.dateTime(move.createdAt)} · {move.user?.name || "System"}</p>
                  {move.notes ? <p className="mt-1 text-sm">{move.notes}</p> : null}
                </div>
              ))}
              {!history.data?.data.length ? <p className="text-sm text-ink-soft">{t("empty.title")}</p> : null}
            </div>
          </aside>
        </div>
      ) : null}

      <Modal open={Boolean(adjust)} title={t("stock.adjustTitle")} onClose={() => setAdjust(null)}>
        <form onSubmit={saveAdjust} className="grid gap-4">
          <p className="text-sm text-ink-soft">{adjust?.product?.name} · {adjust?.warehouse?.name}</p>
          <Field label={t("label.type")}>
            <Select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="STOCK_IN">{t("status.STOCK_IN")}</option>
              <option value="STOCK_OUT">{t("status.STOCK_OUT")}</option>
              <option value="ADJUSTMENT">{t("status.ADJUSTMENT")}</option>
            </Select>
          </Field>
          <Field label={type === "ADJUSTMENT" ? t("stock.counted") : t("label.quantity")}>
            <TextInput type="number" min="0" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </Field>
          <Field label={t("label.notes")}><TextArea value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="subtle" onClick={() => setAdjust(null)}>{t("action.cancel")}</Button>
            <Button type="submit" disabled={busy}>{t("action.save")}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

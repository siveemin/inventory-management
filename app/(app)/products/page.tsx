"use client";

import { useEffect, useState } from "react";
import { api, qs, useApi } from "@/lib/client";
import { useFormat, useI18n } from "@/lib/settings";
import { fileToDataUrl, readProductImage, saveProductImage } from "@/lib/storage";
import type { Meta, PageResult, Product } from "@/lib/types";
import { useToast } from "@/components/providers";
import { PRODUCT_SEARCH_EVENT } from "@/components/shell";
import { Button, Card, ConfirmDialog, EmptyState, ErrorNote, Field, LoadingBlock, Modal, PageHeader, Pagination, SearchBar, Select, StatusBadge, Switch, Table, Td, TextArea, TextInput, Th } from "@/components/ui";

type Form = {
  name: string; sku: string; barcode: string; description: string; categoryId: string; supplierId: string;
  uom: string; costPrice: string; sellingPrice: string; discountPct: string; minStock: string; maxStock: string;
  imageUrl: string; status: string;
};

function blank(barcode = ""): Form {
  return { name: "", sku: "", barcode, description: "", categoryId: "", supplierId: "", uom: "pcs", costPrice: "", sellingPrice: "", discountPct: "0", minStock: "0", maxStock: "0", imageUrl: "", status: "ACTIVE" };
}

export default function ProductsPage() {
  const { t } = useI18n();
  const money = useFormat();
  const toast = useToast();
  // A search typed in the top bar arrives as ?search=…
  const [search, setSearch] = useState(() => {
    if (typeof window === "undefined") return "";
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(PRODUCT_SEARCH_EVENT);
    } catch {}
    return pending ?? new URLSearchParams(window.location.search).get("search") ?? "";
  });
  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Form>(blank());
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState<Product | null>(null);
  const meta = useApi<Meta>("/api/meta");
  const list = useApi<PageResult<Product>>(qs("/api/products", { search, categoryId, supplierId, status, page }));

  useEffect(() => {
    try {
      sessionStorage.removeItem(PRODUCT_SEARCH_EVENT);
    } catch {}
    const onSearch = (event: Event) => {
      setSearch((event as CustomEvent<string>).detail || "");
      setPage(1);
    };
    window.addEventListener(PRODUCT_SEARCH_EVENT, onSearch);
    return () => window.removeEventListener(PRODUCT_SEARCH_EVENT, onSearch);
  }, []);

  useEffect(() => {
    const barcode = new URLSearchParams(window.location.search).get("barcode");
    if (barcode) {
      setForm(blank(barcode));
      setEditing(null);
      setOpen(true);
    }
  }, []);

  function edit(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || "",
      description: product.description || "",
      categoryId: product.categoryId,
      supplierId: product.supplierId || "",
      uom: product.uom,
      costPrice: String(product.costPrice),
      sellingPrice: String(product.sellingPrice),
      discountPct: String(product.discountPct),
      minStock: String(product.minStock),
      maxStock: String(product.maxStock),
      imageUrl: readProductImage(product.id, product.imageUrl),
      status: product.status,
    });
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const saved = await api<Product>(editing ? `/api/products/${editing.id}` : "/api/products", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(form),
      });
      if (form.imageUrl.startsWith("data:")) saveProductImage(saved.id, form.imageUrl);
      toast(t("common.saved"));
      setOpen(false);
      list.reload();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save", "bad");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!remove) return;
    setBusy(true);
    try {
      await api(`/api/products/${remove.id}`, { method: "DELETE" });
      setRemove(null);
      list.reload();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete", "bad");
    } finally {
      setBusy(false);
    }
  }

  const set = (key: keyof Form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div>
      <PageHeader
        title={t("page.products")}
        subtitle={t("sub.products")}
        actions={<Button onClick={() => { setEditing(null); setForm(blank()); setOpen(true); }}>{t("action.add")}</Button>}
      />
      <ErrorNote message={list.error} />
      <Card>
        <div className="flex flex-wrap gap-2 p-4">
          <SearchBar value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder={t("action.search")} />
          <Select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setPage(1); }} className="max-w-none sm:max-w-[180px]">
            <option value="">{t("label.category")}</option>
            {meta.data?.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </Select>
          <Select value={supplierId} onChange={(event) => { setSupplierId(event.target.value); setPage(1); }} className="max-w-none sm:max-w-[180px]">
            <option value="">{t("label.supplier")}</option>
            {meta.data?.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </Select>
          <Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="max-w-none sm:max-w-[140px]">
            <option value="">{t("label.status")}</option>
            <option value="ACTIVE">{t("status.ACTIVE")}</option>
            <option value="INACTIVE">{t("status.INACTIVE")}</option>
          </Select>
        </div>
        {list.loading ? <LoadingBlock /> : !list.data?.data.length ? <EmptyState title={t("empty.title")} body={t("empty.body")} /> : (
          <Table>
            <thead>
              <tr>
                <Th>{t("label.image")}</Th><Th>{t("label.name")}</Th><Th>{t("label.sku")}</Th><Th>{t("label.category")}</Th>
                <Th>{t("label.cost")}</Th><Th>{t("label.selling")}</Th><Th>{t("label.stock")}</Th><Th>{t("label.status")}</Th><Th />
              </tr>
            </thead>
            <tbody>
              {list.data.data.map((product) => {
                const src = readProductImage(product.id, product.imageUrl);
                return (
                  <tr key={product.id} className="border-t border-line">
                    <Td>{src ? <img src={src} alt="" className="h-10 w-10 rounded-xl object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-xl bg-mist font-serif text-forest">{product.name.slice(0, 1)}</span>}</Td>
                    <Td className="font-medium">{product.name}</Td>
                    <Td>{product.sku}</Td>
                    <Td>{product.category?.name}</Td>
                    <Td className="tabular-nums">{money.usd(product.costPrice)}</Td>
                    <Td className="tabular-nums">{money.usd(product.sellingPrice)}</Td>
                    <Td className="tabular-nums">{product.totalStock ?? 0}</Td>
                    <Td><StatusBadge status={product.status} label={t(`status.${product.status}`)} /></Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button variant="subtle" className="px-3 py-1.5" onClick={() => edit(product)}>{t("action.edit")}</Button>
                        <Button variant="ghost" className="px-3 py-1.5" onClick={() => setRemove(product)}>{t("action.delete")}</Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <Pagination page={page} pageSize={list.data?.pageSize || 10} total={list.data?.total || 0} onPage={setPage} />
      </Card>

      <Modal open={open} title={editing ? t("action.edit") : t("action.add")} onClose={() => setOpen(false)} wide>
        <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
          <Field label={t("label.name")}><TextInput value={form.name} onChange={(event) => set("name", event.target.value)} required /></Field>
          <Field label={t("label.sku")}><TextInput value={form.sku} onChange={(event) => set("sku", event.target.value)} required /></Field>
          <Field label={t("label.barcode")}><TextInput value={form.barcode} onChange={(event) => set("barcode", event.target.value)} /></Field>
          <Field label={t("label.uom")}><TextInput value={form.uom} onChange={(event) => set("uom", event.target.value)} /></Field>
          <Field label={t("label.category")}>
            <Select value={form.categoryId} onChange={(event) => set("categoryId", event.target.value)} required>
              <option value="">—</option>
              {meta.data?.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </Select>
          </Field>
          <Field label={t("label.supplier")}>
            <Select value={form.supplierId} onChange={(event) => set("supplierId", event.target.value)}>
              <option value="">—</option>
              {meta.data?.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </Select>
          </Field>
          <Field label={t("label.cost")}><TextInput type="number" min="0" step="0.01" value={form.costPrice} onChange={(event) => set("costPrice", event.target.value)} /></Field>
          <Field label={t("label.selling")}><TextInput type="number" min="0" step="0.01" value={form.sellingPrice} onChange={(event) => set("sellingPrice", event.target.value)} /></Field>
          <Field label={t("label.discount")}><TextInput type="number" min="0" max="100" step="0.1" value={form.discountPct} onChange={(event) => set("discountPct", event.target.value)} /></Field>
          <Field label={t("label.min")}><TextInput type="number" min="0" value={form.minStock} onChange={(event) => set("minStock", event.target.value)} /></Field>
          <Field label={t("label.max")}><TextInput type="number" min="0" value={form.maxStock} onChange={(event) => set("maxStock", event.target.value)} /></Field>
          <div className="flex items-end gap-3">
            <span className="text-sm">{t("label.status")}</span>
            <Switch checked={form.status === "ACTIVE"} onChange={(on) => set("status", on ? "ACTIVE" : "INACTIVE")} label={t("label.status")} />
            <StatusBadge status={form.status} label={t(`status.${form.status}`)} />
          </div>
          <div className="md:col-span-2">
            <Field label={t("label.description")}><TextArea value={form.description} onChange={(event) => set("description", event.target.value)} /></Field>
          </div>
          <div className="md:col-span-2">
            <Field label={t("label.image")}>
              <input type="file" accept="image/*" onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                set("imageUrl", await fileToDataUrl(file));
              }} />
            </Field>
            {form.imageUrl ? <img src={form.imageUrl} alt="" className="mt-3 h-20 w-20 rounded-2xl object-cover" /> : null}
          </div>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button variant="subtle" onClick={() => setOpen(false)}>{t("action.cancel")}</Button>
            <Button type="submit" disabled={busy}>{t("action.save")}</Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog open={Boolean(remove)} title={t("confirm.delete")} body={t("confirm.body")} confirmLabel={t("action.delete")} cancelLabel={t("action.cancel")} busy={busy} onClose={() => setRemove(null)} onConfirm={onDelete} />
    </div>
  );
}

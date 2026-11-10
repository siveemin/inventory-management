"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useCustomerPrices } from "@/components/customer-prices";
import { QuickCustomerButton } from "@/components/quick-customer";
import { KhmerInvoice, toInvoice } from "@/components/invoice";
import { MoneyInput } from "@/components/money-input";
import { useAuth, useToast } from "@/components/providers";
import { BarcodeCameraScanner, HardwareScanListener, QtyStepper } from "@/components/scanner";
import { Button, Card, Field, Modal, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import { salesTotals, sellingUnit } from "@/lib/format";
import { readProductImage } from "@/lib/storage";
import { useFormat, useI18n } from "@/lib/settings";
import type { Meta, Product, SalesOrder } from "@/lib/types";

type CartLine = { product: Product; quantity: number };

export default function ScannerPage() {
  const { t } = useI18n();
  const money = useFormat();
  const toast = useToast();
  const { user } = useAuth();
  const meta = useApi<Meta>("/api/meta");
  const [mode, setMode] = useState<"lookup" | "sale">("lookup");
  const [manual, setManual] = useState("");
  const [camera, setCamera] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [missing, setMissing] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("0");
  const [checkout, setCheckout] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const { priceFor } = useCustomerPrices(customerId);
  const [pickedWarehouseId, setWarehouseId] = useState("");
  const [invoice, setInvoice] = useState<SalesOrder | null>(null);
  const [action, setAction] = useState<"STOCK_IN" | "STOCK_OUT" | "TRANSFER" | null>(null);
  const [qty, setQty] = useState("1");
  const [notes, setNotes] = useState("");
  const [pickedDest, setDest] = useState("");
  const [busy, setBusy] = useState(false);
  const last = useRef({ code: "", at: 0 });

  // Until the user picks, work in their own warehouse (or the first one) and transfer to the second.
  const warehouseId = pickedWarehouseId || user?.warehouseId || meta.data?.warehouses[0]?.id || "";
  const dest = pickedDest || meta.data?.warehouses[1]?.id || "";

  const lookup = useCallback(async (value: string) => {
    const clean = value.trim();
    if (!clean) return;
    try {
      const found = await api<Product>(`/api/lookup?code=${encodeURIComponent(clean)}`);
      if (mode === "lookup") {
        setProduct(found);
        setMissing("");
      } else {
        setCart((current) => {
          const existing = current.find((line) => line.product.id === found.id);
          if (existing) return current.map((line) => line.product.id === found.id ? { ...line, quantity: line.quantity + 1 } : line);
          return [...current, { product: found, quantity: 1 }];
        });
      }
    } catch {
      if (mode === "lookup") {
        setProduct(null);
        setMissing(clean);
      } else toast("No product for that code", "bad");
    }
  }, [mode, toast]);

  function onScan(code: string) {
    const now = Date.now();
    if (code === last.current.code && now - last.current.at < 1200) return;
    last.current = { code, at: now };
    setManual(code);
    lookup(code);
  }

  const totals = salesTotals(
    cart.map((line) => ({ quantity: line.quantity, unitPrice: priceFor(line.product) })),
    Number(discount) || 0,
    0,
  );

  async function confirmSale() {
    setBusy(true);
    try {
      const order = await api<SalesOrder>("/api/sales-orders", {
        method: "POST",
        body: JSON.stringify({
          customerId: customerId || null,
          warehouseId,
          status: "CONFIRMED",
          discount: Number(discount) || 0,
          taxPct: 0,
          notes: "POS sale",
          items: cart.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
            unitPrice: priceFor(line.product),
          })),
        }),
      });
      setInvoice(order);
      setCart([]);
      setCheckout(false);
      setDiscount("0");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Checkout failed", "bad");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(event: React.FormEvent) {
    event.preventDefault();
    if (!product) return;
    setBusy(true);
    try {
      if (action === "TRANSFER") {
        await api("/api/stock-transfers", {
          method: "POST",
          body: JSON.stringify({
            sourceWarehouseId: warehouseId,
            destWarehouseId: dest,
            status: "RECEIVED",
            notes,
            items: [{ productId: product.id, quantity: Number(qty) }],
          }),
        });
      } else {
        await api("/api/inventory/adjust", {
          method: "POST",
          body: JSON.stringify({ productId: product.id, warehouseId, type: action, quantity: Number(qty), notes }),
        });
      }
      toast(t("common.saved"));
      setAction(null);
      const fresh = await api<Product>(`/api/lookup?code=${encodeURIComponent(product.sku)}`);
      setProduct(fresh);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not update stock", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <HardwareScanListener onScan={onScan} />
      <PageHeader title={t("page.scanner")} subtitle={t("sub.scanner")} />
      <div className="mb-4 flex flex-wrap gap-2">
        {(["lookup", "sale"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setMode(item)} className={`rounded-full px-4 py-2 text-sm ${mode === item ? "bg-forest text-white" : "border border-line bg-white"}`}>
            {t(item === "lookup" ? "scanner.lookup" : "scanner.sale")}
          </button>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="grid gap-4 p-5">
          <form onSubmit={(event) => { event.preventDefault(); lookup(manual); }} className="flex flex-col gap-2 sm:flex-row">
            <TextInput value={manual} onChange={(event) => setManual(event.target.value)} placeholder={t("scanner.manual")} />
            <Button type="submit">{t("action.search")}</Button>
          </form>
          <Button variant="outline" onClick={() => setCamera((value) => !value)}>{t("scanner.camera")}</Button>
          {camera ? <BarcodeCameraScanner onScan={onScan} /> : null}
        </Card>

        {mode === "lookup" ? (
          <Card className="p-5">
            {product ? <LookupCard product={product} onAction={(next) => { setAction(next); setQty("1"); setNotes(""); }} /> : missing ? (
              <div>
                <p className="font-serif text-3xl">{t("scanner.notFound")}</p>
                <p className="mt-2 text-sm text-ink-soft">{missing}</p>
                <Link href={`/products?barcode=${encodeURIComponent(missing)}`} className="mt-4 inline-block"><Button>{t("scanner.create")}</Button></Link>
              </div>
            ) : <p className="text-sm text-ink-soft">{t("scanner.empty")}</p>}
          </Card>
        ) : (
          <Card className="p-5">
            <h2 className="font-serif text-2xl">{t("scanner.cart")}</h2>
            {cart.length === 0 ? <p className="mt-4 text-sm text-ink-soft">{t("scanner.empty")}</p> : (
              <div className="mt-4 grid gap-3">
                {cart.map((line) => {
                  const price = priceFor(line.product);
                  return (
                    <div key={line.product.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                      <div>
                        <p className="font-medium">{line.product.name}</p>
                        <p className="text-xs text-ink-soft">{money.amount(price)}</p>
                      </div>
                      <QtyStepper value={line.quantity} onChange={(quantity) => setCart((current) => current.map((item) => item.product.id === line.product.id ? { ...item, quantity } : item))} />
                      <p className="tabular-nums">{money.amount(price * line.quantity)}</p>
                      <Button variant="ghost" onClick={() => setCart((current) => current.filter((item) => item.product.id !== line.product.id))}>✕</Button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-4 grid gap-2">
              <Field label={t("label.discount")}><MoneyInput value={discount} onChange={setDiscount} /></Field>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm text-ink-soft">{t("label.subtotal")} {money.amount(totals.subtotal)}</p>
                  <p className="font-serif text-3xl">{money.amount(totals.total)}</p>
                  <p className="text-sm">{money.other(totals.total)}</p>
                </div>
                <Button disabled={!cart.length} onClick={() => setCheckout(true)}>{t("action.checkout")}</Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Modal open={checkout} title={t("action.checkout")} onClose={() => setCheckout(false)}>
        <div className="grid gap-4">
          <Field label={t("label.warehouse")}>
            <Select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
              {meta.data?.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </Select>
          </Field>
          <Field label={t("label.customer")}>
            <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">{t("label.walkIn")}</option>
              {meta.data?.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </Select>
            <QuickCustomerButton onCreated={(id) => { meta.reload(); setCustomerId(id); }} />
          </Field>
          <p className="text-sm text-ink-soft">1 USD = {money.rate.toLocaleString("en-US")} KHR</p>
          <p className="font-serif text-3xl">{money.amount(totals.total)} · {money.other(totals.total)}</p>
          <Button disabled={busy} onClick={confirmSale}>{t("action.confirm")}</Button>
        </div>
      </Modal>

      <Modal open={Boolean(invoice)} title={invoice?.orderNumber || ""} onClose={() => setInvoice(null)} wide>
        {invoice ? (
          <div>
            <Button variant="outline" className="mb-4" onClick={() => setInvoice(null)}>{t("action.newSale")}</Button>
            <KhmerInvoice order={toInvoice(invoice, t("label.walkIn"))} />
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(action)} title={action ? t(action === "STOCK_IN" ? "scanner.stockIn" : action === "STOCK_OUT" ? "scanner.stockOut" : "scanner.transfer") : ""} onClose={() => setAction(null)}>
        <form onSubmit={runAction} className="grid gap-4">
          <Field label={action === "TRANSFER" ? t("label.source") : t("label.warehouse")}>
            <Select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
              {meta.data?.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </Select>
          </Field>
          {action === "TRANSFER" ? (
            <Field label={t("label.destination")}>
              <Select value={dest} onChange={(event) => setDest(event.target.value)}>
                {meta.data?.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
              </Select>
            </Field>
          ) : null}
          <Field label={t("label.quantity")}><TextInput type="number" min="1" value={qty} onChange={(event) => setQty(event.target.value)} /></Field>
          <Field label={t("label.notes")}><TextArea value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
          <Button type="submit" disabled={busy}>{t("action.confirm")}</Button>
        </form>
      </Modal>
    </div>
  );
}

function LookupCard({ product, onAction }: { product: Product; onAction: (action: "STOCK_IN" | "STOCK_OUT" | "TRANSFER") => void }) {
  const { t } = useI18n();
  const money = useFormat();
  const src = readProductImage(product.id, product.imageUrl);
  const price = sellingUnit(product.sellingPrice, product.discountPct);
  return (
    <div>
      <div className="flex gap-4">
        {src ? <img src={src} alt="" className="h-24 w-24 rounded-2xl object-cover" /> : <span className="grid h-24 w-24 place-items-center rounded-2xl bg-mist font-serif text-3xl text-forest">{product.name.slice(0, 1)}</span>}
        <div>
          <p className="font-serif text-3xl">{product.name}</p>
          <p className="text-sm text-ink-soft">{product.sku} · {product.category?.name}</p>
          <p className="mt-2">{t("label.cost")} {money.amount(product.costPrice)}</p>
          <p>{t("label.selling")} {money.amount(price)} · {money.other(price)}</p>
        </div>
      </div>
      {product.description ? <p className="mt-4 text-sm text-ink-soft">{product.description}</p> : null}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-ink-soft"><th className="py-2">{t("label.warehouse")}</th><th>{t("label.quantity")}</th><th>{t("label.reserved")}</th><th>{t("label.available")}</th></tr></thead>
          <tbody>
            {product.inventory?.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="py-2">{row.warehouse?.name}</td>
                <td>{row.quantity}</td>
                <td>{row.reserved}</td>
                <td>{row.quantity - row.reserved}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => onAction("STOCK_IN")}>{t("scanner.stockIn")}</Button>
        <Button variant="outline" onClick={() => onAction("STOCK_OUT")}>{t("scanner.stockOut")}</Button>
        <Button variant="subtle" onClick={() => onAction("TRANSFER")}>{t("scanner.transfer")}</Button>
      </div>
    </div>
  );
}

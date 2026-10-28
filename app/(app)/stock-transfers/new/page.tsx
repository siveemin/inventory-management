"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { blankLine, LineEditor, type DraftLine } from "@/components/lines";
import { useToast } from "@/components/providers";
import { Button, Card, Field, PageHeader, Select, TextArea } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import { useI18n } from "@/lib/settings";
import type { Meta } from "@/lib/types";

export default function NewTransferPage() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const meta = useApi<Meta>("/api/meta");
  const [pickedSource, setSource] = useState("");
  const [pickedDest, setDest] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [busy, setBusy] = useState(false);

  // Until the user picks, move stock from the first warehouse to the second.
  const source = pickedSource || meta.data?.warehouses[0]?.id || "";
  const dest = pickedDest || meta.data?.warehouses[1]?.id || "";

  async function save(status: "DRAFT" | "PENDING_APPROVAL") {
    setBusy(true);
    try {
      const transfer = await api<{ id: string }>("/api/stock-transfers", {
        method: "POST",
        body: JSON.stringify({
          sourceWarehouseId: source,
          destWarehouseId: dest,
          notes,
          status,
          items: lines.filter((line) => line.productId).map((line) => ({ productId: line.productId, quantity: Number(line.quantity) })),
        }),
      });
      router.push(`/stock-transfers/${transfer.id}`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title={t("page.newTransfer")} subtitle={t("sub.transfers")} />
      <Card className="grid gap-5 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("label.source")}>
            <Select value={source} onChange={(event) => setSource(event.target.value)}>
              {meta.data?.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </Select>
          </Field>
          <Field label={t("label.destination")}>
            <Select value={dest} onChange={(event) => setDest(event.target.value)}>
              {meta.data?.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </Select>
          </Field>
        </div>
        <LineEditor lines={lines} onChange={setLines} products={meta.data?.products || []} />
        <Field label={t("label.notes")}><TextArea value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => save("DRAFT")}>{t("action.saveDraft")}</Button>
          <Button disabled={busy} onClick={() => save("PENDING_APPROVAL")}>{t("action.submit")}</Button>
        </div>
      </Card>
    </div>
  );
}

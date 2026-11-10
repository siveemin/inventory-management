"use client";

import { useState } from "react";
import { useToast } from "./providers";
import { Button, Field, Modal, TextInput } from "./ui";
import { api } from "@/lib/client";
import { useI18n } from "@/lib/settings";

/** "+ New customer" next to a customer picker: name and phone, then it is selected. */
export function QuickCustomerButton({ onCreated }: { onCreated: (id: string) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const customer = await api<{ id: string }>("/api/customers", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      toast(t("common.saved"));
      onCreated(customer.id);
      setOpen(false);
      setName("");
      setPhone("");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-1 text-sm font-medium text-forest">
        + {t("customer.new")}
      </button>
      <Modal open={open} title={t("customer.new")} onClose={() => setOpen(false)}>
        <form onSubmit={save} className="grid gap-4">
          <Field label={t("label.name")}>
            <TextInput value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
          </Field>
          <Field label={t("label.phone")}>
            <TextInput type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
          <p className="text-xs text-ink-soft">{t("customer.newHint")}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("action.close")}</Button>
            <Button type="submit" disabled={busy || !name.trim()}>{t("action.save")}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

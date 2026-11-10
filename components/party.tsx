"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/providers";
import { Button, Card, ConfirmDialog, EmptyState, ErrorNote, Field, LoadingBlock, Modal, PageHeader, Pagination, SearchBar, Select, StatusBadge, Table, Td, TextArea, TextInput, Th } from "@/components/ui";
import { api, qs, useApi } from "@/lib/client";
import { useFormat, useI18n } from "@/lib/settings";
import type { PageResult, Party } from "@/lib/types";

const empty = { name: "", contactPerson: "", email: "", phone: "", address: "", city: "", country: "Cambodia", notes: "", status: "ACTIVE" };

export function PartyPage({ kind }: { kind: "customers" | "suppliers" }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const money = useFormat();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Party | null>(null);
  const [form, setForm] = useState(empty);
  const [remove, setRemove] = useState<Party | null>(null);
  const [busy, setBusy] = useState(false);
  const list = useApi<PageResult<Party>>(qs(`/api/${kind}`, { search, status, page }));
  const title = kind === "customers" ? t("page.customers") : t("page.suppliers");

  function start(row?: Party) {
    setEditing(row || null);
    setForm(row ? { ...empty, ...row, contactPerson: row.contactPerson || "", email: row.email || "", phone: row.phone || "", address: row.address || "", city: row.city || "", country: row.country || "Cambodia", notes: row.notes || "" } : empty);
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const saved = await api<{ id: string }>(editing ? `/api/${kind}/${editing.id}` : `/api/${kind}`, { method: editing ? "PATCH" : "POST", body: JSON.stringify(form) });
      toast(t("common.saved"));
      setOpen(false);
      // A new customer goes straight to their page, where their own prices are set.
      if (!editing && kind === "customers") router.push(`/customers/${saved.id}`);
      else list.reload();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title={title} subtitle={kind === "customers" ? t("sub.customers") : t("sub.suppliers")} actions={<Button onClick={() => start()}>{t("action.add")}</Button>} />
      <ErrorNote message={list.error} />
      <Card>
        <div className="flex flex-wrap gap-2 p-4">
          <SearchBar value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder={t("action.search")} />
          <Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="max-w-none sm:max-w-[160px]">
            <option value="">{t("label.status")}</option>
            <option value="ACTIVE">{t("status.ACTIVE")}</option>
            <option value="INACTIVE">{t("status.INACTIVE")}</option>
          </Select>
        </div>
        {list.loading ? <LoadingBlock /> : !list.data?.data.length ? <EmptyState title={t("empty.title")} body={t("empty.body")} /> : (
          <Table>
            <thead><tr><Th>{t("label.name")}</Th><Th>{t("label.email")}</Th><Th>{t("label.phone")}</Th><Th>{t("label.city")}</Th>{kind === "customers" ? <Th>{t("open.invoice")}</Th> : null}<Th>{t("label.status")}</Th><Th /></tr></thead>
            <tbody>
              {list.data.data.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <Td><Link className="font-medium text-forest" href={`/${kind}/${row.id}`}>{row.name}</Link></Td>
                  <Td>{row.email}</Td>
                  <Td>{row.phone}</Td>
                  <Td>{row.city}</Td>
                  {kind === "customers" ? (
                    <Td>
                      {row.openInvoice ? (
                        <Link href={`/sales-orders/${row.openInvoice.id}`} className="font-semibold tabular-nums text-copper">{money.amount(row.openInvoice.total)}</Link>
                      ) : <span className="text-ink-soft">—</span>}
                    </Td>
                  ) : null}
                  <Td><StatusBadge status={row.status} label={t(`status.${row.status}`)} /></Td>
                  <Td>
                    <div className="flex gap-2">
                      <Button variant="subtle" className="px-3 py-1.5" onClick={() => start(row)}>{t("action.edit")}</Button>
                      <Button variant="ghost" className="px-3 py-1.5" onClick={() => setRemove(row)}>{t("action.delete")}</Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination page={page} pageSize={list.data?.pageSize || 10} total={list.data?.total || 0} onPage={setPage} />
      </Card>
      <Modal open={open} title={editing ? t("action.edit") : t("action.add")} onClose={() => setOpen(false)} wide>
        <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
          <Field label={t("label.name")}><TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
          <Field label={t("label.contact")}><TextInput value={form.contactPerson} onChange={(event) => setForm({ ...form, contactPerson: event.target.value })} /></Field>
          <Field label={t("label.email")}><TextInput type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
          <Field label={t("label.phone")}><TextInput value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
          <Field label={t("label.city")}><TextInput value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></Field>
          <Field label={t("label.country")}><TextInput value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></Field>
          <div className="md:col-span-2"><Field label={t("label.address")}><TextInput value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field></div>
          <div className="md:col-span-2"><Field label={t("label.notes")}><TextArea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field></div>
          <Field label={t("label.status")}>
            <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="ACTIVE">{t("status.ACTIVE")}</option>
              <option value="INACTIVE">{t("status.INACTIVE")}</option>
            </Select>
          </Field>
          <div className="flex items-end justify-end gap-2">
            <Button variant="subtle" onClick={() => setOpen(false)}>{t("action.cancel")}</Button>
            <Button type="submit" disabled={busy}>{t("action.save")}</Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog open={Boolean(remove)} title={t("confirm.delete")} body={t("confirm.body")} confirmLabel={t("action.delete")} cancelLabel={t("action.cancel")} busy={busy} onClose={() => setRemove(null)} onConfirm={async () => {
        if (!remove) return;
        setBusy(true);
        try {
          await api(`/api/${kind}/${remove.id}`, { method: "DELETE" });
          setRemove(null);
          list.reload();
        } catch (error) {
          toast(error instanceof Error ? error.message : "Could not delete", "bad");
        } finally {
          setBusy(false);
        }
      }} />
    </div>
  );
}

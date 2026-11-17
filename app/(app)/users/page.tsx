"use client";

import { useState } from "react";
import { useAuth, useToast } from "@/components/providers";
import { Button, Card, EmptyState, ErrorNote, Field, LoadingBlock, Modal, PageHeader, Pagination, SearchBar, Select, StatusBadge, Switch, Table, Td, TextInput, Th } from "@/components/ui";
import { api, qs, useApi } from "@/lib/client";
import { useI18n } from "@/lib/settings";
import type { Meta, PageResult, StaffUser } from "@/lib/types";

const roles = ["ADMIN", "WAREHOUSE_MANAGER", "SALES_MANAGER", "STAFF"];
const empty = { name: "", email: "", password: "", role: "STAFF", warehouseId: "", phone: "", avatarUrl: "", status: "ACTIVE" };

export default function UsersPage() {
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  const admin = user?.role === "ADMIN";
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const meta = useApi<Meta>("/api/meta");
  const list = useApi<PageResult<StaffUser>>(qs("/api/users", { search, role, status, page }));

  function start(row?: StaffUser) {
    setEditing(row || null);
    setForm(row ? { name: row.name, email: row.email, password: "", role: row.role, warehouseId: row.warehouseId || "", phone: row.phone || "", avatarUrl: row.avatarUrl || "", status: row.status } : empty);
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(editing ? `/api/users/${editing.id}` : "/api/users", { method: editing ? "PATCH" : "POST", body: JSON.stringify(form) });
      toast(t("common.saved"));
      setOpen(false);
      list.reload();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save", "bad");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row: StaffUser) {
    if (row.id === user?.id) {
      toast("You cannot deactivate your own account.", "bad");
      return;
    }
    try {
      await api(`/api/users/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...row, password: "", status: row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
      });
      list.reload();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not update", "bad");
    }
  }

  return (
    <div>
      <PageHeader title={t("page.users")} subtitle={t("sub.users")} actions={admin ? <Button onClick={() => start()}>{t("action.add")}</Button> : null} />
      <ErrorNote message={list.error} />
      <Card>
        <div className="flex flex-wrap gap-2 p-4">
          <SearchBar value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder={t("action.search")} />
          <Select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }} className="max-w-none sm:max-w-[200px]">
            <option value="">{t("label.role")}</option>
            {roles.map((item) => <option key={item} value={item}>{t(`role.${item}`)}</option>)}
          </Select>
          <Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="max-w-none sm:max-w-[160px]">
            <option value="">{t("label.status")}</option>
            <option value="ACTIVE">{t("status.ACTIVE")}</option>
            <option value="INACTIVE">{t("status.INACTIVE")}</option>
          </Select>
        </div>
        {list.loading ? <LoadingBlock /> : !list.data?.data.length ? <EmptyState title={t("empty.title")} body={t("empty.body")} /> : (
          <Table>
            <thead><tr><Th /><Th>{t("label.name")}</Th><Th>{t("label.email")}</Th><Th>{t("label.role")}</Th><Th>{t("label.warehouse")}</Th><Th>{t("label.status")}</Th>{admin ? <Th /> : null}</tr></thead>
            <tbody>
              {list.data.data.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <Td>{row.avatarUrl ? <img src={row.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-mist font-serif">{row.name.slice(0, 1)}</span>}</Td>
                  <Td className="font-medium">{row.name}</Td>
                  <Td>{row.email}</Td>
                  <Td>{t(`role.${row.role}`)}</Td>
                  <Td>{row.warehouse?.name}</Td>
                  <Td><StatusBadge status={row.status} label={t(`status.${row.status}`)} /></Td>
                  {admin ? (
                    <Td>
                      <div className="flex items-center gap-3">
                        <Switch checked={row.status === "ACTIVE"} onChange={() => toggle(row)} label={t("label.status")} />
                        <Button variant="subtle" className="px-3 py-1.5" onClick={() => start(row)}>{t("action.edit")}</Button>
                      </div>
                    </Td>
                  ) : null}
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
          <Field label={t("label.email")}><TextInput type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></Field>
          <Field label={t("label.password")} hint={editing ? "Leave blank to keep the current password" : undefined}>
            <TextInput type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!editing} />
          </Field>
          <Field label={t("label.phone")}><TextInput value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
          <Field label={t("label.role")}>
            <Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              {roles.map((item) => <option key={item} value={item}>{t(`role.${item}`)}</option>)}
            </Select>
          </Field>
          <Field label={t("label.warehouse")}>
            <Select value={form.warehouseId} onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}>
              <option value="">—</option>
              {meta.data?.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </Select>
          </Field>
          <Field label={t("label.avatarUrl")}><TextInput value={form.avatarUrl} onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })} /></Field>
          <Field label={t("label.status")}>
            <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="ACTIVE">{t("status.ACTIVE")}</option>
              <option value="INACTIVE">{t("status.INACTIVE")}</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button variant="subtle" onClick={() => setOpen(false)}>{t("action.cancel")}</Button>
            <Button type="submit" disabled={busy}>{t("action.save")}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

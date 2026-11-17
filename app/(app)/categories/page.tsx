"use client";

import { useState } from "react";
import { useToast } from "@/components/providers";
import { Button, Card, ConfirmDialog, EmptyState, ErrorNote, Field, LoadingBlock, Modal, PageHeader, Pagination, SearchBar, Table, Td, TextArea, TextInput, Th } from "@/components/ui";
import { api, qs, useApi } from "@/lib/client";
import { useI18n } from "@/lib/settings";
import type { Category, PageResult } from "@/lib/types";

export default function CategoriesPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [remove, setRemove] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);
  const list = useApi<PageResult<Category>>(qs("/api/categories", { search, page }));

  function start(category?: Category) {
    setEditing(category || null);
    setName(category?.name || "");
    setDescription(category?.description || "");
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(editing ? `/api/categories/${editing.id}` : "/api/categories", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({ name, description }),
      });
      toast(t("common.saved"));
      setOpen(false);
      list.reload();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title={t("page.categories")} subtitle={t("sub.categories")} actions={<Button onClick={() => start()}>{t("action.add")}</Button>} />
      <ErrorNote message={list.error} />
      <Card>
        <div className="p-4"><SearchBar value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder={t("action.search")} /></div>
        {list.loading ? <LoadingBlock /> : !list.data?.data.length ? <EmptyState title={t("empty.title")} body={t("empty.body")} /> : (
          <Table>
            <thead><tr><Th>{t("label.name")}</Th><Th>{t("label.slug")}</Th><Th>{t("label.description")}</Th><Th>{t("label.count")}</Th><Th /></tr></thead>
            <tbody>
              {list.data.data.map((category) => (
                <tr key={category.id} className="border-t border-line">
                  <Td className="font-medium">{category.name}</Td>
                  <Td>{category.slug}</Td>
                  <Td>{category.description}</Td>
                  <Td className="tabular-nums">{category._count?.products || 0}</Td>
                  <Td>
                    <div className="flex gap-2">
                      <Button variant="subtle" className="px-3 py-1.5" onClick={() => start(category)}>{t("action.edit")}</Button>
                      <Button variant="ghost" className="px-3 py-1.5" onClick={() => setRemove(category)}>{t("action.delete")}</Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination page={page} pageSize={list.data?.pageSize || 10} total={list.data?.total || 0} onPage={setPage} />
      </Card>
      <Modal open={open} title={editing ? t("action.edit") : t("action.add")} onClose={() => setOpen(false)}>
        <form onSubmit={save} className="grid gap-4">
          <Field label={t("label.name")}><TextInput value={name} onChange={(event) => setName(event.target.value)} required /></Field>
          <Field label={t("label.slug")} hint={t("category.slugHint")}><TextInput value={name.toLowerCase().trim().replace(/\s+/g, "-")} readOnly /></Field>
          <Field label={t("label.description")}><TextArea value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="subtle" onClick={() => setOpen(false)}>{t("action.cancel")}</Button>
            <Button type="submit" disabled={busy}>{t("action.save")}</Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(remove)}
        title={t("confirm.delete")}
        body={t("confirm.body")}
        confirmLabel={t("action.delete")}
        cancelLabel={t("action.cancel")}
        busy={busy}
        onClose={() => setRemove(null)}
        onConfirm={async () => {
          if (!remove) return;
          setBusy(true);
          try {
            await api(`/api/categories/${remove.id}`, { method: "DELETE" });
            setRemove(null);
            list.reload();
          } catch (error) {
            toast(error instanceof Error ? error.message : "Could not delete", "bad");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

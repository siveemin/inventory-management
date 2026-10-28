"use client";

import { useState } from "react";
import { Card, EmptyState, ErrorNote, LoadingBlock, PageHeader, Pagination, Select, Table, Td, Th } from "@/components/ui";
import { qs, useApi } from "@/lib/client";
import { toDateInput } from "@/lib/format";
import { useFormat, useI18n } from "@/lib/settings";
import type { AuditRow, PageResult, StaffUser } from "@/lib/types";

const actions = ["CREATE", "UPDATE", "DELETE", "LOGIN", "STATUS_CHANGE", "STOCK_ADJUST", "RECEIVE"];
const resources = ["PRODUCT", "CATEGORY", "CUSTOMER", "SUPPLIER", "USER", "PURCHASE_ORDER", "SALES_ORDER", "STOCK_TRANSFER", "INVENTORY"];

export default function AuditPage() {
  const { t } = useI18n();
  const money = useFormat();
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [from, setFrom] = useState(() => toDateInput(new Date(Date.now() - 90 * 86400000)));
  const [to, setTo] = useState(() => toDateInput());
  const [page, setPage] = useState(1);
  const users = useApi<PageResult<StaffUser>>("/api/users?pageSize=100");
  const list = useApi<PageResult<AuditRow>>(qs("/api/audit-logs", { userId, action, resourceType, from, to, page }));

  return (
    <div>
      <PageHeader title={t("page.audit")} subtitle={t("sub.audit")} />
      <ErrorNote message={list.error} />
      <Card>
        <div className="flex flex-wrap gap-2 p-4">
          <Select value={userId} onChange={(event) => { setUserId(event.target.value); setPage(1); }} className="max-w-none sm:max-w-[180px]">
            <option value="">{t("label.user")}</option>
            {users.data?.data.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </Select>
          <Select value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} className="max-w-none sm:max-w-[180px]">
            <option value="">{t("label.type")}</option>
            {actions.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
          <Select value={resourceType} onChange={(event) => { setResourceType(event.target.value); setPage(1); }} className="max-w-none sm:max-w-[200px]">
            <option value="">{t("label.resource")}</option>
            {resources.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
          <input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} className="rounded-xl border border-line bg-white px-3 py-2 text-sm" />
          <input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} className="rounded-xl border border-line bg-white px-3 py-2 text-sm" />
        </div>
        {list.loading ? <LoadingBlock /> : !list.data?.data.length ? <EmptyState title={t("empty.title")} body={t("empty.body")} /> : (
          <Table>
            <thead><tr><Th>{t("label.date")}</Th><Th>{t("label.user")}</Th><Th>{t("label.type")}</Th><Th>{t("label.resource")}</Th><Th>ID</Th><Th>{t("label.description")}</Th></tr></thead>
            <tbody>
              {list.data.data.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <Td>{money.dateTime(row.createdAt)}</Td>
                  <Td>{row.user?.name || "—"}</Td>
                  <Td>{row.action}</Td>
                  <Td>{row.resourceType}</Td>
                  <Td className="max-w-[120px] truncate text-xs">{row.resourceId}</Td>
                  <Td>{row.description}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination page={page} pageSize={list.data?.pageSize || 10} total={list.data?.total || 0} onPage={setPage} />
      </Card>
    </div>
  );
}

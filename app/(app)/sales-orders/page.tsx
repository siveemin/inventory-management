"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, EmptyState, ErrorNote, LoadingBlock, PageHeader, Pagination, SearchBar, Select, StatusBadge, Table, Td, Th } from "@/components/ui";
import { qs, useApi } from "@/lib/client";
import { useFormat, useI18n } from "@/lib/settings";
import type { Meta, PageResult, SalesOrder } from "@/lib/types";

const statuses = ["DRAFT", "CONFIRMED", "PROCESSING", "COMPLETED", "CANCELLED"];

export default function SalesOrdersPage() {
  const { t } = useI18n();
  const money = useFormat();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [page, setPage] = useState(1);
  const meta = useApi<Meta>("/api/meta");
  const list = useApi<PageResult<SalesOrder>>(qs("/api/sales-orders", { search, status, customerId, page }));

  return (
    <div>
      <PageHeader title={t("page.sales")} subtitle={t("sub.sales")} actions={<Link href="/sales-orders/new"><Button>{t("action.add")}</Button></Link>} />
      <ErrorNote message={list.error} />
      <Card>
        <div className="flex flex-wrap gap-2 p-4">
          <SearchBar value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder={t("label.order")} />
          <Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="max-w-none sm:max-w-[180px]">
            <option value="">{t("label.status")}</option>
            {statuses.map((item) => <option key={item} value={item}>{t(`status.${item}`)}</option>)}
          </Select>
          <Select value={customerId} onChange={(event) => { setCustomerId(event.target.value); setPage(1); }} className="max-w-none sm:max-w-[200px]">
            <option value="">{t("label.customer")}</option>
            <option value="WALKIN">{t("label.walkIn")}</option>
            {meta.data?.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </Select>
        </div>
        {list.loading ? <LoadingBlock /> : !list.data?.data.length ? <EmptyState title={t("empty.title")} body={t("empty.body")} /> : (
          <Table>
            <thead><tr><Th>{t("label.order")}</Th><Th>{t("label.customer")}</Th><Th>{t("label.warehouse")}</Th><Th>{t("label.date")}</Th><Th>{t("label.status")}</Th><Th>{t("label.total")}</Th></tr></thead>
            <tbody>
              {list.data.data.map((order) => (
                <tr key={order.id} className="border-t border-line">
                  <Td>
                    <Link className="font-medium text-forest" href={`/sales-orders/${order.id}`}>{order.orderNumber}</Link>
                    {order.kind === "CONSIGN" ? <div className="text-xs text-ink-soft">{t("kind.CONSIGN")}</div> : null}
                  </Td>
                  <Td>{order.customer?.name || t("label.walkIn")}</Td>
                  <Td>{order.warehouse?.name}</Td>
                  <Td>{money.date(order.orderDate)}</Td>
                  <Td><StatusBadge status={order.status} label={t(`status.${order.status}`)} /></Td>
                  <Td className="tabular-nums">{money.amount(order.total)}</Td>
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

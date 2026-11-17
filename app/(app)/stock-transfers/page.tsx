"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, EmptyState, ErrorNote, LoadingBlock, PageHeader, Pagination, SearchBar, Select, StatusBadge, Table, Td, Th } from "@/components/ui";
import { qs, useApi } from "@/lib/client";
import { useFormat, useI18n } from "@/lib/settings";
import type { Meta, PageResult, StockTransfer } from "@/lib/types";

const statuses = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "IN_TRANSIT", "RECEIVED", "CANCELLED"];

export default function TransfersPage() {
  const { t } = useI18n();
  const money = useFormat();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [page, setPage] = useState(1);
  const meta = useApi<Meta>("/api/meta");
  const list = useApi<PageResult<StockTransfer>>(qs("/api/stock-transfers", { search, status, warehouseId, page }));

  return (
    <div>
      <PageHeader title={t("page.transfers")} subtitle={t("sub.transfers")} actions={<Link href="/stock-transfers/new"><Button>{t("action.add")}</Button></Link>} />
      <ErrorNote message={list.error} />
      <Card>
        <div className="flex flex-wrap gap-2 p-4">
          <SearchBar value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder={t("label.order")} />
          <Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="max-w-none sm:max-w-[180px]">
            <option value="">{t("label.status")}</option>
            {statuses.map((item) => <option key={item} value={item}>{t(`status.${item}`)}</option>)}
          </Select>
          <Select value={warehouseId} onChange={(event) => { setWarehouseId(event.target.value); setPage(1); }} className="max-w-none sm:max-w-[220px]">
            <option value="">{t("label.warehouse")}</option>
            {meta.data?.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
          </Select>
        </div>
        {list.loading ? <LoadingBlock /> : !list.data?.data.length ? <EmptyState title={t("empty.title")} body={t("empty.body")} /> : (
          <Table>
            <thead><tr><Th>{t("label.order")}</Th><Th>{t("label.source")}</Th><Th>{t("label.destination")}</Th><Th>{t("label.status")}</Th><Th>{t("label.date")}</Th></tr></thead>
            <tbody>
              {list.data.data.map((transfer) => (
                <tr key={transfer.id} className="border-t border-line">
                  <Td><Link className="whitespace-nowrap font-medium text-forest" href={`/stock-transfers/${transfer.id}`}>{transfer.transferNumber}</Link></Td>
                  <Td>{transfer.sourceWarehouse?.name}</Td>
                  <Td>{transfer.destWarehouse?.name}</Td>
                  <Td><StatusBadge status={transfer.status} label={t(`status.${transfer.status}`)} /></Td>
                  <Td>{money.date(transfer.transferDate)}</Td>
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

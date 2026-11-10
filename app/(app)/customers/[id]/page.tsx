"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CustomerHistory } from "@/components/customer-history";
import { CustomerPricesCard } from "@/components/customer-prices";
import { OpenInvoiceCard } from "@/components/open-invoice";
import { Card, ErrorNote, LoadingBlock, PageHeader, StatusBadge } from "@/components/ui";
import { useApi } from "@/lib/client";
import { useI18n } from "@/lib/settings";
import type { Party } from "@/lib/types";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const { t } = useI18n();
  const customer = useApi<Party>(`/api/customers/${params.id}`);
  const data = customer.data;
  return (
    <div>
      <Link href="/customers" className="text-sm text-forest">{t("action.back")}</Link>
      <ErrorNote message={customer.error} />
      {!data ? <LoadingBlock /> : (
        <>
          <PageHeader title={data.name} subtitle={[data.city, data.phone, data.email].filter(Boolean).join(" · ")} actions={<StatusBadge status={data.status} label={t(`status.${data.status}`)} />} />
          <Card className="mb-4 p-5 text-sm">
            <p>{data.contactPerson}</p>
            <p>{data.address}</p>
            {data.notes ? <p className="mt-2 text-ink-soft">{data.notes}</p> : null}
          </Card>
          <OpenInvoiceCard customerId={data.id} />
          <CustomerPricesCard customerId={data.id} />
          <CustomerHistory customerId={data.id} />
        </>
      )}
    </div>
  );
}

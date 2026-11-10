"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, ErrorNote, LoadingBlock, PageHeader, StatusBadge, Table, Td, Th } from "@/components/ui";
import { useApi } from "@/lib/client";
import { useFormat, useI18n } from "@/lib/settings";
import type { Party, Product, PurchaseOrder } from "@/lib/types";

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const { t } = useI18n();
  const money = useFormat();
  const supplier = useApi<Party & { purchaseOrders: PurchaseOrder[]; products: Product[] }>(`/api/suppliers/${params.id}`);
  const data = supplier.data;
  return (
    <div>
      <Link href="/suppliers" className="text-sm text-forest">{t("action.back")}</Link>
      <ErrorNote message={supplier.error} />
      {!data ? <LoadingBlock /> : (
        <>
          <PageHeader title={data.name} subtitle={[data.city, data.phone, data.email].filter(Boolean).join(" · ")} actions={<StatusBadge status={data.status} label={t(`status.${data.status}`)} />} />
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <h2 className="px-5 pt-5 font-serif text-2xl">{t("nav.purchase")}</h2>
              <Table>
                <thead><tr><Th>{t("label.order")}</Th><Th>{t("label.status")}</Th><Th>{t("label.total")}</Th></tr></thead>
                <tbody>
                  {data.purchaseOrders.map((order) => (
                    <tr key={order.id} className="border-t border-line">
                      <Td><Link className="text-forest" href={`/purchase-orders/${order.id}`}>{order.orderNumber}</Link></Td>
                      <Td><StatusBadge status={order.status} label={t(`status.${order.status}`)} /></Td>
                      <Td>{money.amount(order.total)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
            <Card>
              <h2 className="px-5 pt-5 font-serif text-2xl">{t("nav.products")}</h2>
              <Table>
                <thead><tr><Th>{t("label.name")}</Th><Th>{t("label.sku")}</Th><Th>{t("label.cost")}</Th></tr></thead>
                <tbody>
                  {data.products.map((product) => (
                    <tr key={product.id} className="border-t border-line">
                      <Td>{product.name}</Td>
                      <Td>{product.sku}</Td>
                      <Td>{money.amount(product.costPrice)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

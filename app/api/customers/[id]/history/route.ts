import { Prisma } from "@prisma/client";
import { authed, ok, readPage } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

const SOLD = ["CONFIRMED", "PROCESSING", "COMPLETED"];
const OPEN = ["CONFIRMED", "PROCESSING"];

/** A customer's full order history plus lifetime totals. ?filter=CONSIGN|UNPAID */
export async function GET(req: Request, ctx: Ctx) {
  return authed(req, async () => {
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const { page, pageSize, skip } = readPage(url);
    const filter = url.searchParams.get("filter");

    const where: Prisma.SalesOrderWhereInput = { customerId: id };
    if (filter === "CONSIGN") where.kind = "CONSIGN";
    // Unpaid = take-and-return orders the customer still has open.
    if (filter === "UNPAID") Object.assign(where, { kind: "CONSIGN", status: { in: OPEN } });

    const [total, data, spent, owed, last] = await Promise.all([
      prisma.salesOrder.count({ where }),
      prisma.salesOrder.findMany({
        where,
        orderBy: { orderDate: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          orderNumber: true,
          orderDate: true,
          status: true,
          kind: true,
          total: true,
          warehouse: { select: { name: true } },
          items: {
            select: {
              id: true,
              quantity: true,
              returnedQty: true,
              unitPrice: true,
              product: { select: { name: true, sku: true } },
            },
          },
        },
      }),
      prisma.salesOrder.aggregate({ where: { customerId: id, status: { in: SOLD } }, _sum: { total: true }, _count: true }),
      prisma.salesOrder.aggregate({ where: { customerId: id, kind: "CONSIGN", status: { in: OPEN } }, _sum: { total: true }, _count: true }),
      prisma.salesOrder.findFirst({ where: { customerId: id, status: { not: "CANCELLED" } }, orderBy: { orderDate: "desc" }, select: { orderDate: true } }),
    ]);

    return ok({
      data,
      total,
      page,
      pageSize,
      summary: {
        orders: spent._count,
        spent: spent._sum.total || 0,
        owed: owed._sum.total || 0,
        openOrders: owed._count,
        lastVisit: last?.orderDate || null,
      },
    });
  });
}

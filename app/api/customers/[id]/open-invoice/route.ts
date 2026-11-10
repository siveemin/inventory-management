import { authed, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

/** The customer's open (unpaid) take & return invoice, or { data: null }. */
export async function GET(req: Request, ctx: Ctx) {
  return authed(req, async () => {
    const { id } = await ctx.params;
    const data = await prisma.salesOrder.findFirst({
      where: { customerId: id, kind: "CONSIGN", status: { in: ["CONFIRMED", "PROCESSING"] } },
      orderBy: { orderDate: "desc" },
      select: { id: true, orderNumber: true, orderDate: true, total: true, warehouseId: true, _count: { select: { items: true } } },
    });
    return ok({ data });
  });
}

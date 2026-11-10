import { transitionSalesOrder } from "@/lib/domain";
import { authed, ok, readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

const include = {
  customer: true,
  warehouse: true,
  items: { orderBy: { createdAt: "asc" as const }, include: { product: { select: { id: true, name: true, sku: true } } } },
};

export async function GET(req: Request, ctx: Ctx) {
  return authed(req, async () => {
    const order = await prisma.salesOrder.findUnique({ where: { id: (await ctx.params).id }, include });
    if (!order) return ok({ error: "Sales order not found." }, 404);
    return ok(order);
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  return authed(req, async (user) => {
    const body = await readJson<Record<string, unknown>>(req);
    return ok(await transitionSalesOrder((await ctx.params).id, String(body.action || ""), user.id, body));
  });
}

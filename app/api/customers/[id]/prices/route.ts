import { setCustomerPrice, setCustomerPrices } from "@/lib/domain";
import { authed, ok, readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return authed(req, async () => {
    const { id } = await ctx.params;
    const data = await prisma.customerPrice.findMany({
      where: { customerId: id },
      select: {
        id: true,
        customerId: true,
        productId: true,
        price: true,
        product: { select: { name: true, sku: true, sellingPrice: true, discountPct: true } },
      },
      orderBy: { product: { name: "asc" } },
    });
    return ok({ data });
  });
}

/**
 * Body: { productId, price } for one product, or { prices: [{ productId, price }] }
 * for a whole price list. A null or empty price removes the special price.
 */
export async function PUT(req: Request, ctx: Ctx) {
  return authed(req, async (user) => {
    const id = (await ctx.params).id;
    const body = await readJson<Record<string, unknown>>(req);
    if (Array.isArray(body.prices)) return ok(await setCustomerPrices(id, body.prices, user.id));
    return ok(await setCustomerPrice(id, body, user.id));
  });
}

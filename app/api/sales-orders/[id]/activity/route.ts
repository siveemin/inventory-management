import { authed, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

/**
 * Day-and-hour log of an order: every stock movement it caused (taken, returned,
 * corrected, cancelled), oldest first, with who recorded it.
 */
export async function GET(req: Request, ctx: Ctx) {
  return authed(req, async () => {
    const { id } = await ctx.params;
    const data = await prisma.inventoryTransaction.findMany({
      where: { referenceType: "SALES_ORDER", referenceId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        type: true,
        quantity: true,
        notes: true,
        createdAt: true,
        product: { select: { name: true } },
        user: { select: { name: true } },
      },
    });
    return ok({ data });
  });
}

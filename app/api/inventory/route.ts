import { Prisma } from "@prisma/client";
import { HIDDEN_PRODUCT } from "@/lib/domain";
import { authed, ok, readPage, textSearch } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  return authed(req, async () => {
    const url = new URL(req.url);
    const { page, pageSize, skip, search } = readPage(url);
    const and: Prisma.ProductInventoryWhereInput[] = [{ product: { status: { not: HIDDEN_PRODUCT } } }];
    const warehouseId = url.searchParams.get("warehouseId");
    if (warehouseId) and.push({ warehouseId });
    if (search) {
      and.push({ product: { OR: [{ name: textSearch(search) }, { sku: textSearch(search) }] } });
    }
    const where = { AND: and };
    const [total, data] = await Promise.all([
      prisma.productInventory.count({ where }),
      prisma.productInventory.findMany({
        where,
        include: { product: true, warehouse: true },
        orderBy: [{ product: { name: "asc" } }, { warehouse: { name: "asc" } }],
        skip,
        take: pageSize,
      }),
    ]);
    return ok({ data, total, page, pageSize });
  });
}

import { Prisma } from "@prisma/client";
import { createProduct, HIDDEN_PRODUCT } from "@/lib/domain";
import { authed, ok, readJson, readPage, textSearch } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  return authed(req, async () => {
    const url = new URL(req.url);
    const { page, pageSize, skip, search } = readPage(url);
    const and: Prisma.ProductWhereInput[] = [];
    if (search) {
      and.push({
        OR: [{ name: textSearch(search) }, { sku: textSearch(search) }, { barcode: textSearch(search) }],
      });
    }
    const categoryId = url.searchParams.get("categoryId");
    const supplierId = url.searchParams.get("supplierId");
    const status = url.searchParams.get("status");
    if (categoryId) and.push({ categoryId });
    if (supplierId) and.push({ supplierId });
    if (status) and.push({ status });
    // Deleted products that old orders still use stay out of the list.
    else and.push({ status: { not: HIDDEN_PRODUCT } });
    const where = and.length ? { AND: and } : {};
    const [total, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          supplier: { select: { id: true, name: true } },
          inventory: { select: { quantity: true } },
        },
        orderBy: { name: "asc" },
        skip,
        take: pageSize,
      }),
    ]);
    const data = rows.map(({ inventory, ...product }) => ({
      ...product,
      totalStock: inventory.reduce((sum, row) => sum + row.quantity, 0),
    }));
    return ok({ data, total, page, pageSize });
  });
}

export async function POST(req: Request) {
  return authed(req, async (user) => {
    const body = await readJson<Record<string, unknown>>(req);
    return ok(await createProduct(body, user.id), 201);
  });
}

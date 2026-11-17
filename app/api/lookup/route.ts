import { HIDDEN_PRODUCT } from "@/lib/domain";
import { authed, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const include = {
  category: true,
  supplier: true,
  inventory: { include: { warehouse: true }, orderBy: { warehouse: { name: "asc" as const } } },
};

export async function GET(req: Request) {
  return authed(req, async () => {
    const code = new URL(req.url).searchParams.get("code")?.trim();
    if (!code) return ok({ error: "Enter a barcode or SKU." }, 400);
    let product = await prisma.product.findFirst({
      where: { status: { not: HIDDEN_PRODUCT }, OR: [{ barcode: code }, { sku: code }] },
      include,
    });
    if (!product) {
      const all = await prisma.product.findMany({ where: { status: { not: HIDDEN_PRODUCT } }, include });
      const needle = code.toLowerCase();
      product = all.find((row) => row.sku.toLowerCase() === needle || (row.barcode || "").toLowerCase() === needle) || null;
    }
    if (!product) return ok({ error: "Not found" }, 404);
    return ok(product);
  });
}

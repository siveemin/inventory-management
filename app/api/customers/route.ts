import { createCustomer } from "@/lib/domain";
import { authed, ok, readJson, readPage, textSearch } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  return authed(req, async () => {
    const url = new URL(req.url);
    const { page, pageSize, skip, search } = readPage(url);
    const status = url.searchParams.get("status");
    const where = {
      ...(status ? { status } : {}),
      ...(search
        ? { OR: [{ name: textSearch(search) }, { email: textSearch(search) }, { phone: textSearch(search) }, { city: textSearch(search) }] }
        : {}),
    };
    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: pageSize,
        include: {
          // Each customer's open (unpaid) take & return invoice, for the list.
          salesOrders: {
            where: { kind: "CONSIGN", status: { in: ["CONFIRMED", "PROCESSING"] } },
            select: { id: true, total: true },
            take: 1,
          },
        },
      }),
    ]);
    const data = customers.map(({ salesOrders, ...customer }) => ({ ...customer, openInvoice: salesOrders[0] || null }));
    return ok({ data, total, page, pageSize });
  });
}

export async function POST(req: Request) {
  return authed(req, async (user) => ok(await createCustomer(await readJson(req), user.id), 201));
}

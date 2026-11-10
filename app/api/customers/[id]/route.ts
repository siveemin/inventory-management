import { deleteCustomer, updateCustomer } from "@/lib/domain";
import { authed, ok, readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return authed(req, async () => {
    const { id } = await ctx.params;
    // Orders come from /api/customers/[id]/history, which pages through all of them.
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) return ok({ error: "Customer not found." }, 404);
    return ok(customer);
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  return authed(req, async (user) => ok(await updateCustomer((await ctx.params).id, await readJson(req), user.id)));
}

export async function DELETE(req: Request, ctx: Ctx) {
  return authed(req, async (user) => ok(await deleteCustomer((await ctx.params).id, user.id)));
}

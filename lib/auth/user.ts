import { prisma } from "@/lib/prisma";
import { auth } from "./server";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  avatarUrl: string | null;
  status: string;
  warehouseId: string | null;
  warehouse: { id: string; name: string; code: string } | null;
};

// Every API call checks the user's row. Keep it for a short while so a page
// that fires several requests pays for the lookup once instead of each time.
const USER_TTL_MS = 30_000;
const userCache = new Map<string, { user: AuthUser | null; at: number }>();

/** Drop cached rows after a user is edited, so role or status changes apply at once. */
export function clearUserCache() {
  userCache.clear();
}

async function loadUser(email: string): Promise<AuthUser | null> {
  const hit = userCache.get(email);
  if (hit && Date.now() - hit.at < USER_TTL_MS) return hit.user;
  const user = await prisma.user.findUnique({
    where: { email },
    include: { warehouse: { select: { id: true, name: true, code: true } } },
  });
  let safe: AuthUser | null = null;
  if (user && user.status === "ACTIVE") {
    const { password: _password, ...rest } = user;
    safe = rest;
  }
  userCache.set(email, { user: safe, at: Date.now() });
  return safe;
}

export async function getUserFromRequest(_req: Request): Promise<AuthUser | null> {
  const { data: session } = await auth.getSession();
  const neonUser = session?.user;
  const email = neonUser?.email?.toLowerCase();
  if (!neonUser || !email) return null;

  // Only people an admin added on the Users page may use the app; a bare
  // Neon Auth account (e.g. from a public sign-up) gets no access.
  return loadUser(email);
}

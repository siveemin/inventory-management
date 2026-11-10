import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Neon's pooler supports prepared statements, so Prisma's `pgbouncer=true`
 * fallback only adds round trips, and `channel_binding` makes the query engine
 * stall. Measured: ~240 ms (spikes to 4 s) per query with them,
 * ~47 ms without. TLS (`sslmode=require`) stays on.
 */
function pooledUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    url.searchParams.delete("pgbouncer");
    url.searchParams.delete("channel_binding");
    // Prisma gives up connecting after 5 s by default; on a slow or flaky line a
    // new connection to Neon can take longer, which failed whole pages.
    if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "20");
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "20");
    return url.toString();
  } catch {
    return raw;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: pooledUrl(),
    // Saving an order moves stock line by line (several round trips each). The
    // default 5 s limit can expire on a slow connection and lose the save.
    transactionOptions: { maxWait: 10_000, timeout: 30_000 },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

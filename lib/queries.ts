import { dayKey } from "./format";
import { readRange } from "./http";
import { prisma } from "./prisma";

const soldStatuses = ["CONFIRMED", "PROCESSING", "COMPLETED"];

export async function lowStockRows() {
  const rows = await prisma.productInventory.findMany({
    select: {
      id: true,
      productId: true,
      warehouseId: true,
      quantity: true,
      updatedAt: true,
      product: { select: { name: true, sku: true, status: true, minStock: true, supplierId: true } },
      warehouse: { select: { name: true } },
    },
    // Only rows that can be short: skip products with no minimum set.
    where: { product: { status: "ACTIVE", minStock: { gt: 0 } } },
    orderBy: { updatedAt: "desc" },
  });
  return rows
    .filter((row) => row.product.status === "ACTIVE" && row.quantity < row.product.minStock)
    .map((row) => ({
      id: row.id,
      productId: row.productId,
      warehouseId: row.warehouseId,
      supplierId: row.product.supplierId,
      product: row.product.name,
      sku: row.product.sku,
      warehouse: row.warehouse.name,
      quantity: row.quantity,
      minStock: row.product.minStock,
      shortage: row.product.minStock - row.quantity,
      updatedAt: row.updatedAt,
      level: row.quantity <= 0 ? ("critical" as const) : ("warning" as const),
    }))
    .sort((a, b) => b.shortage - a.shortage);
}

export async function dashboardData() {
  const start = new Date();
  start.setDate(start.getDate() - 29);
  // One parallel round instead of five sequential trips to the database.
  const [products, low, openPurchases, openSales, sales, activity] = await Promise.all([
    prisma.product.findMany({
      select: {
        costPrice: true,
        category: { select: { name: true } },
        inventory: { select: { quantity: true } },
      },
    }),
    lowStockRows(),
    prisma.purchaseOrder.count({ where: { status: { in: ["SUBMITTED", "APPROVED", "PARTIALLY_RECEIVED"] } } }),
    prisma.salesOrder.count({ where: { status: { in: ["CONFIRMED", "PROCESSING"] } } }),
    prisma.salesOrder.findMany({
      where: { status: { in: soldStatuses }, orderDate: { gte: start } },
      select: { orderDate: true, total: true },
    }),
    prisma.inventoryTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        type: true,
        quantity: true,
        createdAt: true,
        product: { select: { name: true } },
        warehouse: { select: { name: true } },
      },
    }),
  ]);
  const byCategory = new Map<string, number>();
  let stockValue = 0;
  for (const product of products) {
    const qty = product.inventory.reduce((sum, row) => sum + row.quantity, 0);
    stockValue += qty * product.costPrice;
    byCategory.set(product.category.name, (byCategory.get(product.category.name) || 0) + qty);
  }
  const today = dayKey(new Date());
  const keys: string[] = [];
  for (let i = 29; i >= 0; i--) keys.push(shiftDay(today, -i));
  const buckets = new Map(keys.map((key) => [key, 0]));
  for (const order of sales) {
    const key = dayKey(order.orderDate);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + order.total);
  }
  return {
    kpis: {
      products: products.length,
      stockValue,
      lowStock: low.length,
      pendingOrders: openPurchases + openSales,
    },
    stockByCategory: [...byCategory.entries()]
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 6),
    sales: [...buckets.entries()].map(([date, total]) => ({ date, label: date.slice(5), total })),
    activity: activity.map((row) => ({
      id: row.id,
      product: row.product.name,
      type: row.type,
      quantity: row.quantity,
      warehouse: row.warehouse.name,
      createdAt: row.createdAt,
    })),
    lowStock: low.slice(0, 5),
  };
}

function shiftDay(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export async function forecastData() {
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const [sold, products] = await Promise.all([
    prisma.salesOrderItem.findMany({
      where: { order: { status: { in: soldStatuses }, orderDate: { gte: since } } },
    }),
    prisma.product.findMany({ where: { status: "ACTIVE" }, include: { inventory: true }, orderBy: { name: "asc" } }),
  ]);
  const qtyByProduct = new Map<string, number>();
  for (const item of sold) qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) || 0) + item.quantity - item.returnedQty);
  const items = products.map((product) => {
    const soldQty = qtyByProduct.get(product.id) || 0;
    const dailyAvg = soldQty / 90;
    const currentStock = product.inventory.reduce((sum, row) => sum + row.quantity, 0);
    const demand7 = dailyAvg * 7;
    const demand30 = dailyAvg * 30;
    const daysRemaining = dailyAvg > 0 ? currentStock / dailyAvg : null;
    const reorderQty = Math.max(0, Math.ceil(Math.max(demand30, product.minStock) - currentStock));
    let signal: "healthy" | "soon" | "critical" = "healthy";
    if (currentStock <= 0 || (daysRemaining !== null && daysRemaining < 7)) signal = "critical";
    else if (currentStock < product.minStock || (daysRemaining !== null && daysRemaining < 21)) signal = "soon";
    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      dailyAvg,
      demand7,
      demand30,
      currentStock,
      daysRemaining,
      reorderQty,
      signal,
    };
  });
  const rank = { critical: 0, soon: 1, healthy: 2 };
  items.sort((a, b) => rank[a.signal] - rank[b.signal] || a.name.localeCompare(b.name));
  return { generatedAt: new Date().toISOString(), items };
}

export async function reportData(url: URL) {
  const tab = url.searchParams.get("tab") || "sales";
  const { from, to } = readRange(url);
  if (tab === "inventory") {
    const products = await prisma.product.findMany({ include: { category: true, inventory: true } });
    const low = await lowStockRows();
    const categories = new Map<string, number>();
    let value = 0;
    for (const product of products) {
      const qty = product.inventory.reduce((sum, row) => sum + row.quantity, 0);
      const amount = qty * product.costPrice;
      value += amount;
      categories.set(product.category.name, (categories.get(product.category.name) || 0) + amount);
    }
    return {
      tab,
      skus: products.length,
      value,
      lowStock: low.length,
      categories: [...categories.entries()].map(([name, amount]) => ({ name, amount })),
    };
  }
  if (tab === "movement") {
    const page = Math.max(1, Number(url.searchParams.get("page") || 1) || 1);
    const pageSize = 12;
    const type = url.searchParams.get("type") || "";
    const warehouseId = url.searchParams.get("warehouseId") || "";
    const where = {
      createdAt: { gte: from, lte: to },
      ...(type ? { type } : {}),
      ...(warehouseId ? { warehouseId } : {}),
    };
    const [total, data] = await Promise.all([
      prisma.inventoryTransaction.count({ where }),
      prisma.inventoryTransaction.findMany({
        where,
        include: { product: true, warehouse: true, user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { tab, data, total, page, pageSize, from, to };
  }
  if (tab === "top") {
    const items = await prisma.salesOrderItem.findMany({
      where: { order: { status: { in: soldStatuses }, orderDate: { gte: from, lte: to } } },
      include: { product: true },
    });
    const map = new Map<string, { name: string; sku: string; quantity: number; revenue: number }>();
    for (const item of items) {
      const current = map.get(item.productId) || { name: item.product.name, sku: item.product.sku, quantity: 0, revenue: 0 };
      current.quantity += item.quantity - item.returnedQty;
      current.revenue += (item.quantity - item.returnedQty) * item.unitPrice;
      map.set(item.productId, current);
    }
    return {
      tab,
      from,
      to,
      products: [...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10),
    };
  }
  const orders = await prisma.salesOrder.findMany({
    where: { status: { in: soldStatuses }, orderDate: { gte: from, lte: to } },
  });
  const revenue = orders.reduce((sum, order) => sum + order.total, 0);
  const map = new Map<string, number>();
  for (const order of orders) {
    const key = dayKey(order.orderDate);
    map.set(key, (map.get(key) || 0) + order.total);
  }
  const series = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, total]) => ({ date, label: date.slice(5), total }));
  return {
    tab: "sales",
    from,
    to,
    revenue,
    orders: orders.length,
    average: orders.length ? revenue / orders.length : 0,
    series,
  };
}

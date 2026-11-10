import { Prisma } from "@prisma/client";
import { roundMoney, salesTotals, slugify } from "./format";
import { clearUserCache } from "./auth/user";
import { asNumber, asString, HttpError, optionalDate } from "./http";
import { prisma } from "./prisma";
import { applyStockChange, type Tx } from "./stock";

const poInclude = {
  supplier: true,
  warehouse: true,
  items: { include: { product: { select: { id: true, name: true, sku: true } } } },
} satisfies Prisma.PurchaseOrderInclude;

const soInclude = {
  customer: true,
  warehouse: true,
  // Oldest first: an open invoice reads as a dated log of what was taken.
  items: { orderBy: { createdAt: "asc" }, include: { product: { select: { id: true, name: true, sku: true } } } },
} satisfies Prisma.SalesOrderInclude;

const trInclude = {
  sourceWarehouse: true,
  destWarehouse: true,
  items: { include: { product: { select: { id: true, name: true, sku: true } } } },
} satisfies Prisma.StockTransferInclude;

async function audit(
  tx: Tx,
  userId: string | null,
  action: string,
  resourceType: string,
  resourceId: string | null,
  description: string,
) {
  await tx.auditLog.create({
    data: { userId, action, resourceType, resourceId, description },
  });
}

async function uniqueSlug(base: string, ignoreId?: string) {
  let slug = base;
  let n = 2;
  while (
    await prisma.category.findFirst({
      where: ignoreId ? { slug, NOT: { id: ignoreId } } : { slug },
    })
  ) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

// Resized images from the browser are ~50 KB; this leaves room while staying well under Vercel's 4.5 MB body limit.
const MAX_IMAGE_URL_LENGTH = 1_000_000;

function productData(input: Record<string, unknown>, partial = false) {
  const name = asString(input.name);
  const sku = asString(input.sku);
  if (!partial || "name" in input) {
    if (!name) throw new HttpError(400, "Name is required.");
  }
  if (!partial || "sku" in input) {
    if (!sku) throw new HttpError(400, "SKU is required.");
  }
  const categoryId = asString(input.categoryId);
  if (!categoryId) throw new HttpError(400, "Choose a category.");
  const discountPct = Math.min(100, Math.max(0, asNumber(input.discountPct)));
  const minStock = Math.max(0, asNumber(input.minStock));
  const maxStock = Math.max(0, asNumber(input.maxStock));
  if (maxStock > 0 && maxStock < minStock) throw new HttpError(400, "Maximum stock must be above the minimum.");
  const status = asString(input.status) || "ACTIVE";
  if (!["ACTIVE", "INACTIVE"].includes(status)) throw new HttpError(400, "Invalid status.");
  const imageUrl = asString(input.imageUrl);
  if (imageUrl.length > MAX_IMAGE_URL_LENGTH) throw new HttpError(400, "That image is too large. Use a smaller JPG or PNG.");
  return {
    name,
    sku,
    barcode: asString(input.barcode) || null,
    description: asString(input.description) || null,
    categoryId,
    supplierId: asString(input.supplierId) || null,
    uom: asString(input.uom) || "pcs",
    costPrice: roundMoney(Math.max(0, asNumber(input.costPrice))),
    sellingPrice: roundMoney(Math.max(0, asNumber(input.sellingPrice))),
    discountPct,
    minStock,
    maxStock,
    imageUrl: imageUrl || null,
    status,
  };
}

export async function createProduct(input: Record<string, unknown>, userId: string) {
  const data = productData(input);
  const product = await prisma.product.create({ data, include: { category: true, supplier: true, inventory: true } });
  await prisma.auditLog.create({
    data: { userId, action: "CREATE", resourceType: "PRODUCT", resourceId: product.id, description: `Created ${product.sku}` },
  });
  return product;
}

export async function updateProduct(id: string, input: Record<string, unknown>, userId: string) {
  const data = productData(input);
  const product = await prisma.product.update({
    where: { id },
    data,
    include: { category: true, supplier: true, inventory: true },
  });
  await prisma.auditLog.create({
    data: { userId, action: "UPDATE", resourceType: "PRODUCT", resourceId: id, description: `Updated ${product.sku}` },
  });
  return product;
}

export async function deleteProduct(id: string, userId: string) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new HttpError(404, "Product not found.");
  const [sales, purchases, transfers] = await Promise.all([
    prisma.salesOrderItem.count({ where: { productId: id } }),
    prisma.purchaseOrderItem.count({ where: { productId: id } }),
    prisma.stockTransferItem.count({ where: { productId: id } }),
  ]);
  if (sales + purchases + transfers > 0) {
    throw new HttpError(400, "This product is on documents. Set it to inactive instead.");
  }
  await prisma.product.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { userId, action: "DELETE", resourceType: "PRODUCT", resourceId: id, description: `Deleted ${product.sku}` },
  });
  return { ok: true };
}

export async function createCategory(input: Record<string, unknown>, userId: string) {
  const name = asString(input.name);
  if (!name) throw new HttpError(400, "Name is required.");
  const slug = await uniqueSlug(slugify(name));
  const category = await prisma.category.create({
    data: { name, slug, description: asString(input.description) || null },
  });
  await prisma.auditLog.create({
    data: { userId, action: "CREATE", resourceType: "CATEGORY", resourceId: category.id, description: `Created category ${name}` },
  });
  return category;
}

export async function updateCategory(id: string, input: Record<string, unknown>, userId: string) {
  const name = asString(input.name);
  if (!name) throw new HttpError(400, "Name is required.");
  const slug = await uniqueSlug(slugify(name), id);
  const category = await prisma.category.update({
    where: { id },
    data: { name, slug, description: asString(input.description) || null },
  });
  await prisma.auditLog.create({
    data: { userId, action: "UPDATE", resourceType: "CATEGORY", resourceId: id, description: `Updated category ${name}` },
  });
  return category;
}

export async function deleteCategory(id: string, userId: string) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw new HttpError(404, "Category not found.");
  const used = await prisma.product.count({ where: { categoryId: id } });
  if (used) throw new HttpError(400, "Move products out of this category before deleting it.");
  await prisma.category.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { userId, action: "DELETE", resourceType: "CATEGORY", resourceId: id, description: `Deleted category ${category.name}` },
  });
  return { ok: true };
}

function partyData(input: Record<string, unknown>) {
  const name = asString(input.name);
  if (!name) throw new HttpError(400, "Name is required.");
  const status = asString(input.status) || "ACTIVE";
  if (!["ACTIVE", "INACTIVE"].includes(status)) throw new HttpError(400, "Invalid status.");
  return {
    name,
    contactPerson: asString(input.contactPerson) || null,
    email: asString(input.email) || null,
    phone: asString(input.phone) || null,
    address: asString(input.address) || null,
    city: asString(input.city) || null,
    country: asString(input.country) || "Cambodia",
    notes: asString(input.notes) || null,
    status,
  };
}

export async function createCustomer(input: Record<string, unknown>, userId: string) {
  const customer = await prisma.customer.create({ data: partyData(input) });
  await prisma.auditLog.create({
    data: { userId, action: "CREATE", resourceType: "CUSTOMER", resourceId: customer.id, description: `Created customer ${customer.name}` },
  });
  return customer;
}

export async function updateCustomer(id: string, input: Record<string, unknown>, userId: string) {
  const customer = await prisma.customer.update({ where: { id }, data: partyData(input) });
  await prisma.auditLog.create({
    data: { userId, action: "UPDATE", resourceType: "CUSTOMER", resourceId: id, description: `Updated customer ${customer.name}` },
  });
  return customer;
}

export async function deleteCustomer(id: string, userId: string) {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw new HttpError(404, "Customer not found.");
  const used = await prisma.salesOrder.count({ where: { customerId: id } });
  if (used) throw new HttpError(400, "This customer has sales orders and cannot be deleted.");
  await prisma.customer.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { userId, action: "DELETE", resourceType: "CUSTOMER", resourceId: id, description: `Deleted customer ${customer.name}` },
  });
  return { ok: true };
}

export async function setCustomerPrice(customerId: string, input: Record<string, unknown>, userId: string) {
  const productId = asString(input.productId);
  if (!productId) throw new HttpError(400, "Choose a product.");
  const [customer, product] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId }, select: { name: true } }),
    prisma.product.findUnique({ where: { id: productId }, select: { name: true } }),
  ]);
  if (!customer) throw new HttpError(404, "Customer not found.");
  if (!product) throw new HttpError(404, "Product not found.");
  const where = { customerId_productId: { customerId, productId } };
  if (input.price === null || input.price === undefined || input.price === "") {
    await prisma.customerPrice.deleteMany({ where: { customerId, productId } });
    await prisma.auditLog.create({
      data: { userId, action: "DELETE", resourceType: "CUSTOMER", resourceId: customerId, description: `Removed ${customer.name}'s price for ${product.name}` },
    });
    return { ok: true };
  }
  const price = roundMoney(asNumber(input.price));
  if (!Number.isFinite(price) || price < 0) throw new HttpError(400, "Price cannot be negative.");
  const saved = await prisma.customerPrice.upsert({
    where,
    create: { customerId, productId, price },
    update: { price },
  });
  await prisma.auditLog.create({
    data: { userId, action: "UPDATE", resourceType: "CUSTOMER", resourceId: customerId, description: `Set ${customer.name}'s price for ${product.name}` },
  });
  return saved;
}

/** Save a whole price list at once: [{ productId, price }], price null/"" removes it. */
export async function setCustomerPrices(customerId: string, raw: unknown, userId: string) {
  if (!Array.isArray(raw)) throw new HttpError(400, "Send a list of prices.");
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { name: true } });
  if (!customer) throw new HttpError(404, "Customer not found.");
  const entries = (raw as Record<string, unknown>[]).map((row) => {
    const productId = asString(row.productId);
    if (!productId) throw new HttpError(400, "Each price needs a product.");
    if (row.price === null || row.price === undefined || row.price === "") return { productId, price: null };
    const price = roundMoney(asNumber(row.price));
    if (!Number.isFinite(price) || price < 0) throw new HttpError(400, "Price cannot be negative.");
    return { productId, price };
  });
  const removed = entries.filter((entry) => entry.price === null).map((entry) => entry.productId);
  const kept = entries.filter((entry): entry is { productId: string; price: number } => entry.price !== null);
  // One batch: a single round trip instead of one per product.
  await prisma.$transaction([
    prisma.customerPrice.deleteMany({ where: { customerId, productId: { in: removed } } }),
    ...kept.map((entry) =>
      prisma.customerPrice.upsert({
        where: { customerId_productId: { customerId, productId: entry.productId } },
        create: { customerId, productId: entry.productId, price: entry.price },
        update: { price: entry.price },
      }),
    ),
    prisma.auditLog.create({
      data: { userId, action: "UPDATE", resourceType: "CUSTOMER", resourceId: customerId, description: `Updated ${customer.name}'s price list (${kept.length} set, ${removed.length} removed)` },
    }),
  ]);
  return { ok: true, saved: kept.length, removed: removed.length };
}

export async function createSupplier(input: Record<string, unknown>, userId: string) {
  const supplier = await prisma.supplier.create({ data: partyData(input) });
  await prisma.auditLog.create({
    data: { userId, action: "CREATE", resourceType: "SUPPLIER", resourceId: supplier.id, description: `Created supplier ${supplier.name}` },
  });
  return supplier;
}

export async function updateSupplier(id: string, input: Record<string, unknown>, userId: string) {
  const supplier = await prisma.supplier.update({ where: { id }, data: partyData(input) });
  await prisma.auditLog.create({
    data: { userId, action: "UPDATE", resourceType: "SUPPLIER", resourceId: id, description: `Updated supplier ${supplier.name}` },
  });
  return supplier;
}

export async function deleteSupplier(id: string, userId: string) {
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) throw new HttpError(404, "Supplier not found.");
  const [products, orders] = await Promise.all([
    prisma.product.count({ where: { supplierId: id } }),
    prisma.purchaseOrder.count({ where: { supplierId: id } }),
  ]);
  if (products + orders > 0) throw new HttpError(400, "This supplier is still linked to products or orders.");
  await prisma.supplier.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { userId, action: "DELETE", resourceType: "SUPPLIER", resourceId: id, description: `Deleted supplier ${supplier.name}` },
  });
  return { ok: true };
}

export async function createUser(input: Record<string, unknown>, actorId: string) {
  const bcrypt = await import("bcryptjs");
  const { registerNeonAccount } = await import("./auth/accounts");
  const name = asString(input.name);
  const email = asString(input.email).toLowerCase();
  const password = asString(input.password);
  const role = asString(input.role) || "STAFF";
  if (!name) throw new HttpError(400, "Name is required.");
  if (!email.includes("@")) throw new HttpError(400, "Enter a valid email.");
  if (password.length < 6) throw new HttpError(400, "Password must be at least 6 characters.");
  if (!["ADMIN", "WAREHOUSE_MANAGER", "SALES_MANAGER", "STAFF"].includes(role)) throw new HttpError(400, "Invalid role.");
  await registerNeonAccount({ name, email, password });
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role,
      phone: asString(input.phone) || null,
      avatarUrl: asString(input.avatarUrl) || null,
      status: asString(input.status) === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      warehouseId: asString(input.warehouseId) || null,
    },
    include: { warehouse: { select: { id: true, name: true, code: true } } },
  });
  await prisma.auditLog.create({
    data: { userId: actorId, action: "CREATE", resourceType: "USER", resourceId: user.id, description: `Created user ${user.email}` },
  });
  clearUserCache();
  const { password: _password, ...safe } = user;
  return safe;
}

export async function updateUser(id: string, input: Record<string, unknown>, actorId: string) {
  const bcrypt = await import("bcryptjs");
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "User not found.");
  const name = asString(input.name);
  const email = asString(input.email).toLowerCase();
  const role = asString(input.role) || existing.role;
  if (!name) throw new HttpError(400, "Name is required.");
  if (!email.includes("@")) throw new HttpError(400, "Enter a valid email.");
  if (!["ADMIN", "WAREHOUSE_MANAGER", "SALES_MANAGER", "STAFF"].includes(role)) throw new HttpError(400, "Invalid role.");
  const status = asString(input.status) === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  if (id === actorId && status === "INACTIVE") throw new HttpError(400, "You cannot deactivate your own account.");
  const password = asString(input.password);
  const user = await prisma.user.update({
    where: { id },
    data: {
      name,
      email,
      role,
      phone: asString(input.phone) || null,
      avatarUrl: asString(input.avatarUrl) || null,
      status,
      warehouseId: asString(input.warehouseId) || null,
      ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
    },
    include: { warehouse: { select: { id: true, name: true, code: true } } },
  });
  await prisma.auditLog.create({
    data: { userId: actorId, action: "UPDATE", resourceType: "USER", resourceId: id, description: `Updated user ${user.email}` },
  });
  clearUserCache();
  const { password: _password, ...safe } = user;
  return safe;
}

export async function adjustStock(input: Record<string, unknown>, userId: string) {
  const productId = asString(input.productId);
  const warehouseId = asString(input.warehouseId);
  const type = asString(input.type);
  const quantity = asNumber(input.quantity);
  if (!productId || !warehouseId) throw new HttpError(400, "Product and warehouse are required.");
  if (!["STOCK_IN", "STOCK_OUT", "ADJUSTMENT"].includes(type)) throw new HttpError(400, "Invalid adjustment type.");
  if (quantity < 0) throw new HttpError(400, "Quantity must be zero or greater.");
  if (type !== "ADJUSTMENT" && quantity === 0) throw new HttpError(400, "Enter a quantity.");
  return prisma.$transaction(async (tx) => {
    const current = await tx.productInventory.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    });
    const onHand = current?.quantity || 0;
    const delta = type === "STOCK_OUT" ? -quantity : type === "ADJUSTMENT" ? quantity - onHand : quantity;
    await applyStockChange(tx, {
      productId,
      warehouseId,
      delta,
      type,
      notes: asString(input.notes) || null,
      userId,
    });
    await audit(tx, userId, "STOCK_ADJUST", "INVENTORY", productId, `${type} ${quantity}`);
    return tx.productInventory.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
      include: { product: true, warehouse: true },
    });
  });
}

async function nextNumber(tx: Tx, kind: "PO" | "SO" | "TR") {
  const year = new Date().getFullYear();
  const prefix = `${kind}-${year}-`;
  const latest =
    kind === "PO"
      ? await tx.purchaseOrder.findFirst({ where: { orderNumber: { startsWith: prefix } }, orderBy: { orderNumber: "desc" } })
      : kind === "SO"
        ? await tx.salesOrder.findFirst({ where: { orderNumber: { startsWith: prefix } }, orderBy: { orderNumber: "desc" } })
        : await tx.stockTransfer.findFirst({ where: { transferNumber: { startsWith: prefix } }, orderBy: { transferNumber: "desc" } });
  const current = latest
    ? Number(String("orderNumber" in latest ? latest.orderNumber : latest.transferNumber).slice(prefix.length))
    : 0;
  return `${prefix}${String((Number.isFinite(current) ? current : 0) + 1).padStart(4, "0")}`;
}

function parseLines(raw: unknown, priceKey: "unitCost" | "unitPrice" | "requestedQty") {
  if (!Array.isArray(raw) || raw.length === 0) throw new HttpError(400, "Add at least one line.");
  return raw.map((row) => {
    const record = row as Record<string, unknown>;
    const productId = asString(record.productId);
    const quantity = asNumber(record.quantity ?? record.requestedQty);
    if (!productId || quantity <= 0) throw new HttpError(400, "Each line needs a product and a quantity.");
    if (priceKey === "requestedQty") return { productId, requestedQty: quantity };
    const price = asNumber(record[priceKey] ?? record.price);
    if (price < 0) throw new HttpError(400, "Price cannot be negative.");
    return priceKey === "unitCost"
      ? { productId, quantity, unitCost: roundMoney(price), receivedQty: 0 }
      : { productId, quantity, unitPrice: roundMoney(price) };
  });
}

export async function createPurchaseOrder(input: Record<string, unknown>, userId: string) {
  const supplierId = asString(input.supplierId);
  const warehouseId = asString(input.warehouseId);
  if (!supplierId || !warehouseId) throw new HttpError(400, "Choose a supplier and a warehouse.");
  const status = asString(input.status) || "DRAFT";
  if (!["DRAFT", "SUBMITTED"].includes(status)) throw new HttpError(400, "Invalid status.");
  const items = parseLines(input.items, "unitCost") as { productId: string; quantity: number; unitCost: number; receivedQty: number }[];
  const total = roundMoney(items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0));
  return prisma.$transaction(async (tx) => {
    const orderNumber = await nextNumber(tx, "PO");
    const order = await tx.purchaseOrder.create({
      data: {
        orderNumber,
        supplierId,
        warehouseId,
        expectedDelivery: optionalDate(input.expectedDelivery),
        status,
        notes: asString(input.notes) || null,
        total,
        createdById: userId,
        items: { create: items },
      },
      include: poInclude,
    });
    await audit(tx, userId, "CREATE", "PURCHASE_ORDER", order.id, `Created ${orderNumber}`);
    return order;
  });
}

export async function transitionPurchaseOrder(
  id: string,
  action: string,
  lines: { id?: string; quantity?: number }[] | undefined,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw new HttpError(404, "Purchase order not found.");
    const setStatus = async (status: string) => {
      const updated = await tx.purchaseOrder.update({ where: { id }, data: { status }, include: poInclude });
      await audit(tx, userId, "STATUS_CHANGE", "PURCHASE_ORDER", id, `${order.orderNumber} → ${status}`);
      return updated;
    };
    if (action === "SUBMIT") {
      if (order.status !== "DRAFT") throw new HttpError(400, "Only a draft can be submitted.");
      return setStatus("SUBMITTED");
    }
    if (action === "APPROVE") {
      if (order.status !== "SUBMITTED") throw new HttpError(400, "Only a submitted order can be approved.");
      return setStatus("APPROVED");
    }
    if (action === "CANCEL") {
      if (["RECEIVED", "CANCELLED", "PARTIALLY_RECEIVED"].includes(order.status)) {
        throw new HttpError(400, "This order cannot be cancelled.");
      }
      return setStatus("CANCELLED");
    }
    if (action === "RECEIVE") {
      if (!["APPROVED", "PARTIALLY_RECEIVED"].includes(order.status)) {
        throw new HttpError(400, "Approve the order before receiving.");
      }
      let receivedAny = false;
      for (const line of lines || []) {
        const qty = Number(line.quantity);
        if (!qty || qty <= 0) continue;
        const item = order.items.find((entry) => entry.id === line.id);
        if (!item) throw new HttpError(400, "Unknown line.");
        const remaining = item.quantity - item.receivedQty;
        if (qty - remaining > 0.0001) throw new HttpError(400, "Quantity is higher than the amount still due.");
        receivedAny = true;
        await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedQty: item.receivedQty + qty } });
        await applyStockChange(tx, {
          productId: item.productId,
          warehouseId: order.warehouseId,
          delta: qty,
          type: "PURCHASE_RECEIVE",
          notes: order.orderNumber,
          userId,
          referenceType: "PURCHASE_ORDER",
          referenceId: order.id,
        });
      }
      if (!receivedAny) throw new HttpError(400, "Enter a quantity to receive.");
      const items = await tx.purchaseOrderItem.findMany({ where: { orderId: id } });
      const status = items.every((item) => item.receivedQty + 0.0001 >= item.quantity) ? "RECEIVED" : "PARTIALLY_RECEIVED";
      const updated = await tx.purchaseOrder.update({ where: { id }, data: { status }, include: poInclude });
      await audit(tx, userId, "RECEIVE", "PURCHASE_ORDER", id, `${order.orderNumber} → ${status}`);
      return updated;
    }
    throw new HttpError(400, "Unknown action.");
  });
}

async function applySaleStock(tx: Tx, orderId: string, userId: string, direction: "deduct" | "restore", at?: Date) {
  const order = await tx.salesOrder.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw new HttpError(404, "Sales order not found.");
  for (const item of order.items) {
    // Returned goods are already back on the shelf, so only the outstanding quantity moves.
    const outstanding = item.quantity - item.returnedQty;
    if (outstanding <= 0) continue;
    await applyStockChange(tx, {
      productId: item.productId,
      warehouseId: order.warehouseId,
      delta: direction === "deduct" ? -outstanding : outstanding,
      type: direction === "deduct" ? "SALE" : "SALE_REVERSAL",
      notes: order.orderNumber,
      userId,
      referenceType: "SALES_ORDER",
      referenceId: order.id,
      at,
    });
  }
}

export async function createSalesOrder(input: Record<string, unknown>, userId: string) {
  const warehouseId = asString(input.warehouseId);
  if (!warehouseId) throw new HttpError(400, "Choose a warehouse.");
  const status = asString(input.status) || "DRAFT";
  if (!["DRAFT", "CONFIRMED"].includes(status)) throw new HttpError(400, "Invalid status.");
  const kind = asString(input.kind) || "SALE";
  if (!["SALE", "CONSIGN"].includes(kind)) throw new HttpError(400, "Invalid order type.");
  const items = parseLines(input.items, "unitPrice") as { productId: string; quantity: number; unitPrice: number }[];
  const customerId = asString(input.customerId) || null;
  if (kind === "CONSIGN") {
    if (!customerId) throw new HttpError(400, "Choose a customer for take & return.");
    // Each customer has one open invoice: new products are added to it, not to a new order.
    const open = await prisma.salesOrder.findFirst({
      where: { customerId, kind: "CONSIGN", status: { in: OPEN_CONSIGN } },
      orderBy: { orderDate: "desc" },
    });
    if (open) {
      if (open.warehouseId !== warehouseId) {
        throw new HttpError(400, "This customer's open invoice is from another warehouse. Choose that warehouse or settle the invoice first.");
      }
      return prisma.$transaction(async (tx) => {
        await addConsignItems(tx, open, items, userId, eventTime(input.at));
        const order = await tx.salesOrder.findUniqueOrThrow({ where: { id: open.id }, include: soInclude });
        return { ...order, appended: true };
      });
    }
  }
  const discount = Math.max(0, asNumber(input.discount));
  const taxPct = Math.max(0, asNumber(input.taxPct));
  const totals = salesTotals(items, discount, taxPct);
  // Take & return: the time the customer took the goods (defaults to now).
  const at = kind === "CONSIGN" ? eventTime(input.at) : undefined;
  return prisma.$transaction(async (tx) => {
    const orderNumber = await nextNumber(tx, "SO");
    const created = await tx.salesOrder.create({
      data: {
        orderNumber,
        customerId,
        warehouseId,
        deliveryDate: optionalDate(input.deliveryDate),
        status: "DRAFT",
        kind,
        notes: asString(input.notes) || null,
        discount,
        taxPct,
        subtotal: totals.subtotal,
        total: totals.total,
        stockApplied: false,
        createdById: userId,
        ...(at ? { orderDate: at } : {}),
        items: { create: items.map((item) => (at ? { ...item, createdAt: at } : item)) },
      },
    });
    if (status === "CONFIRMED") {
      await applySaleStock(tx, created.id, userId, "deduct", at);
      const confirmed = await tx.salesOrder.update({
        where: { id: created.id },
        data: { status: "CONFIRMED", stockApplied: true },
        include: soInclude,
      });
      await audit(tx, userId, "CREATE", "SALES_ORDER", created.id, `Confirmed ${orderNumber}`);
      return confirmed;
    }
    const order = await tx.salesOrder.findUniqueOrThrow({ where: { id: created.id }, include: soInclude });
    await audit(tx, userId, "CREATE", "SALES_ORDER", created.id, `Created ${orderNumber}`);
    return order;
  });
}

// Recompute totals from what the customer actually kept (taken − returned).
async function refreshSalesTotals(tx: Tx, id: string) {
  const order = await tx.salesOrder.findUniqueOrThrow({ where: { id }, include: { items: true } });
  const totals = salesTotals(
    order.items.map((item) => ({ quantity: item.quantity - item.returnedQty, unitPrice: item.unitPrice })),
    order.discount,
    order.taxPct,
  );
  await tx.salesOrder.update({ where: { id }, data: totals });
}

const OPEN_CONSIGN = ["CONFIRMED", "PROCESSING"];

// Customer comes back and takes more goods on the same take-and-return order.
/**
 * When a take or return happened: the time the user entered, or now. Lets staff
 * record something later ("she brought it back at 9 this morning").
 */
function eventTime(value: unknown) {
  const at = optionalDate(value);
  if (!at) return new Date();
  if (at.getTime() > Date.now() + 5 * 60_000) throw new HttpError(400, "The time cannot be in the future.");
  return at;
}

export async function addConsignItems(
  tx: Tx,
  order: { id: string; orderNumber: string; warehouseId: string },
  raw: unknown,
  userId: string,
  at: Date = new Date(),
) {
  const lines = parseLines(raw, "unitPrice") as { productId: string; quantity: number; unitPrice: number }[];
  for (const line of lines) {
    await tx.salesOrderItem.create({ data: { ...line, orderId: order.id, createdAt: at } });
    await applyStockChange(tx, {
      productId: line.productId,
      warehouseId: order.warehouseId,
      delta: -line.quantity,
      type: "SALE",
      notes: `${order.orderNumber} (added)`,
      userId,
      referenceType: "SALES_ORDER",
      referenceId: order.id,
      at,
    });
  }
  await refreshSalesTotals(tx, order.id);
  await audit(tx, userId, "UPDATE", "SALES_ORDER", order.id, `Added ${lines.length} line(s) to ${order.orderNumber}`);
}

// Record how many of each line came back. Values are the total returned so far, not an increment.
export async function recordConsignReturns(
  tx: Tx,
  order: { id: string; orderNumber: string; warehouseId: string },
  raw: unknown,
  userId: string,
  at: Date = new Date(),
) {
  if (!raw || typeof raw !== "object") throw new HttpError(400, "Enter the returned quantities.");
  const items = await tx.salesOrderItem.findMany({ where: { orderId: order.id } });
  for (const item of items) {
    const value = (raw as Record<string, unknown>)[item.id];
    if (value === undefined || value === null || value === "") continue;
    const returned = asNumber(value);
    if (!Number.isFinite(returned) || returned < 0 || returned > item.quantity) {
      throw new HttpError(400, `Returned quantity must be between 0 and ${item.quantity}.`);
    }
    const delta = returned - item.returnedQty;
    if (Math.abs(delta) < 0.0001) continue;
    await applyStockChange(tx, {
      productId: item.productId,
      warehouseId: order.warehouseId,
      delta,
      type: "SALE_RETURN",
      notes: order.orderNumber,
      userId,
      referenceType: "SALES_ORDER",
      referenceId: order.id,
      at,
    });
    await tx.salesOrderItem.update({ where: { id: item.id }, data: { returnedQty: returned } });
  }
  await refreshSalesTotals(tx, order.id);
  await audit(tx, userId, "UPDATE", "SALES_ORDER", order.id, `Recorded returns on ${order.orderNumber}`);
}

// Fix an order's lines (wrong product, quantity or price). If the order already
// took stock out, only the difference per product moves, so stock stays right.
export async function editSalesItems(
  tx: Tx,
  order: { id: string; orderNumber: string; warehouseId: string; stockApplied: boolean },
  input: Record<string, unknown>,
  userId: string,
) {
  const raw = Array.isArray(input.items) ? (input.items as Record<string, unknown>[]) : [];
  const lines = parseLines(raw, "unitPrice") as { productId: string; quantity: number; unitPrice: number }[];
  const old = await tx.salesOrderItem.findMany({ where: { orderId: order.id } });
  const oldById = new Map(old.map((item) => [item.id, item]));

  // Keep returns already recorded on lines that stay (matched by line id).
  const next = lines.map((line, index) => {
    const prev = oldById.get(asString(raw[index]?.id));
    const returnedQty = prev && prev.productId === line.productId ? prev.returnedQty : 0;
    if (returnedQty > line.quantity) {
      throw new HttpError(400, `Quantity cannot be less than the ${returnedQty} already returned.`);
    }
    // Keep the day each product was taken; new lines are dated now.
    return { ...line, returnedQty, createdAt: prev && prev.productId === line.productId ? prev.createdAt : new Date() };
  });

  if (order.stockApplied) {
    const outstanding = (items: { productId: string; quantity: number; returnedQty: number }[]) => {
      const map = new Map<string, number>();
      for (const item of items) map.set(item.productId, (map.get(item.productId) || 0) + item.quantity - item.returnedQty);
      return map;
    };
    const before = outstanding(old);
    const after = outstanding(next);
    // Put stock back first, then take, so swapping products never fails on a false shortage.
    const changes = [...new Set([...before.keys(), ...after.keys()])]
      .map((productId) => ({ productId, delta: (before.get(productId) || 0) - (after.get(productId) || 0) }))
      .filter((change) => Math.abs(change.delta) > 0.0001)
      .sort((a, b) => b.delta - a.delta);
    for (const change of changes) {
      await applyStockChange(tx, {
        productId: change.productId,
        warehouseId: order.warehouseId,
        delta: change.delta,
        type: change.delta > 0 ? "SALE_REVERSAL" : "SALE",
        notes: `${order.orderNumber} (edited)`,
        userId,
        referenceType: "SALES_ORDER",
        referenceId: order.id,
      });
    }
  }

  await tx.salesOrderItem.deleteMany({ where: { orderId: order.id } });
  await tx.salesOrderItem.createMany({ data: next.map((line) => ({ ...line, orderId: order.id })) });
  if (input.discount !== undefined) {
    await tx.salesOrder.update({ where: { id: order.id }, data: { discount: Math.max(0, asNumber(input.discount)) } });
  }
  await refreshSalesTotals(tx, order.id);
  await audit(tx, userId, "UPDATE", "SALES_ORDER", order.id, `Edited lines on ${order.orderNumber}`);
}

export async function transitionSalesOrder(id: string, action: string, userId: string, body: Record<string, unknown> = {}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.salesOrder.findUnique({ where: { id } });
    if (!order) throw new HttpError(404, "Sales order not found.");
    if (action === "EDIT_ITEMS") {
      if (order.status === "CANCELLED") throw new HttpError(400, "A cancelled order cannot be edited.");
      await editSalesItems(tx, order, body, userId);
      return tx.salesOrder.findUniqueOrThrow({ where: { id }, include: soInclude });
    }
    if (action === "ADD_ITEMS" || action === "RETURN") {
      if (order.kind !== "CONSIGN") throw new HttpError(400, "Only take-and-return orders support this.");
      if (!OPEN_CONSIGN.includes(order.status)) throw new HttpError(400, "Confirm the order first; paid or cancelled orders cannot change.");
      if (action === "ADD_ITEMS") await addConsignItems(tx, order, body.items, userId, eventTime(body.at));
      else await recordConsignReturns(tx, order, body.returns, userId, eventTime(body.at));
      return tx.salesOrder.findUniqueOrThrow({ where: { id }, include: soInclude });
    }
    const setStatus = async (status: string, extra: Record<string, unknown> = {}) => {
      const updated = await tx.salesOrder.update({ where: { id }, data: { status, ...extra }, include: soInclude });
      await audit(tx, userId, "STATUS_CHANGE", "SALES_ORDER", id, `${order.orderNumber} → ${status}`);
      return updated;
    };
    if (action === "CONFIRM") {
      if (order.status !== "DRAFT") throw new HttpError(400, "Only a draft can be confirmed.");
      if (!order.stockApplied) await applySaleStock(tx, id, userId, "deduct");
      return setStatus("CONFIRMED", { stockApplied: true });
    }
    if (action === "PROCESS") {
      if (order.status !== "CONFIRMED") throw new HttpError(400, "Confirm the order first.");
      return setStatus("PROCESSING");
    }
    if (action === "COMPLETE") {
      if (!["CONFIRMED", "PROCESSING"].includes(order.status)) throw new HttpError(400, "This order cannot be completed.");
      return setStatus("COMPLETED");
    }
    if (action === "CANCEL") {
      if (["COMPLETED", "CANCELLED"].includes(order.status)) throw new HttpError(400, "This order cannot be cancelled.");
      if (order.stockApplied) await applySaleStock(tx, id, userId, "restore");
      return setStatus("CANCELLED", { stockApplied: false });
    }
    throw new HttpError(400, "Unknown action.");
  });
}

async function receiveTransfer(tx: Tx, id: string, userId: string) {
  const transfer = await tx.stockTransfer.findUnique({ where: { id }, include: { items: true } });
  if (!transfer) throw new HttpError(404, "Transfer not found.");
  if (transfer.stockApplied) throw new HttpError(400, "This transfer was already received.");
  for (const item of transfer.items) {
    await applyStockChange(tx, {
      productId: item.productId,
      warehouseId: transfer.sourceWarehouseId,
      delta: -item.requestedQty,
      type: "TRANSFER_OUT",
      notes: transfer.transferNumber,
      userId,
      referenceType: "STOCK_TRANSFER",
      referenceId: transfer.id,
    });
    await applyStockChange(tx, {
      productId: item.productId,
      warehouseId: transfer.destWarehouseId,
      delta: item.requestedQty,
      type: "TRANSFER_IN",
      notes: transfer.transferNumber,
      userId,
      referenceType: "STOCK_TRANSFER",
      referenceId: transfer.id,
    });
    await tx.stockTransferItem.update({ where: { id: item.id }, data: { receivedQty: item.requestedQty } });
  }
  const updated = await tx.stockTransfer.update({
    where: { id },
    data: { status: "RECEIVED", stockApplied: true },
    include: trInclude,
  });
  await audit(tx, userId, "RECEIVE", "STOCK_TRANSFER", id, `${transfer.transferNumber} → RECEIVED`);
  return updated;
}

export async function createStockTransfer(input: Record<string, unknown>, userId: string) {
  const sourceWarehouseId = asString(input.sourceWarehouseId);
  const destWarehouseId = asString(input.destWarehouseId);
  if (!sourceWarehouseId || !destWarehouseId) throw new HttpError(400, "Choose both warehouses.");
  if (sourceWarehouseId === destWarehouseId) throw new HttpError(400, "Source and destination must be different.");
  const status = asString(input.status) || "DRAFT";
  if (!["DRAFT", "PENDING_APPROVAL", "RECEIVED"].includes(status)) throw new HttpError(400, "Invalid status.");
  const items = parseLines(input.items, "requestedQty") as { productId: string; requestedQty: number }[];
  return prisma.$transaction(async (tx) => {
    const transferNumber = await nextNumber(tx, "TR");
    const created = await tx.stockTransfer.create({
      data: {
        transferNumber,
        sourceWarehouseId,
        destWarehouseId,
        status: status === "RECEIVED" ? "IN_TRANSIT" : status,
        notes: asString(input.notes) || null,
        createdById: userId,
        items: { create: items },
      },
    });
    if (status === "RECEIVED") return receiveTransfer(tx, created.id, userId);
    const transfer = await tx.stockTransfer.findUniqueOrThrow({ where: { id: created.id }, include: trInclude });
    await audit(tx, userId, "CREATE", "STOCK_TRANSFER", created.id, `Created ${transferNumber}`);
    return transfer;
  });
}

export async function transitionStockTransfer(id: string, action: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const transfer = await tx.stockTransfer.findUnique({ where: { id } });
    if (!transfer) throw new HttpError(404, "Transfer not found.");
    const setStatus = async (status: string) => {
      const updated = await tx.stockTransfer.update({ where: { id }, data: { status }, include: trInclude });
      await audit(tx, userId, "STATUS_CHANGE", "STOCK_TRANSFER", id, `${transfer.transferNumber} → ${status}`);
      return updated;
    };
    if (action === "SUBMIT") {
      if (transfer.status !== "DRAFT") throw new HttpError(400, "Only a draft can be submitted.");
      return setStatus("PENDING_APPROVAL");
    }
    if (action === "APPROVE") {
      if (transfer.status !== "PENDING_APPROVAL") throw new HttpError(400, "This transfer is not waiting for approval.");
      return setStatus("APPROVED");
    }
    if (action === "SHIP") {
      if (transfer.status !== "APPROVED") throw new HttpError(400, "Approve the transfer first.");
      return setStatus("IN_TRANSIT");
    }
    if (action === "RECEIVE") {
      if (transfer.status !== "IN_TRANSIT") throw new HttpError(400, "Mark the transfer in transit before receiving.");
      return receiveTransfer(tx, id, userId);
    }
    if (action === "CANCEL") {
      if (["RECEIVED", "CANCELLED", "IN_TRANSIT"].includes(transfer.status)) {
        throw new HttpError(400, "This transfer cannot be cancelled.");
      }
      return setStatus("CANCELLED");
    }
    throw new HttpError(400, "Unknown action.");
  });
}

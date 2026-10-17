import { PrismaClient, type Product } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const categories = [
  { name: "Pantry", slug: "pantry", description: "Rice, sauces, and dry staples" },
  { name: "Beverages", slug: "beverages", description: "Water, tea, and drinks" },
  { name: "Household", slug: "household", description: "Cleaning and home supplies" },
  { name: "Personal Care", slug: "personal-care", description: "Daily care goods" },
  { name: "Electronics", slug: "electronics", description: "Small accessories" },
  { name: "Stationery", slug: "stationery", description: "Shop and office basics" },
];

const suppliers = [
  { name: "Kampot Harvest Co.", contactPerson: "Dara Sok", email: "hello@kampotharvest.kh", phone: "+855 12 440 218", city: "Kampot", address: "Street 3, Kampong Kandal" },
  { name: "Tonle Sap Foods", contactPerson: "Sreymom Chea", email: "orders@tonlesapfoods.kh", phone: "+855 16 882 014", city: "Phnom Penh", address: "St. 271, Toul Kork" },
  { name: "Mekong Home Supply", contactPerson: "Vannak Lim", email: "sales@mekonghome.kh", phone: "+855 17 220 664", city: "Phnom Penh", address: "Russian Blvd" },
  { name: "Bayon Wholesale", contactPerson: "Pisey Ouk", email: "pisey@bayonwholesale.kh", phone: "+855 10 555 902", city: "Siem Reap", address: "National Road 6" },
];

const warehouses = [
  { name: "Phnom Penh — Toul Kork", code: "PNH", city: "Phnom Penh", address: "St. 289, Toul Kork" },
  { name: "Siem Reap Depot", code: "REP", city: "Siem Reap", address: "Sala Kamreuk" },
  { name: "Sihanoukville Port", code: "KOS", city: "Sihanoukville", address: "Autonomous Port road" },
];

const catalog = [
  ["Jasmine Rice 5kg", "RICE-5KG", "8841000000017", "pantry", 0, "bag", 4.2, 6.5, 0, 18, 120, "Fragrant long-grain rice packed for shop resale."],
  ["Kampot Pepper 100g", "PEPPER-100", "8841000000024", "pantry", 0, "jar", 3.1, 5.4, 0, 12, 80, "Black pepper from Kampot farms."],
  ["Fish Sauce 700ml", "FISH-700", "8841000000031", "pantry", 1, "btl", 1.15, 1.9, 0, 24, 200, "Everyday fish sauce for kitchens and stalls."],
  ["Palm Sugar 500g", "SUGAR-500", "8841000000048", "pantry", 0, "bag", 1.4, 2.3, 5, 16, 100, "Soft palm sugar, lightly discounted."],
  ["Dried Shrimp 200g", "SHRIMP-200", "8841000000055", "pantry", 1, "pack", 2.8, 4.6, 0, 10, 60, "Sun-dried shrimp for soups and salads."],
  ["Coconut Milk 400ml", "COCO-400", "8841000000062", "pantry", 1, "can", 0.85, 1.45, 0, 20, 160, "Rich coconut milk for curries."],
  ["Soy Sauce 500ml", "SOY-500", "8841000000079", "pantry", 1, "btl", 0.95, 1.6, 0, 16, 120, "Dark soy for daily cooking."],
  ["Cooking Oil 1L", "OIL-1L", "8841000000086", "pantry", 1, "btl", 1.7, 2.5, 0, 18, 140, "Neutral cooking oil."],
  ["Instant Noodles 5-pack", "NOODLE-5", "8841000000093", "pantry", 3, "pack", 0.7, 1.15, 0, 30, 240, "Fast-moving stall staple."],
  ["Spring Water 1.5L", "WATER-15", "8841000000109", "beverages", 3, "btl", 0.22, 0.45, 0, 40, 400, "Still water for counters and guesthouses."],
  ["Green Tea 25 bags", "TEA-25", "8841000000116", "beverages", 0, "box", 1.3, 2.4, 0, 14, 90, "Light green tea in a retail box."],
  ["Condensed Milk 390g", "MILK-390", "8841000000123", "beverages", 1, "can", 1.05, 1.75, 0, 16, 100, "Sweetened condensed milk."],
  ["Sugarcane Juice 330ml", "CANE-330", "8841000000130", "beverages", 3, "can", 0.35, 0.7, 0, 24, 180, "Chilled-case sugarcane drink."],
  ["Detergent Powder 1kg", "DET-1KG", "8841000000147", "household", 2, "bag", 1.6, 2.7, 0, 12, 80, "Laundry powder for household shops."],
  ["Dish Soap 750ml", "DISH-750", "8841000000154", "household", 2, "btl", 0.9, 1.55, 0, 14, 90, "Lemon dish soap."],
  ["LED Bulb 9W", "LED-9W", "8841000000161", "electronics", 2, "pcs", 0.8, 1.6, 10, 20, 150, "Warm-white bulb with a small discount."],
  ["USB-C Charger", "USBC-20W", "8841000000178", "electronics", 2, "pcs", 3.4, 6.9, 0, 8, 40, "20W charger for the counter."],
  ["AA Batteries 4-pack", "BATT-AA4", "8841000000185", "electronics", 2, "pack", 0.95, 1.8, 0, 16, 100, "Everyday alkaline cells."],
  ["Herbal Soap", "SOAP-HERB", "8841000000192", "personal-care", 0, "bar", 0.4, 0.85, 0, 24, 160, "Lemongrass herbal soap."],
  ["Toothpaste 100g", "PASTE-100", "8841000000208", "personal-care", 2, "tube", 0.75, 1.35, 0, 18, 120, "Fluoride toothpaste."],
  ["Shampoo 200ml", "SHAM-200", "8841000000215", "personal-care", 2, "btl", 1.2, 2.2, 0, 12, 80, "Small bottle for guesthouse kits."],
  ["A5 Notebook", "NOTE-A5", "8841000000222", "stationery", 3, "pcs", 0.55, 1.1, 0, 20, 120, "Plain A5 notebook."],
  ["Ballpoint Pens 10", "PEN-10", "8841000000239", "stationery", 3, "pack", 0.6, 1.2, 0, 16, 100, "Blue ballpoint pens."],
  ["Kraft Paper Bags 50", "BAG-50", "8841000000246", "stationery", 3, "pack", 1.1, 2, 0, 10, 70, "Counter bags for walk-in sales."],
] as const;

const customers = [
  { name: "Lotus Mart", contactPerson: "Chenda Phan", email: "chenda@lotusmart.kh", phone: "+855 12 300 441", city: "Phnom Penh", address: "St. 63, BKK1" },
  { name: "Tonle Fresh", contactPerson: "Rithy Meas", email: "hello@tonlefresh.kh", phone: "+855 17 611 228", city: "Phnom Penh", address: "Sisowath Quay" },
  { name: "Psar Chas Stall 12", contactPerson: "Sopheap Keo", email: "sopheap.keo@gmail.com", phone: "+855 10 882 773", city: "Siem Reap", address: "Old Market" },
  { name: "Seaside Guesthouse", contactPerson: "Malin Tep", email: "stay@seasidegh.kh", phone: "+855 16 440 905", city: "Sihanoukville", address: "Ochheuteal" },
  { name: "Borey Corner Shop", contactPerson: "Nita Ros", email: "nita@boreycorner.kh", phone: "+855 92 118 334", city: "Phnom Penh", address: "Sen Sok" },
  { name: "Mekong Mini", contactPerson: "Vuthy Heng", email: "vuthy@mekongmini.kh", phone: "+855 15 220 618", city: "Battambang", address: "Street 1" },
];

const swatches = ["#1F7A4D", "#C4622D", "#1F5678", "#8A5A2B", "#6B4C7A", "#3E6B5A"];

function swatch(label: string, index: number) {
  const bg = swatches[index % swatches.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" rx="28" fill="${bg}"/><text x="80" y="96" text-anchor="middle" font-family="Georgia" font-size="54" fill="#F6F1E8">${label.slice(0, 1)}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function daysAgo(days: number, hour = 10) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, (days * 7) % 60, 0, 0);
  return date;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function openingQty(productIndex: number, warehouseIndex: number) {
  return [72, 38, 24][warehouseIndex] + ((productIndex * 5) % 17);
}

function binFor(productIndex: number, warehouseIndex: number) {
  return `${"ABC"[warehouseIndex]}-${String((productIndex % 6) + 1).padStart(2, "0")}-${String((productIndex % 4) + 1).padStart(2, "0")}`;
}

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.stockTransferItem.deleteMany();
  await prisma.stockTransfer.deleteMany();
  await prisma.salesOrderItem.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.productInventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();
  await prisma.warehouse.deleteMany();

  const year = new Date().getFullYear();
  const wh = await Promise.all(warehouses.map((row) => prisma.warehouse.create({ data: row })));
  const cats = await Promise.all(categories.map((row) => prisma.category.create({ data: row })));
  const sups = await Promise.all(suppliers.map((row) => prisma.supplier.create({ data: { ...row, country: "Cambodia", status: "ACTIVE" } })));
  const cust = await Promise.all(customers.map((row) => prisma.customer.create({ data: { ...row, country: "Cambodia", status: "ACTIVE" } })));
  const catBySlug = new Map(cats.map((row) => [row.slug, row.id]));

  const users = [
    { name: "Admin", email: "admin@sovann.kh", password: "admin123", role: "ADMIN", phone: "+855 12 000 001", warehouseId: wh[0].id },
    { name: "Dara Keo", email: "warehouse@sovann.kh", password: "warehouse123", role: "WAREHOUSE_MANAGER", phone: "+855 12 000 002", warehouseId: wh[0].id },
    { name: "Sreymom Chan", email: "sales@sovann.kh", password: "sales123", role: "SALES_MANAGER", phone: "+855 12 000 003", warehouseId: wh[0].id },
    { name: "Pisey Noun", email: "staff@sovann.kh", password: "staff123", role: "STAFF", phone: "+855 12 000 004", warehouseId: wh[1].id },
  ];
  const createdUsers = [];
  for (const user of users) {
    createdUsers.push(
      await prisma.user.create({
        data: {
          ...user,
          password: await bcrypt.hash(user.password, 10),
          status: "ACTIVE",
          avatarUrl: swatch(user.name, createdUsers.length + 1),
        },
      }),
    );
  }
  const admin = createdUsers[0];

  const products: Product[] = [];
  for (let i = 0; i < catalog.length; i++) {
    const [name, sku, barcode, slug, supplierIndex, uom, cost, price, discount, min, max, description] = catalog[i];
    products.push(
      await prisma.product.create({
        data: {
          name,
          sku,
          barcode,
          description,
          categoryId: catBySlug.get(slug)!,
          supplierId: sups[supplierIndex].id,
          uom,
          costPrice: cost,
          sellingPrice: price,
          discountPct: discount,
          minStock: min,
          maxStock: max,
          imageUrl: swatch(name, i),
          status: "ACTIVE",
        },
      }),
    );
  }

  const onHand = products.map((_, pi) => wh.map((__, wi) => openingQty(pi, wi)));
  const rand = mulberry32(20261015);
  const sales: {
    at: Date;
    warehouseIndex: number;
    customerIndex: number | null;
    status: "COMPLETED" | "CONFIRMED" | "PROCESSING";
    discount: number;
    taxPct: number;
    items: { productIndex: number; quantity: number; unitPrice: number }[];
  }[] = [];

  for (let d = 89; d >= 0; d--) {
    const orders = d < 30 ? 2 : d % 4 === 0 ? 1 : 0;
    for (let o = 0; o < orders; o++) {
      const warehouseIndex = (d + o * 2) % 3;
      const items: { productIndex: number; quantity: number; unitPrice: number }[] = [];
      const used = new Set<number>();
      const itemCount = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < itemCount; k++) {
        let productIndex = Math.floor(rand() * products.length);
        let guard = 0;
        while (used.has(productIndex) && guard < 8) {
          productIndex = (productIndex + 1) % products.length;
          guard++;
        }
        used.add(productIndex);
        if (onHand[productIndex][warehouseIndex] < 4) continue;
        const quantity = Math.min(onHand[productIndex][warehouseIndex] - 1, 1 + Math.floor(rand() * 4));
        if (quantity <= 0) continue;
        onHand[productIndex][warehouseIndex] -= quantity;
        const product = products[productIndex];
        items.push({
          productIndex,
          quantity,
          unitPrice: Math.round(product.sellingPrice * (1 - product.discountPct / 100) * 100) / 100,
        });
      }
      if (!items.length) continue;
      let status: "COMPLETED" | "CONFIRMED" | "PROCESSING" = "COMPLETED";
      if (d < 2 && o === 0) status = "CONFIRMED";
      if (d === 3 && o === 0) status = "PROCESSING";
      sales.push({
        at: daysAgo(d, 9 + ((o * 3) % 8)),
        warehouseIndex,
        customerIndex: rand() < 0.22 ? null : Math.floor(rand() * customers.length),
        status,
        discount: sales.length % 11 === 0 ? 1 : 0,
        taxPct: sales.length % 17 === 0 ? 10 : 0,
        items,
      });
    }
  }

  const lows: [number, number, number][] = [
    [2, 0, 0],
    [4, 1, 2],
    [9, 2, 0],
    [16, 0, 3],
    [1, 2, 1],
    [14, 1, 4],
  ];
  const adjustments = lows.map(([pi, wi, qty]) => {
    const delta = qty - onHand[pi][wi];
    onHand[pi][wi] = qty;
    return { pi, wi, delta };
  });

  const transferQty = Math.min(8, onHand[0][0]);
  if (transferQty > 0) {
    onHand[0][0] -= transferQty;
    onHand[0][1] += transferQty;
  }

  for (let pi = 0; pi < products.length; pi++) {
    for (let wi = 0; wi < wh.length; wi++) {
      await prisma.productInventory.create({
        data: {
          productId: products[pi].id,
          warehouseId: wh[wi].id,
          quantity: onHand[pi][wi],
          reserved: pi === 0 && wi === 0 && onHand[pi][wi] > 10 ? 3 : 0,
          bin: binFor(pi, wi),
        },
      });
      await prisma.inventoryTransaction.create({
        data: {
          productId: products[pi].id,
          warehouseId: wh[wi].id,
          type: "STOCK_IN",
          quantity: openingQty(pi, wi),
          notes: "Opening balance",
          userId: admin.id,
          createdAt: daysAgo(90, 8),
        },
      });
    }
  }

  for (let i = 0; i < sales.length; i++) {
    const sale = sales[i];
    const subtotal = sale.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const total = Math.round(Math.max(0, subtotal - sale.discount) * (1 + sale.taxPct / 100) * 100) / 100;
    const order = await prisma.salesOrder.create({
      data: {
        orderNumber: `SO-${year}-${String(i + 1).padStart(4, "0")}`,
        customerId: sale.customerIndex === null ? null : cust[sale.customerIndex].id,
        warehouseId: wh[sale.warehouseIndex].id,
        orderDate: sale.at,
        deliveryDate: sale.at,
        status: sale.status,
        discount: sale.discount,
        taxPct: sale.taxPct,
        subtotal: Math.round(subtotal * 100) / 100,
        total,
        stockApplied: true,
        createdById: createdUsers[2].id,
        createdAt: sale.at,
        notes: sale.customerIndex === null ? "Walk-in counter sale" : null,
        items: {
          create: sale.items.map((item) => ({
            productId: products[item.productIndex].id,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
    });
    for (const item of sale.items) {
      await prisma.inventoryTransaction.create({
        data: {
          productId: products[item.productIndex].id,
          warehouseId: wh[sale.warehouseIndex].id,
          type: "SALE",
          quantity: -item.quantity,
          notes: order.orderNumber,
          userId: createdUsers[2].id,
          referenceType: "SALES_ORDER",
          referenceId: order.id,
          createdAt: sale.at,
        },
      });
    }
  }

  for (const adj of adjustments) {
    if (adj.delta === 0) continue;
    await prisma.inventoryTransaction.create({
      data: {
        productId: products[adj.pi].id,
        warehouseId: wh[adj.wi].id,
        type: "ADJUSTMENT",
        quantity: adj.delta,
        notes: "Cycle count",
        userId: createdUsers[1].id,
        createdAt: daysAgo(1, 16),
      },
    });
  }

  if (transferQty > 0) {
    const received = await prisma.stockTransfer.create({
      data: {
        transferNumber: `TR-${year}-0001`,
        sourceWarehouseId: wh[0].id,
        destWarehouseId: wh[1].id,
        transferDate: daysAgo(12, 11),
        status: "RECEIVED",
        stockApplied: true,
        notes: "Rice top-up for Siem Reap",
        createdById: createdUsers[1].id,
        createdAt: daysAgo(12, 11),
        items: { create: [{ productId: products[0].id, requestedQty: transferQty, receivedQty: transferQty }] },
      },
    });
    await prisma.inventoryTransaction.create({
      data: {
        productId: products[0].id,
        warehouseId: wh[0].id,
        type: "TRANSFER_OUT",
        quantity: -transferQty,
        notes: received.transferNumber,
        userId: createdUsers[1].id,
        referenceType: "STOCK_TRANSFER",
        referenceId: received.id,
        createdAt: daysAgo(12, 11),
      },
    });
    await prisma.inventoryTransaction.create({
      data: {
        productId: products[0].id,
        warehouseId: wh[1].id,
        type: "TRANSFER_IN",
        quantity: transferQty,
        notes: received.transferNumber,
        userId: createdUsers[1].id,
        referenceType: "STOCK_TRANSFER",
        referenceId: received.id,
        createdAt: daysAgo(11, 15),
      },
    });
  }

  await prisma.stockTransfer.create({
    data: {
      transferNumber: `TR-${year}-0002`,
      sourceWarehouseId: wh[0].id,
      destWarehouseId: wh[2].id,
      status: "IN_TRANSIT",
      notes: "Soap and toothpaste for the port shop",
      createdById: createdUsers[1].id,
      items: {
        create: [
          { productId: products[18].id, requestedQty: 12 },
          { productId: products[19].id, requestedQty: 8 },
        ],
      },
    },
  });
  await prisma.stockTransfer.create({
    data: {
      transferNumber: `TR-${year}-0003`,
      sourceWarehouseId: wh[1].id,
      destWarehouseId: wh[0].id,
      status: "PENDING_APPROVAL",
      notes: "Return unsold bulbs",
      createdById: createdUsers[3].id,
      items: { create: [{ productId: products[15].id, requestedQty: 10 }] },
    },
  });
  await prisma.stockTransfer.create({
    data: {
      transferNumber: `TR-${year}-0004`,
      sourceWarehouseId: wh[2].id,
      destWarehouseId: wh[0].id,
      status: "DRAFT",
      createdById: admin.id,
      items: { create: [{ productId: products[9].id, requestedQty: 24 }] },
    },
  });

  const poSpecs = [
    { n: 1, status: "DRAFT", supplier: 0, warehouse: 0, items: [[0, 20, 4.2], [1, 12, 3.1]] },
    { n: 2, status: "SUBMITTED", supplier: 1, warehouse: 0, items: [[2, 40, 1.15], [5, 24, 0.85]] },
    { n: 3, status: "APPROVED", supplier: 2, warehouse: 1, items: [[15, 30, 0.8], [16, 6, 3.4]] },
    { n: 4, status: "PARTIALLY_RECEIVED", supplier: 3, warehouse: 2, items: [[9, 80, 0.22], [12, 36, 0.35]] },
  ] as const;
  for (const po of poSpecs) {
    const lines = po.items.map(([index, quantity, unitCost]) => ({
      productId: products[index].id,
      quantity,
      unitCost,
      receivedQty: po.status === "PARTIALLY_RECEIVED" ? Math.round(quantity / 2) : 0,
    }));
    await prisma.purchaseOrder.create({
      data: {
        orderNumber: `PO-${year}-${String(po.n).padStart(4, "0")}`,
        supplierId: sups[po.supplier].id,
        warehouseId: wh[po.warehouse].id,
        orderDate: daysAgo(6 + po.n, 9),
        expectedDelivery: daysAgo(-4, 9),
        status: po.status,
        total: lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0),
        createdById: createdUsers[1].id,
        notes: po.status === "DRAFT" ? "Waiting on a price check" : null,
        items: { create: lines },
      },
    });
  }

  await prisma.salesOrder.create({
    data: {
      orderNumber: `SO-${year}-${String(sales.length + 1).padStart(4, "0")}`,
      customerId: cust[0].id,
      warehouseId: wh[0].id,
      status: "DRAFT",
      deliveryDate: daysAgo(-2, 10),
      discount: 0,
      taxPct: 0,
      subtotal: 13,
      total: 13,
      stockApplied: false,
      createdById: createdUsers[2].id,
      notes: "Hold for Lotus Mart pickup",
      items: {
        create: [
          { productId: products[0].id, quantity: 2, unitPrice: 6.5 },
        ],
      },
    },
  });

  const audits = [
    ["LOGIN", "USER", admin.id, "admin@sovann.kh signed in", 2],
    ["CREATE", "PRODUCT", products[0].id, "Created RICE-5KG", 20],
    ["STOCK_ADJUST", "INVENTORY", products[2].id, "Cycle count on fish sauce", 1],
    ["STATUS_CHANGE", "PURCHASE_ORDER", null, `PO-${year}-0003 → APPROVED`, 4],
    ["CREATE", "SALES_ORDER", null, "Counter sales posted", 0],
    ["UPDATE", "SUPPLIER", sups[0].id, "Updated supplier Kampot Harvest Co.", 8],
  ] as const;
  for (const [action, resourceType, resourceId, description, days] of audits) {
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action,
        resourceType,
        resourceId,
        description,
        createdAt: daysAgo(days, 14),
      },
    });
  }

  console.log(`Seeded ${products.length} products, ${sales.length} sales, ${wh.length} warehouses.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

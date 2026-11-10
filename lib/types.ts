export type PageResult<T> = { data: T[]; total: number; page: number; pageSize: number };

export type Warehouse = {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  city?: string | null;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  _count?: { products: number };
};

export type Party = {
  id: string;
  /** Customers only: their open (unpaid) take & return invoice. */
  openInvoice?: { id: string; total: number } | null;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  notes?: string | null;
  status: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  avatarUrl?: string | null;
  status: string;
  warehouseId?: string | null;
  warehouse?: Warehouse | null;
};

export type StaffUser = AuthUser & { createdAt?: string };

export type Product = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  description?: string | null;
  categoryId: string;
  supplierId?: string | null;
  uom: string;
  costPrice: number;
  sellingPrice: number;
  discountPct: number;
  minStock: number;
  maxStock: number;
  imageUrl?: string | null;
  status: string;
  totalStock?: number;
  category?: Category | null;
  supplier?: { id: string; name: string } | null;
  inventory?: InventoryRow[];
};

export type MetaProduct = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  uom: string;
  costPrice: number;
  sellingPrice: number;
  discountPct: number;
  categoryId: string;
  supplierId?: string | null;
  minStock: number;
  status: string;
};

export type Meta = {
  warehouses: Warehouse[];
  categories: Category[];
  suppliers: { id: string; name: string }[];
  customers: { id: string; name: string }[];
  products: MetaProduct[];
};

export type InventoryRow = {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  reserved: number;
  bin?: string | null;
  updatedAt: string;
  product?: Product;
  warehouse?: Warehouse;
};

export type StockMove = {
  id: string;
  type: string;
  quantity: number;
  notes?: string | null;
  createdAt: string;
  warehouse?: Warehouse;
  product?: { name: string; sku: string };
  user?: { name: string } | null;
};

export type PurchaseItem = {
  id: string;
  productId: string;
  quantity: number;
  unitCost: number;
  receivedQty: number;
  product?: { id: string; name: string; sku: string };
};

export type PurchaseOrder = {
  id: string;
  orderNumber: string;
  supplierId: string;
  warehouseId: string;
  orderDate: string;
  expectedDelivery?: string | null;
  status: string;
  notes?: string | null;
  total: number;
  supplier?: { id: string; name: string; phone?: string | null; city?: string | null; email?: string | null };
  warehouse?: Warehouse;
  items: PurchaseItem[];
};

export type SalesItem = {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  returnedQty: number;
  createdAt?: string;
  product?: { id: string; name: string; sku: string };
};

export type SalesOrder = {
  id: string;
  orderNumber: string;
  customerId?: string | null;
  warehouseId: string;
  orderDate: string;
  deliveryDate?: string | null;
  status: string;
  kind: "SALE" | "CONSIGN";
  notes?: string | null;
  discount: number;
  taxPct: number;
  subtotal: number;
  total: number;
  customer?: { id: string; name: string; phone?: string | null; city?: string | null; email?: string | null } | null;
  warehouse?: Warehouse;
  items: SalesItem[];
};

export type TransferItem = {
  id: string;
  productId: string;
  requestedQty: number;
  receivedQty: number;
  product?: { id: string; name: string; sku: string };
};

export type StockTransfer = {
  id: string;
  transferNumber: string;
  sourceWarehouseId: string;
  destWarehouseId: string;
  transferDate: string;
  status: string;
  notes?: string | null;
  sourceWarehouse?: Warehouse;
  destWarehouse?: Warehouse;
  items: TransferItem[];
};

export type LowStockRow = {
  id: string;
  productId: string;
  warehouseId: string;
  supplierId?: string | null;
  product: string;
  sku: string;
  warehouse: string;
  quantity: number;
  minStock: number;
  shortage: number;
  updatedAt: string;
  level: "critical" | "warning";
};

export type AuditRow = {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  description: string;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
};

export type InvoiceData = {
  orderNumber: string;
  orderDate: string;
  customerName: string;
  customerPhone?: string | null;
  warehouseName: string;
  /** Take & return: show taken / returned / sold per line. */
  consign?: boolean;
  /** quantity = what is charged (sold); taken/returned only matter for take & return. */
  items: { name: string; sku?: string; date?: string; taken: number; returned: number; quantity: number; unitPrice: number }[];
  discount: number;
  taxPct: number;
  subtotal: number;
  total: number;
  notes?: string | null;
};

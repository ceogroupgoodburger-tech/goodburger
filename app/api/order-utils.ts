import { extras, findProduct, meats } from "../menu-data";
import { storeConfig } from "../store-config";
import { getRuntimeEnv } from "./runtime-env";

type IncomingExtra = {
  id?: string;
};

type IncomingCartItem = {
  productId?: string;
  quantity?: number;
  extras?: IncomingExtra[];
  choices?: string[];
  note?: string;
};

export type IncomingCustomer = {
  name?: string;
  phone?: string;
  orderType?: "Entrega" | "Retirada";
  address?: string;
  payment?: string;
  changeFor?: string;
};

export type NormalizedOrderItem = {
  productId: string;
  title: string;
  quantity: number;
  unitPrice: number;
  extras: Array<{ id: string; name: string; price: number }>;
  choices: string[];
  note: string;
};

export type NormalizedOrder = {
  orderId: string;
  customer: IncomingCustomer;
  items: NormalizedOrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  totalCents: number;
};

export type AdminOrder = {
  id: string;
  customerName: string;
  customerPhone: string;
  orderType: string;
  address: string;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  mercadoPagoPaymentId: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  totalCents: number;
  createdAt: number;
  updatedAt: number;
  items: NormalizedOrderItem[];
  customer: IncomingCustomer;
};

export type OrderStatus = {
  id: string;
  paymentStatus: string;
  orderStatus: string;
  total: number;
  updatedAt: number;
};

type ListOrdersOptions = {
  limit?: number;
  startAt?: number;
  endAt?: number;
};

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results?: T[] }>;
};

type D1Like = {
  prepare(query: string): D1PreparedStatement;
};

type OrderRow = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  order_type: string;
  address: string | null;
  payment_method: string;
  payment_status: string;
  order_status: string | null;
  mercado_pago_payment_id: string | null;
  total_cents: number;
  payload: string;
  created_at: number;
  updated_at: number;
};

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

const STORE_STATUS_ORDER_ID = "__goodburger_store_status__";

export type StoreStatus = {
  isOpen: boolean;
  message: string;
  updatedAt: number;
};

export function getAccessToken() {
  const runtime = getRuntimeEnv();
  return runtime.MERCADO_PAGO_ACCESS_TOKEN ?? process.env.MERCADO_PAGO_ACCESS_TOKEN;
}

export function getSiteOrigin(request: Request) {
  const runtime = getRuntimeEnv();
  return (
    runtime.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    new URL(request.url).origin
  );
}

export function getAdminToken() {
  const runtime = getRuntimeEnv();
  return runtime.ORDERS_ADMIN_TOKEN ?? process.env.ORDERS_ADMIN_TOKEN ?? getAdminPassword();
}

export function getAdminUsername() {
  const runtime = getRuntimeEnv();
  return runtime.ADMIN_USERNAME ?? process.env.ADMIN_USERNAME ?? "";
}

export function getAdminPassword() {
  const runtime = getRuntimeEnv();
  return runtime.ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "";
}

export function getPixKey() {
  const runtime = getRuntimeEnv();
  return runtime.PIX_KEY ?? process.env.PIX_KEY ?? "";
}

export function getPixMerchantName() {
  const runtime = getRuntimeEnv();
  return runtime.PIX_MERCHANT_NAME ?? process.env.PIX_MERCHANT_NAME ?? "Good Burger";
}

export function getPixMerchantCity() {
  const runtime = getRuntimeEnv();
  return runtime.PIX_MERCHANT_CITY ?? process.env.PIX_MERCHANT_CITY ?? "GUARAPARI";
}

function getSupabaseConfig(): SupabaseConfig | undefined {
  const runtime = getRuntimeEnv();
  const url = (runtime.SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").trim();
  const serviceRoleKey = (
    runtime.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    ""
  ).trim();

  if (!url || !serviceRoleKey) return undefined;

  return {
    url: url.replace(/\/+$/, ""),
    serviceRoleKey,
  };
}

export function getDatabase(): D1Like | undefined {
  const db = getRuntimeEnv().DB;
  if (db && typeof (db as D1Like).prepare === "function") {
    return db as D1Like;
  }
  return undefined;
}

async function supabaseRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error("Supabase nao configurado.");
  }

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Supabase respondeu ${response.status}.`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

function hasOrderStorage() {
  return Boolean(getDatabase() || getSupabaseConfig());
}

function getDefaultStoreStatus(): StoreStatus {
  return {
    isOpen: true,
    message: "Loja aberta",
    updatedAt: 0,
  };
}

function productAllowsExtras(product: { category: string }) {
  return product.category !== "Bebidas" && product.category !== "Sobremesas";
}

async function ensureColumn(db: D1Like, column: string, definition: string) {
  try {
    await db.prepare(`SELECT ${column} FROM orders LIMIT 1`).first();
  } catch {
    try {
      await db.prepare(`ALTER TABLE orders ADD COLUMN ${column} ${definition}`).run();
    } catch {
      // The column may have been added by a concurrent request.
    }
  }
}

export async function ensureOrdersTable(db: D1Like) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        customer_name TEXT,
        customer_phone TEXT,
        order_type TEXT NOT NULL,
        address TEXT,
        payment_method TEXT NOT NULL,
        payment_status TEXT NOT NULL DEFAULT 'pending',
        order_status TEXT NOT NULL DEFAULT 'pending_payment',
        mercado_pago_payment_id TEXT,
        total_cents INTEGER NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    )
    .run();

  await ensureColumn(db, "order_status", "TEXT NOT NULL DEFAULT 'pending_payment'");
  await db
    .prepare("CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at)")
    .run();
  await db
    .prepare("CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders (payment_status)")
    .run();
  await db
    .prepare("CREATE INDEX IF NOT EXISTS orders_order_status_idx ON orders (order_status)")
    .run();
}

export function normalizeOrder(cart: IncomingCartItem[], customer: IncomingCustomer) {
  if (!Array.isArray(cart) || cart.length === 0) {
    throw new Error("Carrinho vazio.");
  }

  const items = cart.map((item) => {
    const product = findProduct(String(item.productId ?? ""));
    if (!product) {
      throw new Error("Item invalido no carrinho.");
    }

    const quantity = Math.max(1, Math.min(30, Number(item.quantity ?? 1)));
    const selectedExtras = Array.isArray(item.extras) && productAllowsExtras(product)
      ? item.extras
          .map((extra) => extras.find((candidate) => candidate.id === extra.id))
          .filter((extra): extra is (typeof extras)[number] => Boolean(extra))
      : [];

    const choices = Array.isArray(item.choices)
      ? item.choices.map((choice) => String(choice)).filter(Boolean).slice(0, 8)
      : [];

    let unitPrice = product.price;
    if (product.custom) {
      const selectedMeat = meats.find((meat) =>
        choices.some((choice) => choice.toLowerCase() === meat.name.toLowerCase()),
      );
      unitPrice = selectedMeat?.price ?? meats[0].price;
    }

    return {
      productId: product.id,
      title: product.name,
      quantity,
      unitPrice,
      extras: selectedExtras,
      choices,
      note: String(item.note ?? "").slice(0, 240),
    };
  });

  const subtotal = items.reduce((sum, item) => {
    const extrasTotal = item.extras.reduce((extraSum, extra) => extraSum + extra.price, 0);
    return sum + (item.unitPrice + extrasTotal) * item.quantity;
  }, 0);
  const deliveryFee = customer.orderType === "Entrega" ? storeConfig.deliveryFee : 0;
  const total = subtotal + deliveryFee;

  const orderId = `WB-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  return {
    orderId,
    customer,
    items,
    subtotal,
    deliveryFee,
    total,
    totalCents: Math.round(total * 100),
  };
}

async function saveOrder(
  order: NormalizedOrder,
  paymentStatus: string,
  orderStatus: string,
) {
  const db = getDatabase();
  if (!db && !hasOrderStorage()) return false;

  const now = Date.now();

  if (!db) {
    await supabaseRequest<undefined>("orders?on_conflict=id", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        id: order.orderId,
        customer_name: order.customer.name ?? "",
        customer_phone: order.customer.phone ?? "",
        order_type: order.customer.orderType ?? "Entrega",
        address: order.customer.address ?? "",
        payment_method: order.customer.payment ?? "Cartão de crédito",
        payment_status: paymentStatus,
        order_status: orderStatus,
        total_cents: order.totalCents,
        payload: JSON.stringify(order),
        created_at: now,
        updated_at: now,
      }),
    });
    return true;
  }

  await ensureOrdersTable(db);

  await db
    .prepare(
      `INSERT INTO orders (
        id,
        customer_name,
        customer_phone,
        order_type,
        address,
        payment_method,
        payment_status,
        order_status,
        total_cents,
        payload,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        customer_name = excluded.customer_name,
        customer_phone = excluded.customer_phone,
        order_type = excluded.order_type,
        address = excluded.address,
        payment_method = excluded.payment_method,
        payment_status = excluded.payment_status,
        order_status = excluded.order_status,
        total_cents = excluded.total_cents,
        payload = excluded.payload,
        updated_at = excluded.updated_at`,
    )
    .bind(
      order.orderId,
      order.customer.name ?? "",
      order.customer.phone ?? "",
      order.customer.orderType ?? "Entrega",
      order.customer.address ?? "",
      order.customer.payment ?? "Cartão de crédito",
      paymentStatus,
      orderStatus,
      order.totalCents,
      JSON.stringify(order),
      now,
      now,
    )
    .run();
  return true;
}

export async function savePendingOrder(order: NormalizedOrder) {
  return saveOrder(order, "pending", "pending_payment");
}

export async function savePixPendingOrder(order: NormalizedOrder) {
  return saveOrder(order, "pix_pending", "pending_payment");
}

export async function saveLocalPaymentOrder(order: NormalizedOrder) {
  return saveOrder(order, "local_pending", "received");
}

export async function getStoreStatus(): Promise<StoreStatus> {
  const db = getDatabase();
  if (!db && !hasOrderStorage()) return getDefaultStoreStatus();

  if (!db) {
    const rows = await supabaseRequest<Pick<OrderRow, "payload" | "updated_at">[]>(
      `orders?select=payload,updated_at&id=eq.${encodeURIComponent(STORE_STATUS_ORDER_ID)}&limit=1`,
      { method: "GET" },
    );
    const row = rows[0];
    if (!row) return getDefaultStoreStatus();

    try {
      const parsed = JSON.parse(row.payload) as Partial<StoreStatus>;
      return {
        isOpen: parsed.isOpen !== false,
        message: String(parsed.message ?? (parsed.isOpen === false ? "Loja fechada" : "Loja aberta")),
        updatedAt: Number(parsed.updatedAt ?? row.updated_at ?? 0),
      };
    } catch {
      return getDefaultStoreStatus();
    }
  }

  await ensureOrdersTable(db);
  const row = await db
    .prepare(
      `SELECT payload, updated_at
       FROM orders
       WHERE id = ?
       LIMIT 1`,
    )
    .bind(STORE_STATUS_ORDER_ID)
    .first<Pick<OrderRow, "payload" | "updated_at">>();

  if (!row) return getDefaultStoreStatus();

  try {
    const parsed = JSON.parse(row.payload) as Partial<StoreStatus>;
    return {
      isOpen: parsed.isOpen !== false,
      message: String(parsed.message ?? (parsed.isOpen === false ? "Loja fechada" : "Loja aberta")),
      updatedAt: Number(parsed.updatedAt ?? row.updated_at ?? 0),
    };
  } catch {
    return getDefaultStoreStatus();
  }
}

export async function isStoreOpen() {
  return (await getStoreStatus()).isOpen;
}

export async function setStoreStatus(isOpen: boolean): Promise<StoreStatus | undefined> {
  const db = getDatabase();
  if (!db && !hasOrderStorage()) return undefined;

  const now = Date.now();
  const status: StoreStatus = {
    isOpen,
    message: isOpen ? "Loja aberta" : "Loja fechada",
    updatedAt: now,
  };

  if (!db) {
    await supabaseRequest<undefined>("orders?on_conflict=id", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        id: STORE_STATUS_ORDER_ID,
        customer_name: "Sistema",
        customer_phone: "",
        order_type: "Sistema",
        address: "",
        payment_method: "Sistema",
        payment_status: "system",
        order_status: "system",
        total_cents: 0,
        payload: JSON.stringify(status),
        created_at: now,
        updated_at: now,
      }),
    });
    return status;
  }

  await ensureOrdersTable(db);
  await db
    .prepare(
      `INSERT INTO orders (
        id,
        customer_name,
        customer_phone,
        order_type,
        address,
        payment_method,
        payment_status,
        order_status,
        total_cents,
        payload,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        payment_status = excluded.payment_status,
        order_status = excluded.order_status,
        payload = excluded.payload,
        updated_at = excluded.updated_at`,
    )
    .bind(
      STORE_STATUS_ORDER_ID,
      "Sistema",
      "",
      "Sistema",
      "",
      "Sistema",
      "system",
      "system",
      0,
      JSON.stringify(status),
      now,
      now,
    )
    .run();

  return status;
}

export async function updateOrderPayment(orderId: string, paymentStatus: string, paymentId: string) {
  const db = getDatabase();
  const pendingStatuses = new Set(["pending", "in_process", "in_mediation"]);
  const nextOrderStatus =
    paymentStatus === "approved"
      ? "received"
      : pendingStatuses.has(paymentStatus)
        ? "pending_payment"
        : "payment_failed";

  if (!db && !hasOrderStorage()) return false;

  if (!db) {
    await supabaseRequest<undefined>(`orders?id=eq.${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        payment_status: paymentStatus,
        order_status: nextOrderStatus,
        mercado_pago_payment_id: paymentId,
        updated_at: Date.now(),
      }),
    });
    return true;
  }

  await ensureOrdersTable(db);

  await db
    .prepare(
      `UPDATE orders
       SET payment_status = ?,
           order_status = ?,
           mercado_pago_payment_id = ?,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(paymentStatus, nextOrderStatus, paymentId, Date.now(), orderId)
    .run();
  return true;
}

function parseOrderRow(row: OrderRow): AdminOrder {
  let parsed: NormalizedOrder | null = null;
  try {
    parsed = JSON.parse(row.payload) as NormalizedOrder;
  } catch {
    parsed = null;
  }

  return {
    id: row.id,
    customerName: row.customer_name ?? "",
    customerPhone: row.customer_phone ?? "",
    orderType: row.order_type,
    address: row.address ?? "",
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    orderStatus: row.order_status ?? "pending_payment",
    mercadoPagoPaymentId: row.mercado_pago_payment_id ?? "",
    subtotal: parsed?.subtotal ?? row.total_cents / 100,
    deliveryFee: parsed?.deliveryFee ?? 0,
    total: row.total_cents / 100,
    totalCents: row.total_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: parsed?.items ?? [],
    customer: parsed?.customer ?? {},
  };
}

export async function listOrders(options: number | ListOrdersOptions = 80) {
  const db = getDatabase();
  if (!db && !hasOrderStorage()) return undefined;

  const normalizedOptions = typeof options === "number" ? { limit: options } : options;
  const safeLimit = Math.max(1, Math.min(500, normalizedOptions.limit ?? 80));
  const startAt = Number.isFinite(normalizedOptions.startAt)
    ? Number(normalizedOptions.startAt)
    : undefined;
  const endAt = Number.isFinite(normalizedOptions.endAt)
    ? Number(normalizedOptions.endAt)
    : undefined;

  if (!db) {
    const fields = [
      "id",
      "customer_name",
      "customer_phone",
      "order_type",
      "address",
      "payment_method",
      "payment_status",
      "order_status",
      "mercado_pago_payment_id",
      "total_cents",
      "payload",
      "created_at",
      "updated_at",
    ].join(",");
    const filters = [
      `select=${fields}`,
      `id=neq.${encodeURIComponent(STORE_STATUS_ORDER_ID)}`,
      "order=created_at.desc",
      `limit=${safeLimit}`,
      startAt !== undefined ? `created_at=gte.${startAt}` : "",
      endAt !== undefined ? `created_at=lt.${endAt}` : "",
    ].filter(Boolean);
    const rows = await supabaseRequest<OrderRow[]>(`orders?${filters.join("&")}`, {
      method: "GET",
    });
    return rows.map(parseOrderRow);
  }

  await ensureOrdersTable(db);
  const where: string[] = ["id != ?"];
  const values: unknown[] = [STORE_STATUS_ORDER_ID];
  if (startAt !== undefined) {
    where.push("created_at >= ?");
    values.push(startAt);
  }
  if (endAt !== undefined) {
    where.push("created_at < ?");
    values.push(endAt);
  }
  values.push(safeLimit);

  const result = await db
    .prepare(
      `SELECT id,
              customer_name,
              customer_phone,
              order_type,
              address,
              payment_method,
              payment_status,
              order_status,
              mercado_pago_payment_id,
              total_cents,
              payload,
              created_at,
              updated_at
       FROM orders
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(...values)
    .all<OrderRow>();

  return (result.results ?? []).map(parseOrderRow);
}

export async function getOrderStatus(orderId: string) {
  const db = getDatabase();
  if (!db && !hasOrderStorage()) return undefined;

  if (!db) {
    const fields = [
      "id",
      "payment_status",
      "order_status",
      "total_cents",
      "updated_at",
    ].join(",");
    const rows = await supabaseRequest<OrderRow[]>(
      `orders?select=${fields}&id=eq.${encodeURIComponent(orderId)}&limit=1`,
      { method: "GET" },
    );
    const order = rows[0];
    if (!order) return null;

    return {
      id: order.id,
      paymentStatus: order.payment_status,
      orderStatus: order.order_status ?? "pending_payment",
      total: order.total_cents / 100,
      updatedAt: order.updated_at,
    } satisfies OrderStatus;
  }

  await ensureOrdersTable(db);
  const order = await db
    .prepare(
      `SELECT id, payment_status, order_status, total_cents, updated_at
       FROM orders
       WHERE id = ?`,
    )
    .bind(orderId)
    .first<OrderRow>();

  if (!order) return null;

  return {
    id: order.id,
    paymentStatus: order.payment_status,
    orderStatus: order.order_status ?? "pending_payment",
    total: order.total_cents / 100,
    updatedAt: order.updated_at,
  } satisfies OrderStatus;
}

export async function updateOrderStatus(orderId: string, orderStatus: string) {
  const allowedStatuses = new Set([
    "received",
    "preparing",
    "ready",
    "out_for_delivery",
    "delivered",
    "cancelled",
  ]);
  if (!allowedStatuses.has(orderStatus)) {
    throw new Error("Status de pedido invalido.");
  }

  const db = getDatabase();
  if (!db && !hasOrderStorage()) return false;

  if (!db) {
    await supabaseRequest<undefined>(`orders?id=eq.${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        order_status: orderStatus,
        updated_at: Date.now(),
      }),
    });
    return true;
  }

  await ensureOrdersTable(db);
  await db
    .prepare(
      `UPDATE orders
       SET order_status = ?,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(orderStatus, Date.now(), orderId)
    .run();
  return true;
}

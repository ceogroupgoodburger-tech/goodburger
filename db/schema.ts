import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  orderType: text("order_type").notNull(),
  address: text("address"),
  paymentMethod: text("payment_method").notNull(),
  paymentStatus: text("payment_status").notNull().default("pending"),
  orderStatus: text("order_status").notNull().default("pending_payment"),
  mercadoPagoPaymentId: text("mercado_pago_payment_id"),
  totalCents: integer("total_cents").notNull(),
  payload: text("payload").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

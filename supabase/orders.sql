create table if not exists public.orders (
  id text primary key,
  customer_name text,
  customer_phone text,
  order_type text not null,
  address text,
  payment_method text not null,
  payment_status text not null default 'pending',
  order_status text not null default 'pending_payment',
  mercado_pago_payment_id text,
  total_cents integer not null,
  payload text not null,
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists orders_created_at_idx
  on public.orders (created_at desc);

create index if not exists orders_payment_status_idx
  on public.orders (payment_status);

create index if not exists orders_order_status_idx
  on public.orders (order_status);

alter table public.orders enable row level security;

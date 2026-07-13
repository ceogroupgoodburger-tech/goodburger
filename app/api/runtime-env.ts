import { getOrCreateAls } from "vinext/shims/internal/als-registry";

type RuntimeEnv = {
  DB?: unknown;
  MERCADO_PAGO_ACCESS_TOKEN?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  ORDERS_ADMIN_TOKEN?: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PIX_KEY?: string;
  PIX_MERCHANT_NAME?: string;
  PIX_MERCHANT_CITY?: string;
};

const runtimeEnv = getOrCreateAls<RuntimeEnv>("goodburger.runtime.env");

export function runWithRuntimeEnv<T>(env: RuntimeEnv, fn: () => T | Promise<T>) {
  return runtimeEnv.run(env, fn);
}

export function getRuntimeEnv() {
  return runtimeEnv.getStore() ?? {};
}

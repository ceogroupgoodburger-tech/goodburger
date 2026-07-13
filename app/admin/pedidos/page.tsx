"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency, products } from "../../menu-data";
import { storeConfig } from "../../store-config";

type AdminOrderItem = {
  productId: string;
  title: string;
  quantity: number;
  unitPrice: number;
  extras: Array<{ id: string; name: string; price: number }>;
  choices: string[];
  note: string;
};

type AdminOrder = {
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
  items: AdminOrderItem[];
  customer: {
    changeFor?: string;
  };
};

type StoreStatus = {
  isOpen: boolean;
  message: string;
  updatedAt: number;
};

const paymentLabels: Record<string, string> = {
  approved: "Pago online",
  local_pending: "Pagamento no local",
  pending: "Aguardando pagamento online",
  in_process: "Pagamento em análise",
  in_mediation: "Pagamento em análise",
  pix_pending: "Aguardando PIX",
  rejected: "Pagamento recusado",
  cancelled: "Pagamento cancelado",
};

const orderLabels: Record<string, string> = {
  pending_payment: "Aguardando pagamento",
  payment_failed: "Pagamento falhou",
  received: "Novo",
  preparing: "Preparando",
  ready: "Pronto",
  out_for_delivery: "Saiu para entrega",
  delivered: "Concluido",
  cancelled: "Cancelado",
};

const visiblePaymentStatuses = new Set(["approved", "local_pending"]);
const pendingPaymentStatuses = new Set(["pending", "pix_pending", "in_process", "in_mediation"]);
const completedOrderStatuses = new Set(["delivered", "cancelled"]);

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(timestamp));
}

function getDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDayRange(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + 1);
  return {
    startAt: start.getTime(),
    endAt: end.getTime(),
  };
}

function formatSelectedDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function buildOrderText(order: AdminOrder) {
  const items = order.items.map((item, index) => {
    const extrasTotal = item.extras.reduce((sum, extra) => sum + extra.price, 0);
    const details = [
      item.choices.length ? `Escolhas: ${item.choices.join(", ")}` : "",
      item.extras.length ? `Adicionais: ${item.extras.map((extra) => extra.name).join(", ")}` : "",
      item.note ? `Obs: ${item.note}` : "",
    ].filter(Boolean);

    return `${index + 1}. ${item.quantity}x ${item.title} - ${formatCurrency(
      (item.unitPrice + extrasTotal) * item.quantity,
    )}${details.length ? `\n   ${details.join("\n   ")}` : ""}`;
  });

  return [
    `Pedido ${order.id}`,
    `Status: ${orderLabels[order.orderStatus] ?? order.orderStatus}`,
    `Pagamento: ${paymentLabels[order.paymentStatus] ?? order.paymentStatus}`,
    "",
    ...items,
    "",
    `Subtotal: ${formatCurrency(order.subtotal || order.total - order.deliveryFee)}`,
    order.deliveryFee ? `Taxa de entrega: ${formatCurrency(order.deliveryFee)}` : "",
    `Total: ${formatCurrency(order.total)}`,
    `Cliente: ${order.customerName || "nao informado"}`,
    `Telefone: ${order.customerPhone || "nao informado"}`,
    order.orderType === "Entrega"
      ? `Entrega: ${order.address || "endereco nao informado"}`
      : "Retirada no balcao",
    order.customer.changeFor ? `Troco para: ${order.customer.changeFor}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

type CustomerMessageType =
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered";

function buildCustomerStatusText(order: AdminOrder, type: CustomerMessageType) {
  const firstName = order.customerName?.trim().split(/\s+/)[0] || "cliente";
  const deliveryLine =
    order.orderType === "Entrega"
      ? `Endereco: ${order.address || "endereco informado no pedido"}.`
      : "Retirada no balcao.";

  const messages: Record<CustomerMessageType, string> = {
    confirmed: `Olá, ${firstName}! Seu pedido ${order.id} na Good Burger foi confirmado. Total: ${formatCurrency(order.total)}. ${deliveryLine}`,
    preparing: `Ola, ${firstName}! Seu pedido ${order.id} ja esta em preparo.`,
    ready:
      order.orderType === "Entrega"
        ? `Ola, ${firstName}! Seu pedido ${order.id} esta pronto e logo sai para entrega.`
        : `Ola, ${firstName}! Seu pedido ${order.id} esta pronto para retirada no balcao.`,
    out_for_delivery: `Ola, ${firstName}! Seu pedido ${order.id} saiu para entrega. ${deliveryLine}`,
    delivered: `Olá, ${firstName}! Seu pedido ${order.id} foi concluído. Obrigado por pedir na Good Burger!`,
  };

  return messages[type];
}

function getCustomerWhatsappUrl(order: AdminOrder, type: CustomerMessageType) {
  const customerDigits = onlyDigits(order.customerPhone);
  if (!customerDigits) return "";

  return `https://wa.me/55${customerDigits.replace(/^55/, "")}?text=${encodeURIComponent(
    buildCustomerStatusText(order, type),
  )}`;
}

function ReceiptPrintView({ order }: { order: AdminOrder | null }) {
  if (!order) return null;

  return (
    <div className="print-only bg-white p-2 text-[11px] leading-tight text-black">
      <div className="text-center">
        <img
          src="/assets/goodburger/logo.jpg"
          alt="Good Burger"
          className="mx-auto mb-1 h-16 w-16 object-contain"
        />
        <h1 className="text-base font-black uppercase">Good Burger</h1>
        <p className="font-bold">Comanda / Recibo de Pedido</p>
      </div>

      <div className="my-2 border-y border-dashed border-black py-2">
        <p>
          <strong>Pedido:</strong> {order.id}
        </p>
        <p>
          <strong>Data:</strong> {formatTime(order.createdAt)}
        </p>
        <p>
          <strong>Status:</strong> {orderLabels[order.orderStatus] ?? order.orderStatus}
        </p>
        <p>
          <strong>Pagamento:</strong> {paymentLabels[order.paymentStatus] ?? order.paymentStatus}
        </p>
        <p>
          <strong>Forma:</strong> {order.paymentMethod}
        </p>
      </div>

      <div className="mb-2">
        <p>
          <strong>Cliente:</strong> {order.customerName || "nao informado"}
        </p>
        <p>
          <strong>Telefone:</strong> {order.customerPhone || "nao informado"}
        </p>
        <p>
          <strong>Tipo:</strong> {order.orderType}
        </p>
        <p>
          <strong>Endereco:</strong>{" "}
          {order.orderType === "Entrega" ? order.address || "nao informado" : "Retirada no balcao"}
        </p>
        {order.customer.changeFor ? (
          <p>
            <strong>Troco:</strong> {order.customer.changeFor}
          </p>
        ) : null}
      </div>

      <div className="border-y border-dashed border-black py-2">
        {order.items.map((item, index) => {
          const extrasTotal = item.extras.reduce((sum, extra) => sum + extra.price, 0);
          const itemTotal = (item.unitPrice + extrasTotal) * item.quantity;

          return (
            <div key={`${order.id}-print-${index}`} className="mb-2 break-inside-avoid">
              <p className="font-black">
                {item.quantity}x {item.title}
              </p>
              {item.choices.length ? <p>Escolhas: {item.choices.join(", ")}</p> : null}
              {item.extras.length ? (
                <p>Adicionais: {item.extras.map((extra) => extra.name).join(", ")}</p>
              ) : null}
              {item.note ? <p>Obs: {item.note}</p> : null}
              <p className="text-right font-bold">{formatCurrency(itemTotal)}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-2 space-y-1">
        <p className="flex justify-between">
          <span>Subtotal</span>
          <strong>{formatCurrency(order.subtotal || order.total - order.deliveryFee)}</strong>
        </p>
        <p className="flex justify-between">
          <span>Entrega</span>
          <strong>{formatCurrency(order.deliveryFee || 0)}</strong>
        </p>
        <p className="flex justify-between border-t border-black pt-1 text-sm">
          <span>Total</span>
          <strong>{formatCurrency(order.total)}</strong>
        </p>
      </div>

      <p className="mt-3 text-center text-[10px] font-bold">
        Desenvolvido por CEO Group
      </p>
    </div>
  );
}

export default function OrdersAdminPage() {
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [lastNotice, setLastNotice] = useState("");
  const [printOrder, setPrintOrder] = useState<AdminOrder | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => getDateInputValue());
  const [storeStatus, setStoreStatus] = useState<StoreStatus>({
    isOpen: true,
    message: "Loja aberta",
    updatedAt: 0,
  });
  const [storeStatusLoading, setStoreStatusLoading] = useState(false);
  const newestVisibleRef = useRef<number | null>(null);

  useEffect(() => {
    const savedToken = window.localStorage.getItem("goodburger-admin-token") ?? "";
    setToken(savedToken);
  }, []);

  const fetchStoreStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/store/status", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as Partial<StoreStatus>;
      setStoreStatus({
        isOpen: payload.isOpen !== false,
        message: String(payload.message ?? (payload.isOpen === false ? "Loja fechada" : "Loja aberta")),
        updatedAt: Number(payload.updatedAt ?? 0),
      });
    } catch {
      // O painel continua funcionando mesmo se o status da loja nao carregar.
    }
  }, []);

  useEffect(() => {
    void fetchStoreStatus();
  }, [fetchStoreStatus]);

  const visibleOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          visiblePaymentStatuses.has(order.paymentStatus) ||
          !["pending_payment", "payment_failed"].includes(order.orderStatus),
      ),
    [orders],
  );

  const pendingOnlineOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          pendingPaymentStatuses.has(order.paymentStatus) &&
          order.orderStatus === "pending_payment",
      ),
    [orders],
  );

  const pendingPaymentOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          pendingPaymentStatuses.has(order.paymentStatus) &&
          order.orderStatus === "pending_payment",
      ),
    [orders],
  );

  const queueOrders = useMemo(
    () => visibleOrders.filter((order) => !completedOrderStatuses.has(order.orderStatus)),
    [visibleOrders],
  );

  const reportOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          visiblePaymentStatuses.has(order.paymentStatus) && order.orderStatus !== "cancelled",
      ),
    [orders],
  );

  const salesReport = useMemo(() => {
    const productStats = new Map(
      products.map((product) => [
        product.id,
        {
          id: product.id,
          name: product.name,
          quantity: 0,
          revenue: 0,
        },
      ]),
    );

    for (const order of reportOrders) {
      for (const item of order.items) {
        const stats =
          productStats.get(item.productId) ??
          {
            id: item.productId,
            name: item.title,
            quantity: 0,
            revenue: 0,
          };
        const extrasTotal = item.extras.reduce((sum, extra) => sum + extra.price, 0);
        stats.quantity += item.quantity;
        stats.revenue += (item.unitPrice + extrasTotal) * item.quantity;
        productStats.set(item.productId, stats);
      }
    }

    const stats = Array.from(productStats.values());
    const sortedByQuantity = [...stats].sort((a, b) => b.quantity - a.quantity);
    const slowMovers = [...stats].sort((a, b) => a.quantity - b.quantity || a.name.localeCompare(b.name));
    const revenue = reportOrders.reduce((sum, order) => sum + order.total, 0);
    const deliveryRevenue = reportOrders.reduce((sum, order) => sum + order.deliveryFee, 0);

    return {
      totalOrders: reportOrders.length,
      completedOrders: reportOrders.filter((order) => order.orderStatus === "delivered").length,
      revenue,
      deliveryRevenue,
      averageTicket: reportOrders.length ? revenue / reportOrders.length : 0,
      bestSellers: sortedByQuantity.filter((item) => item.quantity > 0).slice(0, 5),
      slowMovers: slowMovers.slice(0, 5),
    };
  }, [reportOrders]);

  const playAlert = useCallback(() => {
    if (!soundEnabled) return;
    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.42);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.45);
  }, [soundEnabled]);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");

    try {
      const { startAt, endAt } = getDayRange(selectedDate);
      const response = await fetch(
        `/api/admin/orders?limit=300&startAt=${startAt}&endAt=${endAt}`,
        {
        headers: { "x-admin-token": token },
        cache: "no-store",
        },
      );
      const payload = (await response.json()) as { orders?: AdminOrder[]; error?: string };
      if (!response.ok || !payload.orders) {
        throw new Error(payload.error ?? "Nao foi possivel carregar pedidos.");
      }

      const nextOrders = payload.orders;
      setOrders(nextOrders);

      const newestVisible = nextOrders
        .filter((order) => visiblePaymentStatuses.has(order.paymentStatus))
        .reduce((max, order) => Math.max(max, order.createdAt), 0);

      if (newestVisibleRef.current && newestVisible > newestVisibleRef.current) {
        setLastNotice("Pedido novo entrou.");
        playAlert();
      }
      if (newestVisible) {
        newestVisibleRef.current = newestVisible;
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }, [playAlert, selectedDate, token]);

  useEffect(() => {
    void fetchOrders();
    if (!token) return;
    const intervalId = window.setInterval(() => void fetchOrders(), 8000);
    return () => window.clearInterval(intervalId);
  }, [fetchOrders, token]);

  const login = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await response.json()) as { token?: string; error?: string };
      if (!response.ok || !payload.token) {
        throw new Error(payload.error ?? "Nao foi possivel entrar.");
      }

      window.localStorage.setItem("goodburger-admin-token", payload.token);
      newestVisibleRef.current = null;
      setToken(payload.token);
      setPassword("");
      setLastNotice("Painel conectado.");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    window.localStorage.removeItem("goodburger-admin-token");
    setToken("");
    setOrders([]);
    setLastNotice("");
  };

  const toggleStoreStatus = async () => {
    if (!token) return;
    setStoreStatusLoading(true);
    setError("");

    try {
      const nextIsOpen = !storeStatus.isOpen;
      const response = await fetch("/api/store/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify({ isOpen: nextIsOpen }),
      });
      const payload = (await response.json()) as StoreStatus & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Nao foi possivel alterar o status da loja.");
      }

      setStoreStatus(payload);
      setLastNotice(nextIsOpen ? "Loja aberta para pedidos." : "Loja fechada para pedidos.");
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Erro inesperado.");
    } finally {
      setStoreStatusLoading(false);
    }
  };

  const updateStatus = async (orderId: string, orderStatus: string) => {
    if (!token) return;
    await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
      },
      body: JSON.stringify({ orderId, orderStatus }),
    });
    await fetchOrders();
  };

  const confirmPayment = async (orderId: string) => {
    if (!token) return;
    const response = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
      },
      body: JSON.stringify({
        orderId,
        paymentStatus: "approved",
        paymentId: "pix-confirmado-manualmente",
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? "Nao foi possivel confirmar o pagamento.");
      return;
    }

    setLastNotice(`Pagamento confirmado para o pedido ${orderId}.`);
    await fetchOrders();
  };

  const clearUnconfirmedOrders = async () => {
    if (!token || !pendingPaymentOrders.length) return;
    const confirmed = window.confirm(
      `Limpar ${pendingPaymentOrders.length} pedido(s) online nao confirmado(s)?`,
    );
    if (!confirmed) return;

    await Promise.all(
      pendingPaymentOrders.map((order) =>
        fetch("/api/admin/orders", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-token": token,
          },
          body: JSON.stringify({ orderId: order.id, orderStatus: "cancelled" }),
        }),
      ),
    );

    setLastNotice("Lista de nao confirmados limpa.");
    await fetchOrders();
  };

  const copyOrder = async (order: AdminOrder) => {
    await navigator.clipboard.writeText(buildOrderText(order));
    setLastNotice(`Pedido ${order.id} copiado.`);
  };

  const printReceipt = (order: AdminOrder) => {
    setPrintOrder(order);
    window.setTimeout(() => window.print(), 50);
  };

  const copyReport = async () => {
    const lines = [
      "Relatório Good Burger",
      `Dia: ${formatSelectedDate(selectedDate)}`,
      `Pedidos pagos/local: ${salesReport.totalOrders}`,
      `Pedidos concluidos: ${salesReport.completedOrders}`,
      `Faturamento: ${formatCurrency(salesReport.revenue)}`,
      `Entrega: ${formatCurrency(salesReport.deliveryRevenue)}`,
      `Ticket medio: ${formatCurrency(salesReport.averageTicket)}`,
      "",
      "Maior saida:",
      ...(salesReport.bestSellers.length
        ? salesReport.bestSellers.map(
            (item, index) =>
              `${index + 1}. ${item.name} - ${item.quantity} un - ${formatCurrency(
                item.revenue,
              )}`,
          )
        : ["Sem vendas ainda."]),
      "",
      "Mercadoria encalhada:",
      ...salesReport.slowMovers.map((item) => `${item.name} - ${item.quantity} un`),
    ];

    await navigator.clipboard.writeText(lines.join("\n"));
    setLastNotice("Relatorio copiado.");
  };

  return (
    <>
    <main className="min-h-screen bg-[#fff7e8] px-3 py-4 text-[#211711] sm:px-5">
      <div className="mx-auto max-w-6xl">
        <header className="mb-4 flex flex-col gap-3 rounded-md border border-[#ead8bc] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8f1f23]">
              Good Burger
            </p>
            <h1 className="text-3xl font-black tracking-tight">Pedidos</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-md border border-[#d8c2a3] bg-white px-3 py-2 text-sm font-black text-[#211711]">
              Dia
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => {
                  newestVisibleRef.current = null;
                  setSelectedDate(event.target.value);
                }}
                className="bg-transparent text-sm font-black outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                newestVisibleRef.current = null;
                setSelectedDate(getDateInputValue());
              }}
              className="rounded-md border border-[#d8c2a3] px-3 py-2 text-sm font-black"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => {
                setSoundEnabled(true);
                setLastNotice("Alerta sonoro ativo.");
              }}
              className="rounded-md border border-[#8f1f23] px-3 py-2 text-sm font-black text-[#8f1f23]"
            >
              Ativar alerta
            </button>
            <button
              type="button"
              onClick={() => void fetchOrders()}
              className="rounded-md bg-[#8f1f23] px-3 py-2 text-sm font-black text-white"
            >
              Atualizar
            </button>
          </div>
        </header>

        <section className="mb-4 rounded-md border border-[#ead8bc] bg-white p-4 shadow-sm">
          {token ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-[#211711]">Painel conectado</p>
                <p className="text-sm font-bold text-[#6c5542]">
                  Os pedidos pagos ou com pagamento no local aparecem aqui.
                </p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="rounded-md border border-[#d8c2a3] px-4 py-3 text-sm font-black"
              >
                Sair
              </button>
            </div>
          ) : (
            <form
              className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                void login();
              }}
            >
              <label className="text-sm font-bold text-[#6c5542]">
                Usuario
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  className="mt-2 w-full rounded-md border border-[#d8c2a3] px-3 py-3 text-sm outline-none focus:border-[#8f1f23]"
                />
              </label>
              <label className="text-sm font-bold text-[#6c5542]">
                Senha
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  className="mt-2 w-full rounded-md border border-[#d8c2a3] px-3 py-3 text-sm outline-none focus:border-[#8f1f23]"
                />
              </label>
              <button
                type="submit"
                className="rounded-md bg-[#211711] px-4 py-3 text-sm font-black text-white"
              >
                Entrar
              </button>
            </form>
          )}
        </section>

        <section className="mb-4 rounded-md border border-[#ead8bc] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-[#211711]">Status da loja</p>
              <div
                className={`mt-2 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-black ${
                  storeStatus.isOpen
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                <span
                  className={`h-3 w-3 rounded-full shadow-[0_0_10px_currentColor] ${
                    storeStatus.isOpen
                      ? "bg-emerald-500 text-emerald-500"
                      : "bg-red-500 text-red-500"
                  }`}
                  aria-hidden="true"
                />
                {storeStatus.isOpen ? "Loja Aberta" : "Loja fechada"}
              </div>
              <p className="mt-2 text-sm font-bold text-[#6c5542]">
                Quando fechar, o cardapio fica visivel, mas o cliente nao finaliza pedido.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void toggleStoreStatus()}
              disabled={!token || storeStatusLoading}
              className={`rounded-md px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                storeStatus.isOpen ? "bg-[#8f1f23]" : "bg-emerald-700"
              }`}
            >
              {storeStatusLoading
                ? "Alterando..."
                : storeStatus.isOpen
                  ? "Fechar loja"
                  : "Abrir loja"}
            </button>
          </div>
        </section>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-[#ead8bc] bg-white p-4">
            <span className="text-sm font-bold text-[#6c5542]">Confirmados na fila</span>
            <strong className="block text-3xl font-black">{queueOrders.length}</strong>
          </div>
          <div className="rounded-md border border-[#ead8bc] bg-white p-4">
            <span className="text-sm font-bold text-[#6c5542]">Nao confirmados</span>
            <strong className="block text-3xl font-black">{pendingOnlineOrders.length}</strong>
          </div>
          <div className="rounded-md border border-[#ead8bc] bg-white p-4">
            <span className="text-sm font-bold text-[#6c5542]">Dia do painel</span>
            <strong className="block text-xl font-black">
              {loading ? "Atualizando..." : formatSelectedDate(selectedDate)}
            </strong>
          </div>
        </div>

        {lastNotice ? (
          <p className="mb-4 rounded-md bg-[#f2c36b] px-4 py-3 text-sm font-black text-[#211711]">
            {lastNotice}
          </p>
        ) : null}

        {error ? (
          <p className="mb-4 rounded-md border border-[#8f1f23] bg-white px-4 py-3 text-sm font-bold text-[#8f1f23]">
            {error}
          </p>
        ) : null}

        <section className="mb-4 rounded-md border border-[#ead8bc] bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-black">Relatorio</h2>
              <p className="text-sm font-bold text-[#6c5542]">
                Baseado em pedidos pagos e pagamentos no local, sem cancelados.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copyReport()}
              className="rounded-md bg-[#211711] px-3 py-2 text-sm font-black text-white"
            >
              Copiar relatorio
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-md bg-[#fff7e8] p-3">
              <span className="text-sm font-bold text-[#6c5542]">Pedidos</span>
              <strong className="block text-2xl font-black">{salesReport.totalOrders}</strong>
            </div>
            <div className="rounded-md bg-[#fff7e8] p-3">
              <span className="text-sm font-bold text-[#6c5542]">Faturamento</span>
              <strong className="block text-2xl font-black">
                {formatCurrency(salesReport.revenue)}
              </strong>
            </div>
            <div className="rounded-md bg-[#fff7e8] p-3">
              <span className="text-sm font-bold text-[#6c5542]">Ticket medio</span>
              <strong className="block text-2xl font-black">
                {formatCurrency(salesReport.averageTicket)}
              </strong>
            </div>
            <div className="rounded-md bg-[#fff7e8] p-3">
              <span className="text-sm font-bold text-[#6c5542]">Entregas</span>
              <strong className="block text-2xl font-black">
                {formatCurrency(salesReport.deliveryRevenue)}
              </strong>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-black uppercase tracking-[0.12em] text-[#8f1f23]">
                Maior saida
              </h3>
              <div className="space-y-2">
                {salesReport.bestSellers.length ? (
                  salesReport.bestSellers.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-[#ead8bc] p-3 text-sm font-bold"
                    >
                      <span>{item.name}</span>
                      <span>{item.quantity} un</span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-[#d8c2a3] p-3 text-sm font-bold text-[#6c5542]">
                    Sem vendas confirmadas ainda.
                  </p>
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-black uppercase tracking-[0.12em] text-[#8f1f23]">
                Mercadoria encalhada
              </h3>
              <div className="space-y-2">
                {salesReport.slowMovers.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-[#ead8bc] p-3 text-sm font-bold"
                  >
                    <span>{item.name}</span>
                    <span>{item.quantity} un</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4">
          <h2 className="text-2xl font-black">Pedidos confirmados</h2>
          {queueOrders.map((order) => {
            const customerDigits = onlyDigits(order.customerPhone);
            const storeWhatsappUrl = `https://wa.me/${storeConfig.whatsappNumber}?text=${encodeURIComponent(
              buildOrderText(order),
            )}`;
            const customerWhatsappUrl = customerDigits
              ? `https://wa.me/55${customerDigits.replace(/^55/, "")}`
              : "";
            const confirmedWhatsappUrl = getCustomerWhatsappUrl(order, "confirmed");
            const preparingWhatsappUrl = getCustomerWhatsappUrl(order, "preparing");
            const readyWhatsappUrl = getCustomerWhatsappUrl(order, "ready");
            const outForDeliveryWhatsappUrl = getCustomerWhatsappUrl(order, "out_for_delivery");
            const deliveredWhatsappUrl = getCustomerWhatsappUrl(order, "delivered");

            return (
              <article
                key={order.id}
                className="rounded-md border border-[#ead8bc] bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 border-b border-[#ead8bc] pb-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8f1f23]">
                      {formatTime(order.createdAt)} • {order.id}
                    </p>
                    <h2 className="mt-1 text-2xl font-black">{order.customerName || "Cliente"}</h2>
                    <p className="text-sm font-bold text-[#6c5542]">
                      {order.orderType === "Entrega"
                        ? order.address || "Endereco nao informado"
                        : "Retirada no balcao"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-md bg-[#211711] px-3 py-2 text-sm font-black text-white">
                      {formatCurrency(order.total)}
                    </span>
                    <span className="rounded-md bg-[#f2c36b] px-3 py-2 text-sm font-black">
                      {paymentLabels[order.paymentStatus] ?? order.paymentStatus}
                    </span>
                    <span className="rounded-md border border-[#d8c2a3] px-3 py-2 text-sm font-black">
                      {orderLabels[order.orderStatus] ?? order.orderStatus}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 py-4 lg:grid-cols-[1fr_280px]">
                  <div className="space-y-3">
                    {order.items.map((item, index) => {
                      const extrasTotal = item.extras.reduce((sum, extra) => sum + extra.price, 0);
                      return (
                        <div key={`${order.id}-${index}`} className="rounded-md bg-[#fff7e8] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <strong>
                              {item.quantity}x {item.title}
                            </strong>
                            <span className="font-black">
                              {formatCurrency((item.unitPrice + extrasTotal) * item.quantity)}
                            </span>
                          </div>
                          {[...item.choices, ...item.extras.map((extra) => extra.name), item.note]
                            .filter(Boolean).length ? (
                            <p className="mt-2 text-sm leading-6 text-[#6c5542]">
                              {[...item.choices, ...item.extras.map((extra) => extra.name), item.note]
                                .filter(Boolean)
                                .join(" • ")}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-2 text-sm font-bold text-[#6c5542]">
                    <p>Telefone: {order.customerPhone || "nao informado"}</p>
                    <p>Pagamento: {order.paymentMethod}</p>
                    <p>Subtotal: {formatCurrency(order.subtotal || order.total - order.deliveryFee)}</p>
                    {order.deliveryFee ? (
                      <p>Taxa de entrega: {formatCurrency(order.deliveryFee)}</p>
                    ) : null}
                    {order.customer.changeFor ? <p>Troco: {order.customer.changeFor}</p> : null}
                    {order.mercadoPagoPaymentId ? (
                      <p>MP: {order.mercadoPagoPaymentId}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {confirmedWhatsappUrl ? (
                    <a
                      href={confirmedWhatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-[#8f1f23] px-3 py-2 text-sm font-black text-[#8f1f23]"
                    >
                      Avisar confirmado
                    </a>
                  ) : null}
                  {preparingWhatsappUrl ? (
                    <a
                      href={preparingWhatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => void updateStatus(order.id, "preparing")}
                      className="rounded-md bg-[#8f1f23] px-3 py-2 text-sm font-black text-white"
                    >
                      Preparando
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void updateStatus(order.id, "preparing")}
                      className="rounded-md bg-[#8f1f23] px-3 py-2 text-sm font-black text-white"
                    >
                      Preparando
                    </button>
                  )}
                  {readyWhatsappUrl ? (
                    <a
                      href={readyWhatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => void updateStatus(order.id, "ready")}
                      className="rounded-md bg-[#211711] px-3 py-2 text-sm font-black text-white"
                    >
                      Pronto
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void updateStatus(order.id, "ready")}
                      className="rounded-md bg-[#211711] px-3 py-2 text-sm font-black text-white"
                    >
                      Pronto
                    </button>
                  )}
                  {order.orderType === "Entrega" ? (
                    outForDeliveryWhatsappUrl ? (
                      <a
                        href={outForDeliveryWhatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => void updateStatus(order.id, "out_for_delivery")}
                        className="rounded-md bg-[#f2c36b] px-3 py-2 text-sm font-black text-[#211711]"
                      >
                        Saiu entrega
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void updateStatus(order.id, "out_for_delivery")}
                        className="rounded-md bg-[#f2c36b] px-3 py-2 text-sm font-black text-[#211711]"
                      >
                        Saiu entrega
                      </button>
                    )
                  ) : null}
                  {deliveredWhatsappUrl ? (
                    <a
                      href={deliveredWhatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => void updateStatus(order.id, "delivered")}
                      className="rounded-md border border-[#d8c2a3] px-3 py-2 text-sm font-black"
                    >
                      Concluir
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void updateStatus(order.id, "delivered")}
                      className="rounded-md border border-[#d8c2a3] px-3 py-2 text-sm font-black"
                    >
                      Concluir
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => printReceipt(order)}
                    className="rounded-md border border-[#211711] px-3 py-2 text-sm font-black"
                  >
                    Imprimir comanda
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyOrder(order)}
                    className="rounded-md border border-[#d8c2a3] px-3 py-2 text-sm font-black"
                  >
                    Copiar pedido
                  </button>
                  <a
                    href={storeWhatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-[#d8c2a3] px-3 py-2 text-sm font-black"
                  >
                    WhatsApp loja
                  </a>
                  {customerWhatsappUrl ? (
                    <a
                      href={customerWhatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-[#d8c2a3] px-3 py-2 text-sm font-black"
                    >
                      Chamar cliente
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}

          {!queueOrders.length ? (
            <div className="rounded-md border border-dashed border-[#d8c2a3] bg-white p-8 text-center">
              <p className="text-lg font-black">Nenhum pedido na fila agora.</p>
              <p className="mt-2 text-sm font-bold text-[#6c5542]">
                Pagamentos aprovados e pedidos com pagamento no local entram aqui.
              </p>
            </div>
          ) : null}
        </section>

        <section className="mt-4 grid gap-3 rounded-md border border-[#f2c36b] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-black">Nao confirmados</h2>
              <p className="text-sm font-bold text-[#6c5542]">
                Pedidos online ainda nao pagos ficam aqui embaixo e podem ser limpos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void clearUnconfirmedOrders()}
              disabled={!pendingPaymentOrders.length}
              className="rounded-md bg-[#211711] px-3 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Limpar nao confirmados
            </button>
          </div>

          {pendingPaymentOrders.length ? (
            pendingPaymentOrders.map((order) => {
              const customerDigits = onlyDigits(order.customerPhone);
              const customerWhatsappUrl = customerDigits
                ? `https://wa.me/55${customerDigits.replace(/^55/, "")}`
                : "";

              return (
                <article key={order.id} className="rounded-md bg-[#fff7e8] p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8f1f23]">
                        {formatTime(order.createdAt)} • {order.id}
                      </p>
                      <h3 className="mt-1 text-lg font-black">
                        {order.customerName || "Cliente"}
                      </h3>
                      <p className="text-sm font-bold text-[#6c5542]">
                        {paymentLabels[order.paymentStatus] ?? order.paymentStatus} •{" "}
                        {formatCurrency(order.total)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void updateStatus(order.id, "cancelled")}
                        className="rounded-md bg-[#8f1f23] px-3 py-2 text-sm font-black text-white"
                      >
                        Remover
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyOrder(order)}
                        className="rounded-md border border-[#d8c2a3] px-3 py-2 text-sm font-black"
                      >
                        Copiar pedido
                      </button>
                      {customerWhatsappUrl ? (
                        <a
                          href={customerWhatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-[#d8c2a3] px-3 py-2 text-sm font-black"
                        >
                          Chamar cliente
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-md border border-dashed border-[#d8c2a3] bg-[#fff7e8] p-5 text-center">
              <p className="text-sm font-black">Nenhum pedido online pendente para este dia.</p>
            </div>
          )}
        </section>
        <footer className="py-6 text-center text-sm font-black text-[#6c5542]">
          Desenvolvido por CEO Group
        </footer>
      </div>
    </main>
    <ReceiptPrintView order={printOrder} />
    </>
  );
}

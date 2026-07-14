"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  breads,
  categories,
  cheeses,
  extras,
  findProduct,
  formatCurrency,
  meats,
  products,
  type Extra,
  type Product,
} from "./menu-data";
import { storeConfig } from "./store-config";

type CartItem = {
  lineId: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  extras: Extra[];
  choices: string[];
  note: string;
};

type Customer = {
  name: string;
  phone: string;
  orderType: "Entrega" | "Retirada";
  address: string;
  payment:
    | "Cartão de crédito"
    | "Cartão de débito"
    | "PIX"
    | "Cartão no local"
    | "Dinheiro";
  changeFor: string;
};

type PixPayment = {
  orderId: string;
  paymentId: string;
  pixCode: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
  amount: number;
  paymentStatus: string;
};

type StoreStatus = {
  isOpen: boolean;
  message: string;
  updatedAt: number;
};

type CardPaymentData = {
  token?: string;
  issuer_id?: string | number;
  issuerId?: string | number;
  payment_method_id?: string;
  paymentMethodId?: string;
  installments?: string | number;
  payer?: {
    email?: string;
    identification?: {
      type?: string;
      number?: string;
    };
  };
};

type CardBrickController = {
  unmount: () => void;
};

type MercadoPagoInstance = {
  bricks: () => {
    create: (
      type: "cardPayment",
      containerId: string,
      settings: Record<string, unknown>,
    ) => Promise<CardBrickController>;
  };
};

type MercadoPagoConstructor = new (
  publicKey: string,
  options?: { locale?: string },
) => MercadoPagoInstance;

declare global {
  interface Window {
    MercadoPago?: MercadoPagoConstructor;
  }
}

const emptyCustomer: Customer = {
  name: "",
  phone: "",
  orderType: "Entrega",
  address: "",
  payment: "Cartão no local",
  changeFor: "",
};

const mercadoPagoPublicKey =
  process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY ?? "";

function isCardPayment(payment: Customer["payment"]) {
  return payment === "Cartão de crédito" || payment === "Cartão de débito";
}

function loadMercadoPagoSdk() {
  if (typeof window === "undefined") return Promise.reject(new Error("Navegador indisponivel."));
  if (window.MercadoPago) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://sdk.mercadopago.com/js/v2"]',
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("SDK indisponivel.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("SDK indisponivel."));
    document.body.appendChild(script);
  });
}

function productAllowsExtras(product: Product) {
  return !["Bebidas", "Porções", "Combos"].includes(product.category);
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("Todos");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [selectedBread, setSelectedBread] = useState(breads[0]);
  const [selectedMeat, setSelectedMeat] = useState(meats[0].id);
  const [selectedCheese, setSelectedCheese] = useState(cheeses[0]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<Customer>(emptyCustomer);
  const [checkoutStatus, setCheckoutStatus] = useState("");
  const [pixPayment, setPixPayment] = useState<PixPayment | null>(null);
  const [cardBrickStatus, setCardBrickStatus] = useState("");
  const [storeStatus, setStoreStatus] = useState<StoreStatus>({
    isOpen: true,
    message: "Loja aberta",
    updatedAt: 0,
  });
  const [storeStatusLoading, setStoreStatusLoading] = useState(true);
  const cartRef = useRef(cart);
  const customerRef = useRef(customer);
  const cardControllerRef = useRef<CardBrickController | null>(null);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    customerRef.current = customer;
  }, [customer]);

  useEffect(() => {
    let cancelled = false;

    const fetchStoreStatus = async () => {
      try {
        const response = await fetch("/api/store/status", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as Partial<StoreStatus>;
        if (cancelled) return;

        setStoreStatus({
          isOpen: payload.isOpen !== false,
          message: String(payload.message ?? (payload.isOpen === false ? "Loja fechada" : "Loja aberta")),
          updatedAt: Number(payload.updatedAt ?? 0),
        });
      } finally {
        if (!cancelled) setStoreStatusLoading(false);
      }
    };

    void fetchStoreStatus();
    const intervalId = window.setInterval(() => void fetchStoreStatus(), 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const orderId = params.get("pedido");
    if (!status || !orderId) return;

    if (status === "approved") {
      setCheckoutStatus(`Pagamento aprovado para o pedido ${orderId}. Já pode preparar com carinho.`);
      return;
    }
    if (status === "pending") {
      setCheckoutStatus(`Pagamento pendente para o pedido ${orderId}. Aguardando confirmação.`);
      return;
    }
    setCheckoutStatus(`Pagamento não concluído para o pedido ${orderId}.`);
  }, []);

  useEffect(() => {
    if (!pixPayment || pixPayment.paymentStatus === "approved") return;

    const checkPaymentStatus = async () => {
      try {
        const response = await fetch(`/api/orders/status?id=${encodeURIComponent(pixPayment.orderId)}`);
        if (!response.ok) return;
        const payload = (await response.json()) as {
          paymentStatus?: string;
          orderStatus?: string;
        };

        if (payload.paymentStatus === "approved") {
          setPixPayment((current) =>
            current ? { ...current, paymentStatus: "approved" } : current,
          );
          setCheckoutStatus(
            `PIX aprovado para o pedido ${pixPayment.orderId}. Pedido enviado para a cozinha.`,
          );
          setCart([]);
          return;
        }

        if (payload.paymentStatus && payload.paymentStatus !== pixPayment.paymentStatus) {
          setPixPayment((current) =>
            current
              ? { ...current, paymentStatus: payload.paymentStatus ?? current.paymentStatus }
              : current,
          );
        }
      } catch {
        // O webhook continua atualizando o painel mesmo se esta consulta falhar.
      }
    };

    const interval = window.setInterval(() => {
      void checkPaymentStatus();
    }, 5000);
    void checkPaymentStatus();

    return () => window.clearInterval(interval);
  }, [pixPayment]);

  const filteredProducts = useMemo(
    () =>
      activeCategory === "Todos"
        ? products
        : products.filter((product) => product.category === activeCategory),
    [activeCategory],
  );

  const cartSubtotal = useMemo(
    () =>
      cart.reduce((sum, item) => {
        const extrasTotal = item.extras.reduce((extraSum, extra) => extraSum + extra.price, 0);
        return sum + (item.price + extrasTotal) * item.quantity;
      }, 0),
    [cart],
  );

  const deliveryFee =
    cart.length && customer.orderType === "Entrega" ? storeConfig.deliveryFee : 0;
  const cartTotal = cartSubtotal + deliveryFee;
  const storeClosedMessage =
    "A loja esta fechada no momento. Volte no horario de atendimento.";

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    if (!storeStatus.isOpen) {
      cardControllerRef.current?.unmount();
      cardControllerRef.current = null;
      setCardBrickStatus("");
      return;
    }

    if (!isCardPayment(customer.payment) || !cart.length || !cartTotal) {
      cardControllerRef.current?.unmount();
      cardControllerRef.current = null;
      setCardBrickStatus("");
      return;
    }

    let cancelled = false;
    const containerId = "cardPaymentBrick_container";

    const renderCardBrick = async () => {
      try {
        if (!mercadoPagoPublicKey) {
          setCardBrickStatus("Pagamento online será ativado após a configuração das credenciais.");
          return;
        }
        setCardBrickStatus("Carregando pagamento seguro...");
        cardControllerRef.current?.unmount();
        cardControllerRef.current = null;

        await loadMercadoPagoSdk();
        if (cancelled || !window.MercadoPago) return;

        const mercadoPago = new window.MercadoPago(mercadoPagoPublicKey, {
          locale: "pt-BR",
        });
        const bricksBuilder = mercadoPago.bricks();

        const excluded =
          customer.payment === "Cartão de crédito"
            ? ["debit_card", "prepaid_card"]
            : ["credit_card", "prepaid_card"];

        const controller = await bricksBuilder.create("cardPayment", containerId, {
          initialization: {
            amount: Number(cartTotal.toFixed(2)),
          },
          customization: {
            paymentMethods: {
              types: {
                excluded,
              },
            },
          },
          callbacks: {
            onReady: () => {
              setCardBrickStatus("Preencha os dados do cartao para pagar com segurança.");
            },
            onSubmit: (paymentData: CardPaymentData) =>
              new Promise<void>(async (resolve, reject) => {
                const currentCart = cartRef.current;
                const currentCustomer = customerRef.current;
                const missingMessage =
                  !storeStatus.isOpen
                    ? storeClosedMessage
                    : !currentCart.length
                    ? "Escolha pelo menos um item."
                    : !currentCustomer.name.trim()
                      ? "Informe seu nome."
                      : !currentCustomer.phone.trim()
                        ? "Informe seu WhatsApp."
                        : currentCustomer.orderType === "Entrega" &&
                            !currentCustomer.address.trim()
                          ? "Informe o endereço de entrega."
                          : "";

                if (missingMessage) {
                  setCheckoutStatus(missingMessage);
                  reject(new Error(missingMessage));
                  return;
                }

                try {
                  setCardBrickStatus("Processando cartao...");
                  const response = await fetch("/api/orders/card", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      cart: currentCart,
                      customer: currentCustomer,
                      paymentData,
                    }),
                  });
                  const payload = (await response.json()) as {
                    orderId?: string;
                    paymentStatus?: string;
                    statusDetail?: string;
                    error?: string;
                  };

                  if (!response.ok || !payload.orderId) {
                    throw new Error(payload.error ?? "Nao foi possivel processar o cartao.");
                  }

                  if (payload.paymentStatus === "approved") {
                    setCheckoutStatus(
                      `Pagamento aprovado para o pedido ${payload.orderId}. Pedido enviado para a cozinha.`,
                    );
                    setCardBrickStatus("Pagamento aprovado.");
                    setCart([]);
                    resolve();
                    return;
                  }

                  if (
                    payload.paymentStatus === "pending" ||
                    payload.paymentStatus === "in_process" ||
                    payload.paymentStatus === "in_mediation"
                  ) {
                    setCheckoutStatus(
                      `Pedido ${payload.orderId} aguardando confirmação do cartão.`,
                    );
                    setCardBrickStatus("Pagamento em análise.");
                    resolve();
                    return;
                  }

                  throw new Error(
                    payload.statusDetail
                      ? `Pagamento não aprovado: ${payload.statusDetail}.`
                      : "Pagamento nao aprovado.",
                  );
                } catch (error) {
                  const message =
                    error instanceof Error ? error.message : "Erro ao processar cartao.";
                  setCheckoutStatus(message);
                  setCardBrickStatus("Revise os dados do cartao e tente novamente.");
                  reject(error);
                }
              }),
            onError: () => {
              setCardBrickStatus("Nao foi possivel carregar o formulario do cartao.");
            },
          },
        });

        if (cancelled) {
          controller.unmount();
          return;
        }
        cardControllerRef.current = controller;
      } catch {
        if (!cancelled) {
          setCardBrickStatus("Nao foi possivel carregar o pagamento por cartao.");
        }
      }
    };

    void renderCardBrick();

    return () => {
      cancelled = true;
      cardControllerRef.current?.unmount();
      cardControllerRef.current = null;
    };
  }, [cart.length, cartTotal, customer.payment, storeStatus.isOpen, storeClosedMessage]);

  const openProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedExtras([]);
    setSelectedBread(breads[0]);
    setSelectedMeat(meats[0].id);
    setSelectedCheese(cheeses[0]);
    setQuantity(1);
    setNote("");
  };

  const toggleExtra = (id: string) => {
    setSelectedExtras((current) =>
      current.includes(id) ? current.filter((extraId) => extraId !== id) : [...current, id],
    );
  };

  const getCurrentProductPrice = () => {
    if (!selectedProduct) return 0;
    if (!selectedProduct.custom) return selectedProduct.price;
    return meats.find((meat) => meat.id === selectedMeat)?.price ?? meats[0].price;
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    setPixPayment(null);

    const chosenExtras = productAllowsExtras(selectedProduct)
      ? extras.filter((extra) => selectedExtras.includes(extra.id))
      : [];
    const selectedMeatLabel =
      meats.find((meat) => meat.id === selectedMeat)?.name ?? meats[0].name;
    const choices = selectedProduct.custom
      ? [selectedBread, selectedMeatLabel, selectedCheese, "Molho da casa"]
      : [];

    setCart((current) => [
      ...current,
      {
        lineId: `${selectedProduct.id}-${Date.now()}`,
        productId: selectedProduct.id,
        name: selectedProduct.name,
        price: getCurrentProductPrice(),
        quantity,
        extras: chosenExtras,
        choices,
        note,
      },
    ]);

    setSelectedProduct(null);
  };

  const updateCartQuantity = (lineId: string, nextQuantity: number) => {
    setPixPayment(null);
    if (nextQuantity <= 0) {
      setCart((current) => current.filter((item) => item.lineId !== lineId));
      return;
    }

    setCart((current) =>
      current.map((item) =>
        item.lineId === lineId ? { ...item, quantity: nextQuantity } : item,
      ),
    );
  };

  const buildOrderMessage = (paymentLabel: string = customer.payment, orderId?: string) => {
    const lines = cart.map((item, index) => {
      const extrasText = item.extras.length
        ? `\n   Adicionais: ${item.extras
            .map((extra) => `${extra.name} (${formatCurrency(extra.price)})`)
            .join(", ")}`
        : "";
      const choicesText = item.choices.length ? `\n   Escolhas: ${item.choices.join(", ")}` : "";
      const noteText = item.note ? `\n   Obs: ${item.note}` : "";
      const extrasTotal = item.extras.reduce((sum, extra) => sum + extra.price, 0);
      return `${index + 1}. ${item.quantity}x ${item.name} - ${formatCurrency(
        (item.price + extrasTotal) * item.quantity,
      )}${choicesText}${extrasText}${noteText}`;
    });

    const deliveryText =
      customer.orderType === "Entrega"
        ? `Entrega: ${customer.address || "endereço não informado"}`
        : "Retirada no balcão";
    const changeText =
      customer.payment === "Dinheiro" && customer.changeFor
        ? `\nTroco para: ${customer.changeFor}`
        : "";

    return [
      "Olá, quero fazer um pedido na Good Burger:",
      orderId ? `Pedido: ${orderId}` : "",
      "",
      ...lines,
      "",
      `Subtotal: ${formatCurrency(cartSubtotal)}`,
      deliveryFee ? `Taxa de entrega: ${formatCurrency(deliveryFee)}` : "",
      `Total: ${formatCurrency(cartTotal)}`,
      `Cliente: ${customer.name || "não informado"}`,
      `Telefone: ${customer.phone || "não informado"}`,
      deliveryText,
      `Pagamento: ${paymentLabel}${changeText}`,
    ]
      .filter((line) => line !== "")
      .join("\n");
  };

  const sendWhatsApp = (paymentLabel: string = customer.payment, orderId?: string) => {
    if (!cart.length || !storeConfig.whatsappNumber) return;
    const encodedMessage = encodeURIComponent(buildOrderMessage(paymentLabel, orderId));
    window.open(
      `https://wa.me/${storeConfig.whatsappNumber}?text=${encodedMessage}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const validateCustomer = () => {
    if (!cart.length) return "Escolha pelo menos um item.";
    if (!customer.name.trim()) return "Informe seu nome.";
    if (!customer.phone.trim()) return "Informe seu WhatsApp.";
    if (customer.orderType === "Entrega" && !customer.address.trim()) {
      return "Informe o endereço de entrega.";
    }
    return "";
  };

  const checkoutPix = async () => {
    if (!cart.length) return;
    if (!storeStatus.isOpen) {
      setCheckoutStatus(storeClosedMessage);
      return;
    }

    const validationMessage = validateCustomer();
    if (validationMessage) {
      setCheckoutStatus(validationMessage);
      return;
    }

    setCheckoutStatus("Gerando PIX seguro...");
    setPixPayment(null);

    try {
      const response = await fetch("/api/orders/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart, customer }),
      });
      const payload = (await response.json()) as PixPayment & { error?: string };

      if (!response.ok || !payload.orderId || !payload.pixCode) {
        throw new Error(payload.error ?? "Nao foi possivel gerar o PIX.");
      }

      setPixPayment(payload);
      setCheckoutStatus(
        `PIX gerado para o pedido ${payload.orderId}. Assim que pagar, o painel aprova automaticamente.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao gerar PIX.";
      setCheckoutStatus(message);
    }
  };

  const copyPixCode = async () => {
    if (!pixPayment) return;
    await navigator.clipboard.writeText(pixPayment.pixCode);
    setCheckoutStatus("PIX copia e cola copiado.");
  };

  const checkoutLocalPayment = async () => {
    if (!cart.length) return;
    if (!storeStatus.isOpen) {
      setCheckoutStatus(storeClosedMessage);
      return;
    }

    const validationMessage = validateCustomer();
    if (validationMessage) {
      setCheckoutStatus(validationMessage);
      return;
    }

    setCheckoutStatus("Registrando pedido...");
    try {
      const response = await fetch("/api/orders/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart, customer }),
      });
      const payload = (await response.json()) as {
        orderId?: string;
        error?: string;
      };

      if (!response.ok || !payload.orderId) {
        throw new Error(payload.error ?? "Não foi possível registrar o pedido.");
      }

      setCheckoutStatus(`Pedido ${payload.orderId} registrado. Enviando para o WhatsApp...`);
      sendWhatsApp(`${customer.payment} - pagamento no local`, payload.orderId);
      setCart([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao registrar pedido.";
      setCheckoutStatus(message);
    }
  };

  const checkout = () => {
    if (!storeStatus.isOpen) {
      setCheckoutStatus(storeClosedMessage);
      return;
    }

    if (isCardPayment(customer.payment)) {
      setCheckoutStatus("Preencha os dados do cartao no formulario seguro.");
      return;
    }
    if (customer.payment === "PIX") {
      void checkoutPix();
      return;
    }
    void checkoutLocalPayment();
  };

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#fff0b8] pb-24 text-[#211711] lg:pb-0">
      <header className="sticky top-0 z-30 border-b border-[#e5c96f] bg-[#fff0b8]/94 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
          <a href="#" className="flex min-w-0 items-center gap-2 sm:gap-3">
            <img
              src="/assets/goodburger/logo.jpg"
              alt="Good Burger"
              className="h-10 w-10 rounded-full object-cover sm:h-14 sm:w-14"
            />
            <div className="min-w-0">
              <p className="hidden text-[10px] font-black uppercase tracking-[0.14em] text-[#8f1f23] min-[380px]:block sm:text-[11px] sm:tracking-[0.2em]">
                Fast food
              </p>
              <h1 className="max-w-[190px] text-sm font-black leading-tight tracking-tight sm:max-w-none sm:text-xl">
                GOOD BURGER - A Casa do Hambúrguer!
              </h1>
            </div>
          </a>
          <a
            href="#pedido"
            className="shrink-0 rounded-md bg-[#8f1f23] px-3 py-2 text-xs font-black text-white sm:px-4 sm:py-3 sm:text-sm"
          >
            Pedido {cartCount ? `(${cartCount})` : ""}
          </a>
        </div>
        <div className="mx-auto flex max-w-6xl px-3 pb-2 sm:px-4">
          <div
            className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-black sm:text-sm ${
              storeStatus.isOpen
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <span
              className={`h-3 w-3 rounded-full shadow-[0_0_10px_currentColor] ${
                storeStatus.isOpen ? "bg-emerald-500 text-emerald-500" : "bg-red-500 text-red-500"
              }`}
              aria-hidden="true"
            />
            {storeStatusLoading
              ? "Verificando loja"
              : storeStatus.isOpen
                ? "Loja Aberta"
                : "Loja fechada"}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-2 px-3 py-3 sm:px-4 sm:py-5 md:grid-cols-[0.9fr_1.1fr] md:items-center">
        <div>
          <img
            src="/assets/goodburger/logo.jpg"
            alt="Good Burger"
            className="mx-auto block w-full max-w-[145px] rounded-full object-contain min-[380px]:max-w-[165px] sm:max-w-[260px] md:max-w-sm"
          />
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-sm font-black uppercase tracking-[0.18em] text-[#8f1f23]">Good Burger Fast Food</p>
          <p className="max-w-xl text-lg font-black leading-7 text-[#4f3a2c] sm:text-2xl sm:leading-9">
            Hambúrguer de verdade, combos caprichados e a melhor maionese da cidade.
          </p>
          <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-[#6c5542]">
            {storeConfig.address}<br />{storeConfig.openingHours}
          </p>
          <div className="hidden">
            <div
              className={`rounded-md border p-3 sm:p-4 ${
                storeStatus.isOpen
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <strong
                className={`flex items-center gap-2 ${
                  storeStatus.isOpen ? "text-emerald-800" : "text-red-800"
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
              </strong>
              <span
                className={`text-sm ${storeStatus.isOpen ? "text-emerald-700" : "text-red-700"}`}
              >
                {storeStatus.isOpen ? "Aceitando pedidos agora." : "Pedidos pausados no momento."}
              </span>
            </div>
            <div className="rounded-md border border-[#ead8bc] bg-white p-3 sm:p-4">
              <strong className="block text-[#8f1f23]">Delivery</strong>
              <span className="text-sm text-[#6c5542]">Ficante no início, rapidez no fim.</span>
            </div>
            <div className="rounded-md border border-[#ead8bc] bg-white p-3 sm:p-4">
              <strong className="block text-[#8f1f23]">Brioche</strong>
              <span className="text-sm text-[#6c5542]">Fofinho igual abraço de ficante.</span>
            </div>
            <div className="rounded-md border border-[#ead8bc] bg-white p-3 sm:p-4">
              <strong className="block text-[#8f1f23]">Pagamento</strong>
              <span className="text-sm text-[#6c5542]">Online aprovado ou no local.</span>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-5 px-3 pb-12 sm:px-4 lg:grid-cols-[minmax(0,1fr)_390px] lg:gap-8">
        <section className="min-w-0">
          <div className="mb-4 flex max-w-full gap-2 overflow-x-auto pb-1 sm:mb-6">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`shrink-0 whitespace-nowrap rounded-md border px-3 py-2 text-xs font-black sm:px-4 sm:text-sm ${
                  activeCategory === category
                    ? "border-[#8f1f23] bg-[#8f1f23] text-white"
                    : "border-[#ead8bc] bg-white text-[#4b3628]"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="grid gap-5">
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className="grid grid-cols-[92px_minmax(0,1fr)] overflow-hidden rounded-md border border-[#ead8bc] bg-white shadow-sm min-[380px]:grid-cols-[112px_minmax(0,1fr)] sm:grid-cols-[180px_minmax(0,1fr)] md:grid-cols-[220px_minmax(0,1fr)]"
              >
                <button
                  type="button"
                  onClick={() => openProduct(product)}
                  className="min-h-full bg-[#f7ead5]"
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    className={`aspect-square h-full w-full ${
                      product.category === "Bebidas" ? "object-contain p-4" : "object-cover"
                    }`}
                  />
                </button>
                <div className="min-w-0 flex flex-col gap-2 p-3 sm:gap-4 sm:p-4">
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className="text-balance-mobile text-lg font-black tracking-tight text-[#211711] sm:text-2xl">
                          {product.name}
                        </h3>
                        {product.popular ? (
                          <span className="hidden rounded bg-[#f2c36b] px-2 py-1 text-xs font-black uppercase text-[#211711] sm:inline-block">
                            Oferta
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs font-black text-[#8f1f23] sm:text-base">{product.subtitle}</p>
                    </div>
                    <div className="flex flex-col items-end">
                      {product.originalPrice ? (
                        <span className="text-xs font-bold text-[#8a7465] line-through">
                          {formatCurrency(product.originalPrice)}
                        </span>
                      ) : null}
                      <strong className="w-fit rounded-md bg-[#211711] px-2 py-1 text-sm text-white sm:px-3 sm:py-2 sm:text-lg">
                        {formatCurrency(product.price)}
                      </strong>
                    </div>
                  </div>
                  <p className="text-xs leading-5 text-[#6c5542] sm:text-sm sm:leading-6">{product.description}</p>
                  <div className="hidden flex-wrap gap-2 sm:flex">
                    {product.ingredients.map((ingredient) => (
                      <span
                        key={ingredient}
                        className="rounded-md bg-[#fff7e8] px-2 py-1 text-xs font-bold text-[#6b4a35]"
                      >
                        {ingredient}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => openProduct(product)}
                    className="mt-auto rounded-md bg-[#8f1f23] px-3 py-2 text-xs font-black text-white sm:px-4 sm:py-3 sm:text-sm"
                  >
                    Colocar no pedido
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside id="pedido" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-md border border-[#ead8bc] bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black sm:text-2xl">Seu pedido</h2>
              <span className="shrink-0 rounded-md bg-[#f2c36b] px-3 py-1 text-sm font-black">
                {formatCurrency(cartTotal)}
              </span>
            </div>

            {cart.length ? (
              <div className="space-y-3">
                {cart.map((item) => {
                  const extrasTotal = item.extras.reduce((sum, extra) => sum + extra.price, 0);
                  return (
                    <div key={item.lineId} className="rounded-md bg-[#fff7e8] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-balance-mobile font-black">{item.name}</p>
                          <p className="text-sm text-[#6c5542]">
                            {formatCurrency((item.price + extrasTotal) * item.quantity)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.lineId, item.quantity - 1)}
                            className="h-8 w-8 rounded-md border border-[#d8c2a3] font-black"
                            aria-label={`Remover uma unidade de ${item.name}`}
                          >
                            -
                          </button>
                          <span className="w-6 text-center font-black">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.lineId, item.quantity + 1)}
                            className="h-8 w-8 rounded-md border border-[#d8c2a3] font-black"
                            aria-label={`Adicionar uma unidade de ${item.name}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      {item.choices.length || item.extras.length || item.note ? (
                        <p className="text-balance-mobile mt-2 text-xs leading-5 text-[#7d6048]">
                          {[...item.choices, ...item.extras.map((extra) => extra.name), item.note]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-[#d8c2a3] p-4 text-sm leading-6 text-[#6c5542]">
                Seu pedido está vazio. Adicione um item do cardápio.
              </p>
            )}

            {cart.length ? (
              <div className="mt-4 space-y-2 rounded-md border border-[#ead8bc] bg-[#fff7e8] p-3 text-sm font-bold text-[#6c5542]">
                <div className="flex items-center justify-between gap-3">
                  <span>Subtotal</span>
                  <span>{formatCurrency(cartSubtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Taxa de entrega</span>
                  <span>{deliveryFee ? formatCurrency(deliveryFee) : "R$ 0,00"}</span>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-[#ead8bc] pt-2 text-[#211711]">
                  <span>Total</span>
                  <span>{formatCurrency(cartTotal)}</span>
                </div>
              </div>
            ) : null}

            <div className="mt-5 space-y-3">
              <input
                value={customer.name}
                onChange={(event) => {
                  setPixPayment(null);
                  setCustomer((current) => ({ ...current, name: event.target.value }));
                }}
                placeholder="Seu nome"
                className="w-full rounded-md border border-[#d8c2a3] bg-white px-3 py-3 text-sm outline-none focus:border-[#8f1f23]"
              />
              <input
                value={customer.phone}
                onChange={(event) => {
                  setPixPayment(null);
                  setCustomer((current) => ({ ...current, phone: event.target.value }));
                }}
                placeholder="Seu WhatsApp"
                className="w-full rounded-md border border-[#d8c2a3] bg-white px-3 py-3 text-sm outline-none focus:border-[#8f1f23]"
              />
              <div className="grid grid-cols-2 gap-2">
                {(["Entrega", "Retirada"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setCheckoutStatus("");
                      setPixPayment(null);
                      setCustomer((current) => ({ ...current, orderType: type }));
                    }}
                    className={`rounded-md border px-3 py-3 text-sm font-black ${
                      customer.orderType === type
                        ? "border-[#8f1f23] bg-[#8f1f23] text-white"
                        : "border-[#d8c2a3] bg-white"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              {customer.orderType === "Entrega" ? (
                <textarea
                  value={customer.address}
                  onChange={(event) => {
                    setPixPayment(null);
                    setCustomer((current) => ({ ...current, address: event.target.value }));
                  }}
                  placeholder="Endereço de entrega"
                  rows={3}
                  className="w-full resize-none rounded-md border border-[#d8c2a3] bg-white px-3 py-3 text-sm outline-none focus:border-[#8f1f23]"
                />
              ) : null}
              <select
                value={customer.payment}
                onChange={(event) => {
                  setCheckoutStatus("");
                  setPixPayment(null);
                  setCustomer((current) => ({
                    ...current,
                    payment: event.target.value as Customer["payment"],
                  }));
                }}
                className="w-full rounded-md border border-[#d8c2a3] bg-white px-3 py-3 text-sm outline-none focus:border-[#8f1f23]"
              >
                <option>Cartão de crédito</option>
                <option>Cartão de débito</option>
                <option>PIX</option>
                <option>Cartão no local</option>
                <option>Dinheiro</option>
              </select>
              {customer.payment === "PIX" ? (
                <div className="rounded-md border border-[#f2c36b] bg-[#fff7e8] p-3">
                  {pixPayment ? (
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-black text-[#211711]">
                          PIX do pedido {pixPayment.orderId}
                        </p>
                        <p className="text-sm font-bold text-[#6c5542]">
                          Valor: {formatCurrency(pixPayment.amount)}
                        </p>
                      </div>
                      {pixPayment.qrCodeBase64 ? (
                        <img
                          src={`data:image/png;base64,${pixPayment.qrCodeBase64}`}
                          alt="QR Code PIX"
                          className="mx-auto h-48 w-48 rounded-md border border-[#d8c2a3] bg-white p-2"
                        />
                      ) : null}
                      <textarea
                        value={pixPayment.pixCode}
                        readOnly
                        rows={4}
                        className="w-full resize-none rounded-md border border-[#d8c2a3] bg-white px-3 py-3 text-xs font-bold leading-5 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void copyPixCode()}
                        className="w-full rounded-md bg-[#211711] px-3 py-3 text-sm font-black text-white"
                      >
                        Copiar PIX
                      </button>
                      <p className="text-xs font-bold leading-5 text-[#8f1f23]">
                        Status:{" "}
                        {pixPayment.paymentStatus === "approved"
                          ? "pago e enviado para a cozinha"
                          : "aguardando pagamento automatico"}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs font-bold leading-5 text-[#6c5542]">
                      Ao finalizar, o PIX aparece aqui na tela com QR Code e copia-e-cola.
                      Assim que o pagamento for aprovado, o pedido entra automaticamente
                      no painel.
                    </p>
                  )}
                </div>
              ) : null}
              {isCardPayment(customer.payment) ? (
                <div className="rounded-md border border-[#ead8bc] bg-[#fff7e8] p-3">
                  <div className="mb-3">
                    <p className="text-sm font-black text-[#211711]">
                      Pagamento seguro com cartão
                    </p>
                    <p className="text-xs font-bold leading-5 text-[#6c5542]">
                      O cartão é processado pelo Mercado Pago aqui na loja, sem login. A loja
                      não salva os dados do cartão.
                    </p>
                  </div>
                  {storeStatus.isOpen && cart.length ? (
                    <div id="cardPaymentBrick_container" className="min-h-[360px]" />
                  ) : !storeStatus.isOpen ? (
                    <p className="text-xs font-bold leading-5 text-[#8f1f23]">
                      A loja esta fechada. O pagamento fica bloqueado ate a loja abrir.
                    </p>
                  ) : (
                    <p className="text-xs font-bold leading-5 text-[#6c5542]">
                      Adicione itens ao pedido para carregar o pagamento por cartão.
                    </p>
                  )}
                  {cardBrickStatus ? (
                    <p className="mt-2 text-xs font-bold leading-5 text-[#8f1f23]">
                      {cardBrickStatus}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {customer.payment === "Dinheiro" ? (
                <input
                  value={customer.changeFor}
                  onChange={(event) =>
                    setCustomer((current) => ({ ...current, changeFor: event.target.value }))
                  }
                  placeholder="Troco para quanto?"
                  className="w-full rounded-md border border-[#d8c2a3] bg-white px-3 py-3 text-sm outline-none focus:border-[#8f1f23]"
                />
              ) : null}
              {!isCardPayment(customer.payment) ? (
                <button
                  type="button"
                  onClick={checkout}
                  disabled={!cart.length || !storeStatus.isOpen}
                  className="w-full rounded-md bg-[#8f1f23] px-4 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {storeStatus.isOpen ? "Finalizar pedido" : "Loja fechada"}
                </button>
              ) : null}
              {checkoutStatus ? (
                <p className="text-xs font-semibold leading-5 text-[#8f1f23]">
                  {checkoutStatus}
                </p>
              ) : null}
            </div>
          </div>
        </aside>
      </div>

      <footer className="border-t border-[#ead8bc] bg-white px-4 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-sm font-bold text-[#6c5542]">
          <span>Good Burger</span>
          <span>Desenvolvido por CEO Group</span>
        </div>
      </footer>

      {cartCount ? (
        <a
          href="#pedido"
          className="fixed bottom-3 left-3 right-3 z-30 flex items-center justify-between rounded-md bg-[#8f1f23] px-4 py-3 text-sm font-black text-white shadow-lg lg:hidden"
        >
          <span>Ver pedido ({cartCount})</span>
          <span>{formatCurrency(cartTotal)}</span>
        </a>
      ) : null}

      {selectedProduct ? (
        <div className="fixed inset-0 z-40 flex items-end overflow-x-hidden bg-black/45 p-2 sm:items-center sm:justify-center sm:p-3">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-md bg-white shadow-xl">
            <img
              src={selectedProduct.image}
              alt={selectedProduct.name}
              className={`aspect-[16/9] w-full bg-[#f7ead5] ${
                selectedProduct.category === "Bebidas" ? "object-contain p-5" : "object-cover"
              }`}
            />
            <div className="min-w-0 space-y-4 p-3 sm:space-y-5 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-balance-mobile text-xl font-black sm:text-2xl">
                    {selectedProduct.name}
                  </h2>
                  <p className="mt-1 text-sm font-black text-[#8f1f23] sm:text-base">
                    {selectedProduct.subtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="h-10 w-10 rounded-md border border-[#d8c2a3] text-xl font-black"
                  aria-label="Fechar"
                >
                  x
                </button>
              </div>

              {selectedProduct.custom ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-black uppercase tracking-[0.12em] text-[#8f1f23]">
                      Pão
                    </legend>
                    {breads.map((bread) => (
                      <label
                        key={bread}
                        className="flex min-w-0 items-center gap-3 rounded-md border border-[#d8c2a3] p-3 text-sm"
                      >
                        <input
                          type="radio"
                          name="bread"
                          checked={selectedBread === bread}
                          onChange={() => setSelectedBread(bread)}
                        />
                        <span className="text-balance-mobile min-w-0">{bread}</span>
                      </label>
                    ))}
                  </fieldset>
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-black uppercase tracking-[0.12em] text-[#8f1f23]">
                      Carne
                    </legend>
                    {meats.map((meat) => (
                      <label
                        key={meat.id}
                        className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-[#d8c2a3] p-3 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <input
                            type="radio"
                            name="meat"
                            checked={selectedMeat === meat.id}
                            onChange={() => setSelectedMeat(meat.id)}
                          />
                          <span className="text-balance-mobile min-w-0">{meat.name}</span>
                        </span>
                        <strong className="shrink-0">{formatCurrency(meat.price)}</strong>
                      </label>
                    ))}
                  </fieldset>
                  <fieldset className="space-y-2 sm:col-span-2">
                    <legend className="text-sm font-black uppercase tracking-[0.12em] text-[#8f1f23]">
                      Queijo
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {cheeses.map((cheese) => (
                        <label
                          key={cheese}
                          className="flex min-w-0 items-center gap-3 rounded-md border border-[#d8c2a3] p-3 text-sm"
                        >
                          <input
                            type="radio"
                            name="cheese"
                            checked={selectedCheese === cheese}
                            onChange={() => setSelectedCheese(cheese)}
                          />
                          <span className="text-balance-mobile min-w-0">{cheese}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              ) : null}

              {productAllowsExtras(selectedProduct) ? (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-black uppercase tracking-[0.12em] text-[#8f1f23]">
                    Adicione felicidade
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {extras.map((extra) => (
                      <label
                        key={extra.id}
                        className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-[#d8c2a3] p-3 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedExtras.includes(extra.id)}
                            onChange={() => toggleExtra(extra.id)}
                          />
                          <span className="text-balance-mobile min-w-0">{extra.name}</span>
                        </span>
                        <strong className="shrink-0">{formatCurrency(extra.price)}</strong>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Observação do item"
                rows={3}
                className="w-full resize-none rounded-md border border-[#d8c2a3] bg-white px-3 py-3 text-sm outline-none focus:border-[#8f1f23]"
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex items-center justify-center gap-2 sm:justify-start">
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    className="h-11 w-11 rounded-md border border-[#d8c2a3] text-xl font-black"
                    aria-label="Diminuir quantidade"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-lg font-black">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => current + 1)}
                    className="h-11 w-11 rounded-md border border-[#d8c2a3] text-xl font-black"
                    aria-label="Aumentar quantidade"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={addToCart}
                  className="w-full rounded-md bg-[#8f1f23] px-4 py-4 text-sm font-black text-white sm:flex-1"
                >
                  Adicionar{" "}
                  {formatCurrency(
                    (getCurrentProductPrice() +
                      (productAllowsExtras(selectedProduct)
                        ? extras
                            .filter((extra) => selectedExtras.includes(extra.id))
                            .reduce((sum, extra) => sum + extra.price, 0)
                        : 0)) *
                      quantity,
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

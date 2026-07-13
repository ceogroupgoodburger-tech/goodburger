import {
  getAccessToken,
  getSiteOrigin,
  normalizeOrder,
  savePendingOrder,
  type IncomingCustomer,
} from "../../order-utils";

type CheckoutBody = {
  cart?: unknown;
  customer?: IncomingCustomer;
};

const onlinePaymentMethods = new Set(["Cartão de crédito", "Cartão de débito"]);

function getPaymentMethods(payment?: string) {
  const offlinePaymentTypes = ["ticket", "atm", "bank_transfer"];

  if (payment === "Cartão de débito") {
    return {
      installments: 1,
      excluded_payment_types: [
        { id: "credit_card" },
        ...offlinePaymentTypes.map((id) => ({ id })),
      ],
    };
  }

  return {
    installments: 12,
    excluded_payment_types: [
      { id: "debit_card" },
      ...offlinePaymentTypes.map((id) => ({ id })),
    ],
  };
}

export async function POST(request: Request) {
  try {
    const accessToken = getAccessToken();
    if (!accessToken) {
      return Response.json(
        {
          error:
            "Mercado Pago ainda não está configurado. Defina MERCADO_PAGO_ACCESS_TOKEN no ambiente de produção.",
        },
        { status: 503 },
      );
    }

    const body = (await request.json()) as CheckoutBody;
    if (!onlinePaymentMethods.has(body.customer?.payment ?? "")) {
      return Response.json(
        { error: "Escolha cartao de credito ou debito para pagar online." },
        { status: 400 },
      );
    }

    const order = normalizeOrder(
      Array.isArray(body.cart) ? body.cart : [],
      body.customer ?? {},
    );
    const saved = await savePendingOrder(order);

    const origin = getSiteOrigin(request);
    const preference = {
      external_reference: order.orderId,
      notification_url: `${origin}/api/mercado-pago/webhook`,
      back_urls: {
        success: `${origin}/?pedido=${order.orderId}&status=approved`,
        pending: `${origin}/?pedido=${order.orderId}&status=pending`,
        failure: `${origin}/?pedido=${order.orderId}&status=failure`,
      },
      auto_return: "approved",
      payer: {
        name: order.customer.name ?? "",
        phone: {
          number: order.customer.phone ?? "",
        },
      },
      shipments: {
        receiver_address: {
          street_name:
            order.customer.orderType === "Entrega" ? order.customer.address ?? "" : "",
        },
      },
      payment_methods: getPaymentMethods(order.customer.payment),
      items: [
        ...order.items.map((item) => {
          const extrasTotal = item.extras.reduce((sum, extra) => sum + extra.price, 0);
          return {
            id: item.productId,
            title: item.title,
            quantity: item.quantity,
            unit_price: Number((item.unitPrice + extrasTotal).toFixed(2)),
            currency_id: "BRL",
          };
        }),
        ...(order.deliveryFee
          ? [
              {
                id: "taxa-entrega",
                title: "Taxa de entrega",
                quantity: 1,
                unit_price: Number(order.deliveryFee.toFixed(2)),
                currency_id: "BRL",
              },
            ]
          : []),
      ],
    };

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
    });

    const payload = (await response.json()) as {
      init_point?: string;
      sandbox_init_point?: string;
      message?: string;
      error?: string;
    };

    if (!response.ok || !payload.init_point) {
      return Response.json(
        {
          error:
            payload.message ??
            payload.error ??
            "Mercado Pago recusou a criação da preferência.",
        },
        { status: 502 },
      );
    }

    return Response.json({
      orderId: order.orderId,
      initPoint: payload.init_point,
      sandboxInitPoint: payload.sandbox_init_point,
      stored: saved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return Response.json({ error: message }, { status: 400 });
  }
}

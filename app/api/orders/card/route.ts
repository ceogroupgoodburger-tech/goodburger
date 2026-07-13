import {
  getAccessToken,
  getSiteOrigin,
  isStoreOpen,
  normalizeOrder,
  savePendingOrder,
  updateOrderPayment,
  type IncomingCustomer,
} from "../../order-utils";

type CardOrderBody = {
  cart?: unknown;
  customer?: IncomingCustomer;
  paymentData?: {
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
};

type MercadoPagoCardPayment = {
  id?: string | number;
  status?: string;
  status_detail?: string;
  message?: string;
  error?: string;
};

function isCardPayment(payment?: string) {
  return payment === "Cartão de crédito" || payment === "Cartão de débito";
}

function getPayerEmail(paymentData: CardOrderBody["paymentData"], orderId: string) {
  const email = String(paymentData?.payer?.email ?? "").trim();
  return email || `pedido-${orderId.toLowerCase()}@goodburger.local`;
}

export async function POST(request: Request) {
  try {
    const accessToken = getAccessToken();
    if (!accessToken) {
      return Response.json(
        { error: "Mercado Pago ainda nao esta configurado." },
        { status: 503 },
      );
    }

    const body = (await request.json()) as CardOrderBody;
    if (!isCardPayment(body.customer?.payment)) {
      return Response.json(
        { error: "Forma de pagamento invalida para cartao." },
        { status: 400 },
      );
    }

    if (!(await isStoreOpen())) {
      return Response.json(
        { error: "A loja esta fechada no momento. Tente novamente no horario de atendimento." },
        { status: 403 },
      );
    }

    const paymentData = body.paymentData ?? {};
    const token = paymentData.token;
    const paymentMethodId = paymentData.payment_method_id ?? paymentData.paymentMethodId;
    if (!token || !paymentMethodId) {
      return Response.json(
        { error: "Dados do cartao incompletos." },
        { status: 400 },
      );
    }

    const order = normalizeOrder(
      Array.isArray(body.cart) ? body.cart : [],
      body.customer ?? {},
    );

    const saved = await savePendingOrder(order);
    if (!saved) {
      return Response.json({ error: "Banco de pedidos indisponivel." }, { status: 503 });
    }

    const origin = getSiteOrigin(request);
    const installments =
      body.customer?.payment === "Cartão de débito"
        ? 1
        : Math.max(1, Number(paymentData.installments ?? 1));

    const paymentResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": order.orderId,
      },
      body: JSON.stringify({
        transaction_amount: Number(order.total.toFixed(2)),
        token,
        description: `Pedido ${order.orderId} - Good Burger`,
        installments,
        payment_method_id: paymentMethodId,
        issuer_id: paymentData.issuer_id ?? paymentData.issuerId,
        external_reference: order.orderId,
        notification_url: `${origin}/api/mercado-pago/webhook`,
        payer: {
          email: getPayerEmail(paymentData, order.orderId),
          identification: paymentData.payer?.identification,
        },
      }),
    });

    const payment = (await paymentResponse.json()) as MercadoPagoCardPayment;
    const paymentId = String(payment.id ?? "");
    const paymentStatus = payment.status ?? "unknown";

    if (!paymentResponse.ok || !paymentId) {
      await updateOrderPayment(order.orderId, "payment_failed", paymentId || "card-create-failed");
      return Response.json(
        {
          error:
            payment.message ??
            payment.error ??
            "Mercado Pago nao conseguiu processar o cartao.",
        },
        { status: 502 },
      );
    }

    await updateOrderPayment(order.orderId, paymentStatus, paymentId);

    return Response.json({
      orderId: order.orderId,
      paymentId,
      paymentStatus,
      statusDetail: payment.status_detail,
      orderStatus: paymentStatus === "approved" ? "received" : "pending_payment",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return Response.json({ error: message }, { status: 400 });
  }
}

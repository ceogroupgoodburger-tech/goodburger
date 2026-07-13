import {
  getAccessToken,
  getSiteOrigin,
  isStoreOpen,
  normalizeOrder,
  savePendingOrder,
  updateOrderPayment,
  type IncomingCustomer,
} from "../../order-utils";

type PixOrderBody = {
  cart?: unknown;
  customer?: IncomingCustomer;
};

type MercadoPagoPixPayment = {
  id?: string | number;
  status?: string;
  message?: string;
  error?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
};

function buildPayerEmail(orderId: string) {
  return `pedido-${orderId.toLowerCase()}@goodburger.local`;
}

function buildPayerPhone(phone?: string) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length < 8) return undefined;

  return {
    area_code: digits.length > 10 ? digits.slice(0, 2) : undefined,
    number: digits.length > 10 ? digits.slice(2) : digits,
  };
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

    const body = (await request.json()) as PixOrderBody;
    if (body.customer?.payment !== "PIX") {
      return Response.json({ error: "Forma de pagamento invalida para PIX." }, { status: 400 });
    }

    if (!(await isStoreOpen())) {
      return Response.json(
        { error: "A loja esta fechada no momento. Tente novamente no horario de atendimento." },
        { status: 403 },
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
    const paymentResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": order.orderId,
      },
      body: JSON.stringify({
        transaction_amount: Number(order.total.toFixed(2)),
        description: `Pedido ${order.orderId} - Good Burger`,
        payment_method_id: "pix",
        external_reference: order.orderId,
        notification_url: `${origin}/api/mercado-pago/webhook`,
        payer: {
          email: buildPayerEmail(order.orderId),
          first_name: String(order.customer.name ?? "Cliente").slice(0, 60),
          phone: buildPayerPhone(order.customer.phone),
        },
      }),
    });

    const payment = (await paymentResponse.json()) as MercadoPagoPixPayment;
    const transactionData = payment.point_of_interaction?.transaction_data;
    const pixCode = transactionData?.qr_code;
    const qrCodeBase64 = transactionData?.qr_code_base64;
    const paymentId = String(payment.id ?? "");
    const paymentStatus = payment.status ?? "pending";

    if (!paymentResponse.ok || !paymentId || !pixCode) {
      await updateOrderPayment(order.orderId, "payment_failed", paymentId || "pix-create-failed");
      return Response.json(
        {
          error:
            payment.message ??
            payment.error ??
            "Mercado Pago nao conseguiu gerar o PIX.",
        },
        { status: 502 },
      );
    }

    await updateOrderPayment(order.orderId, paymentStatus, paymentId);

    return Response.json({
      orderId: order.orderId,
      paymentId,
      pixCode,
      qrCodeBase64,
      ticketUrl: transactionData?.ticket_url,
      amount: order.total,
      paymentStatus,
      orderStatus: "pending_payment",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return Response.json({ error: message }, { status: 400 });
  }
}

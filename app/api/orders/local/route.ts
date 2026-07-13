import {
  isStoreOpen,
  normalizeOrder,
  saveLocalPaymentOrder,
  type IncomingCustomer,
} from "../../order-utils";

type LocalOrderBody = {
  cart?: unknown;
  customer?: IncomingCustomer;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LocalOrderBody;
    if (
      body.customer?.payment === "PIX" ||
      body.customer?.payment === "Cartão de crédito" ||
      body.customer?.payment === "Cartão de débito"
    ) {
      return Response.json(
        { error: "Esta forma de pagamento precisa de confirmacao online." },
        { status: 400 },
      );
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

    const saved = await saveLocalPaymentOrder(order);

    return Response.json({
      orderId: order.orderId,
      paymentStatus: "local_pending",
      orderStatus: "received",
      stored: saved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return Response.json({ error: message }, { status: 400 });
  }
}

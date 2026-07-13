import { getAccessToken, updateOrderPayment } from "../../order-utils";

type MercadoPagoWebhook = {
  type?: string;
  action?: string;
  data?: {
    id?: string | number;
  };
};

type MercadoPagoPayment = {
  id?: string | number;
  status?: string;
  external_reference?: string;
};

async function updatePaymentStatus(paymentId: string) {
  const accessToken = getAccessToken();
  if (!accessToken) return;

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Não foi possível consultar o pagamento no Mercado Pago.");
  }

  const payment = (await response.json()) as MercadoPagoPayment;
  const orderId = payment.external_reference;
  const paymentStatus = payment.status ?? "unknown";
  if (!orderId) return;

  await updateOrderPayment(orderId, paymentStatus, String(payment.id ?? paymentId));
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const payload = (await request.json().catch(() => ({}))) as MercadoPagoWebhook;
    const paymentId =
      payload.data?.id?.toString() ??
      url.searchParams.get("data.id") ??
      url.searchParams.get("id");

    if (payload.type && payload.type !== "payment") {
      return Response.json({ ok: true, ignored: payload.type });
    }

    if (paymentId) {
      await updatePaymentStatus(paymentId);
    }

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const paymentId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  if (paymentId) {
    await updatePaymentStatus(paymentId);
  }
  return Response.json({ ok: true });
}

import { getAdminToken, listOrders, updateOrderPayment, updateOrderStatus } from "../../order-utils";

type UpdateBody = {
  orderId?: string;
  paymentStatus?: string;
  paymentId?: string;
  orderStatus?: string;
};

function isAuthorized(request: Request) {
  const expectedToken = getAdminToken();
  if (!expectedToken) return false;

  const url = new URL(request.url);
  const providedToken =
    request.headers.get("x-admin-token") ??
    url.searchParams.get("key") ??
    "";

  return providedToken === expectedToken;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Acesso nao autorizado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 80);
  const startAt = Number(url.searchParams.get("startAt") ?? NaN);
  const endAt = Number(url.searchParams.get("endAt") ?? NaN);
  const orders = await listOrders({
    limit,
    startAt: Number.isFinite(startAt) ? startAt : undefined,
    endAt: Number.isFinite(endAt) ? endAt : undefined,
  });
  if (!orders) {
    return Response.json({ error: "Banco de pedidos indisponivel." }, { status: 503 });
  }

  return Response.json({ orders });
}

export async function PATCH(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Acesso nao autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as UpdateBody;
    if (!body.orderId || (!body.orderStatus && !body.paymentStatus)) {
      return Response.json({ error: "Informe pedido e status." }, { status: 400 });
    }

    if (body.paymentStatus === "approved") {
      const updated = await updateOrderPayment(
        body.orderId,
        "approved",
        body.paymentId ?? "manual-confirmation",
      );
      if (!updated) {
        return Response.json({ error: "Banco de pedidos indisponivel." }, { status: 503 });
      }

      return Response.json({ ok: true });
    }

    if (!body.orderStatus) {
      return Response.json({ error: "Status de pedido invalido." }, { status: 400 });
    }

    const updated = await updateOrderStatus(body.orderId, body.orderStatus);
    if (!updated) {
      return Response.json({ error: "Banco de pedidos indisponivel." }, { status: 503 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return Response.json({ error: message }, { status: 400 });
  }
}

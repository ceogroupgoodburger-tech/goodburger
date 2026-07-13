import { getOrderStatus } from "../../order-utils";

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("id");
  if (!orderId) {
    return Response.json({ error: "Informe o pedido." }, { status: 400 });
  }

  const order = await getOrderStatus(orderId);
  if (order === undefined) {
    return Response.json({ error: "Banco de pedidos indisponivel." }, { status: 503 });
  }

  if (!order) {
    return Response.json({ error: "Pedido nao encontrado." }, { status: 404 });
  }

  return Response.json(order);
}

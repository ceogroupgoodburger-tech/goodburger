import { getAdminToken, getStoreStatus, setStoreStatus } from "../../order-utils";

function isAuthorized(request: Request) {
  const expectedToken = getAdminToken();
  if (!expectedToken) return false;

  const url = new URL(request.url);
  const providedToken =
    request.headers.get("x-admin-token") ?? url.searchParams.get("key") ?? "";

  return providedToken === expectedToken;
}

export async function GET() {
  const status = await getStoreStatus();
  return Response.json(status, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function PATCH(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Acesso nao autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { isOpen?: unknown };
    if (typeof body.isOpen !== "boolean") {
      return Response.json({ error: "Informe se a loja esta aberta." }, { status: 400 });
    }

    const status = await setStoreStatus(body.isOpen);
    if (!status) {
      return Response.json({ error: "Banco de pedidos indisponivel." }, { status: 503 });
    }

    return Response.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return Response.json({ error: message }, { status: 400 });
  }
}

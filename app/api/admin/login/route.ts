import { getAdminPassword, getAdminToken, getAdminUsername } from "../../order-utils";

type LoginBody = {
  username?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    const configuredUsername = getAdminUsername();
    const configuredPassword = getAdminPassword();

    if (!configuredUsername || !configuredPassword) {
      return Response.json(
        { error: "Acesso administrativo aguardando configuração das credenciais." },
        { status: 503 },
      );
    }

    if (username !== configuredUsername || password !== configuredPassword) {
      return Response.json({ error: "Usuario ou senha invalidos." }, { status: 401 });
    }

    return Response.json({ token: getAdminToken() });
  } catch {
    return Response.json({ error: "Nao foi possivel fazer login." }, { status: 400 });
  }
}

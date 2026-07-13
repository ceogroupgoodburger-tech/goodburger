# Good Burger — pedidos online

Aplicação independente da Good Burger, com interface de cliente e painel administrativo de pedidos.

## Incluído

- Cardápio completo extraído da página pública do Anota AI.
- Fotos originais dos produtos e logomarca da loja.
- Carrinho, entrega ou retirada, observações e adicionais.
- Pagamento por PIX, cartão online, cartão no local e dinheiro.
- Painel em `/admin/pedidos`, com login, status da loja, acompanhamento, impressão e relatórios.
- Endereço e horários públicos da unidade de Guarapari.

## Credenciais pendentes

Copie `.env.example` para `.env.local` somente quando o proprietário fornecer os dados. Até lá, nenhuma credencial de outro projeto é usada aqui.

- `ADMIN_USERNAME`, `ADMIN_PASSWORD` e `ORDERS_ADMIN_TOKEN`
- `NEXT_PUBLIC_WHATSAPP_NUMBER` e `NEXT_PUBLIC_DELIVERY_FEE`
- `MERCADO_PAGO_ACCESS_TOKEN` e `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` quando a hospedagem não usar D1
- `PIX_KEY`, `PIX_MERCHANT_NAME` e `PIX_MERCHANT_CITY`
- `NEXT_PUBLIC_SITE_URL`

## Desenvolvimento

```bash
npm install
npm run dev
```

Abra `http://127.0.0.1:3000`.

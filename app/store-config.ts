export const storeConfig = {
  name: "Good Burger",
  address: "Rua Antônio Cláudio Coutinho, 416 - Centro, Guarapari - ES, 29200-115",
  openingHours: "Terça a sábado a partir das 18h · domingo a partir das 18h30",
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "",
  deliveryFee: Number(process.env.NEXT_PUBLIC_DELIVERY_FEE ?? 0),
};

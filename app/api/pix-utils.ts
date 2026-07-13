type PixPayloadInput = {
  key: string;
  amount: number;
  merchantName: string;
  merchantCity: string;
  txid: string;
};

function emv(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function cleanPixText(value: string, maxLength: number) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 $%*+\-./:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, maxLength);
}

function cleanPixTxid(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 25) || "***"
  );
}

export function normalizePixKey(value: string) {
  const cleanValue = value.trim();
  const digits = cleanValue.replace(/\D/g, "");

  if (digits.length === 11 || digits.length === 14) {
    return digits;
  }

  if (cleanValue.startsWith("+") && digits.length >= 10) {
    return `+${digits}`;
  }

  return cleanValue;
}

export function formatPixKeyForDisplay(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }

  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }

  return value;
}

function crc16Ccitt(payload: string) {
  let crc = 0xffff;

  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function generatePixPayload(input: PixPayloadInput) {
  const pixKey = normalizePixKey(input.key);
  if (!pixKey) {
    throw new Error("Chave Pix nao configurada.");
  }

  const merchantAccount = [
    emv("00", "br.gov.bcb.pix"),
    emv("01", pixKey),
  ].join("");

  const txid = cleanPixTxid(input.txid);
  const amount = input.amount.toFixed(2);
  const payloadWithoutCrc = [
    emv("00", "01"),
    emv("01", "12"),
    emv("26", merchantAccount),
    emv("52", "0000"),
    emv("53", "986"),
    emv("54", amount),
    emv("58", "BR"),
    emv("59", cleanPixText(input.merchantName, 25) || "WALDICK BURGUER"),
    emv("60", cleanPixText(input.merchantCity, 15) || "VILA VELHA"),
    emv("62", emv("05", txid)),
    "6304",
  ].join("");

  return `${payloadWithoutCrc}${crc16Ccitt(payloadWithoutCrc)}`;
}

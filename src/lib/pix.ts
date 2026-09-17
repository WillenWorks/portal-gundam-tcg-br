/* Gerador de payload Pix "Copia e Cola" (BR Code / EMV QR Code, padrão Bacen) — usado pelo
 * CommunitySupportModal pra montar um QR Code Pix estático de verdade (escaneável em
 * qualquer banco), sem depender de nenhuma API externa. Campos e formato: manual "Arranjo
 * Pix — QR Codes" do Banco Central. CRC16 é CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF,
 * sem reflexão, xorout 0x0000) — valor de conferência do catálogo CRC pra "123456789" é
 * 0x29B1, coberto em pix.test.ts.
 */

export type PixPayloadInput = {
  key: string;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  description?: string;
  txId?: string;
};

function tlv(id: string, value: string): string {
  const length = value.length.toString().padStart(2, "0");
  return `${id}${length}${value}`;
}

// Remove acento/caractere fora de ASCII básico -- o padrão Pix exige ASCII puro nos campos
// de texto (nome, cidade), então normaliza antes de truncar pelo limite de cada campo.
function sanitizeAscii(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

export function crc16ccitt(input: string): number {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

export function buildPixPayload({ key, merchantName, merchantCity, amount, description, txId }: PixPayloadInput): string {
  const merchantAccountInfo = [
    tlv("00", "br.gov.bcb.pix"),
    tlv("01", key.trim()),
    description ? tlv("02", sanitizeAscii(description).slice(0, 72)) : "",
  ].join("");

  const additionalData = tlv("05", (txId?.trim() || "***").slice(0, 25));

  const payloadWithoutCrc = [
    tlv("00", "01"), // Payload Format Indicator
    tlv("01", "11"), // Point of Initiation Method -- estático (mesmo QR pode ser escaneado várias vezes)
    tlv("26", merchantAccountInfo), // Merchant Account Information -- Pix
    tlv("52", "0000"), // Merchant Category Code -- genérico
    tlv("53", "986"), // Transaction Currency -- BRL
    amount && amount > 0 ? tlv("54", amount.toFixed(2)) : "",
    tlv("58", "BR"), // Country Code
    tlv("59", sanitizeAscii(merchantName).slice(0, 25) || "ANAHEIM HUB"), // Merchant Name
    tlv("60", sanitizeAscii(merchantCity).slice(0, 15) || "SAO PAULO"), // Merchant City
    tlv("62", additionalData), // Additional Data Field Template
  ].join("") + "6304"; // CRC tag+length fixos, o valor entra depois

  const crc = crc16ccitt(payloadWithoutCrc).toString(16).toUpperCase().padStart(4, "0");
  return `${payloadWithoutCrc}${crc}`;
}

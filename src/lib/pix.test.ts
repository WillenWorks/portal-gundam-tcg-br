import { describe, expect, it } from "vitest";

import { buildPixPayload, crc16ccitt } from "@/lib/pix";

describe("crc16ccitt", () => {
  it("bate o valor de conferência oficial do catálogo CRC-16/CCITT-FALSE para '123456789'", () => {
    // Valor publicado (check value) da variante CRC-16/CCITT-FALSE: 0x29B1 -- mesma usada no
    // BR Code Pix. Serve de teste de regressão independente do domínio Pix.
    expect(crc16ccitt("123456789")).toBe(0x29b1);
  });
});

describe("buildPixPayload", () => {
  const base = { key: "chave-pix@example.com", merchantName: "Anaheim Hub", merchantCity: "Sao Paulo" };

  it("gera um payload terminando em CRC16 hexadecimal de 4 dígitos", () => {
    const payload = buildPixPayload(base);
    expect(payload).toMatch(/6304[0-9A-F]{4}$/);
  });

  it("inclui o GUI do Pix e a chave informada", () => {
    const payload = buildPixPayload(base);
    expect(payload).toContain("br.gov.bcb.pix");
    expect(payload).toContain(base.key);
  });

  it("inclui o valor formatado com 2 casas decimais quando amount é informado", () => {
    const payload = buildPixPayload({ ...base, amount: 25 });
    expect(payload).toContain("540525.00");
  });

  it("omite o campo de valor (tag 54) quando amount não é informado", () => {
    const payload = buildPixPayload(base);
    expect(payload).not.toMatch(/54\d{2}\d+\.\d{2}/);
  });

  it("usa '***' como referência padrão quando txId não é informado", () => {
    const payload = buildPixPayload(base);
    expect(payload).toContain("0503***");
  });

  it("normaliza acentos no nome e na cidade", () => {
    const payload = buildPixPayload({ ...base, merchantName: "São Paulo Ação", merchantCity: "São Paulo" });
    expect(payload).not.toMatch(/[À-ú]/);
  });
});

/* Tipo real de uma imagem enviada, lido dos primeiros bytes: o tipo declarado vem do cliente e não é confiável.
 * SVG fica de fora de propósito, porque pode carregar script. */
const ascii = (buffer: Buffer, start: number, end: number) => buffer.subarray(start, end).toString("latin1");

export type SniffedImageType = "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "image/avif";

export function sniffImageType(buffer: Buffer): SniffedImageType | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  const gif = ascii(buffer, 0, 6);
  if (gif === "GIF87a" || gif === "GIF89a") return "image/gif";
  if (ascii(buffer, 0, 4) === "RIFF" && ascii(buffer, 8, 12) === "WEBP") return "image/webp";
  if (ascii(buffer, 4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(buffer, 8, 12))) return "image/avif";
  return null;
}

export const IMAGE_EXTENSION_BY_TYPE: Record<SniffedImageType, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

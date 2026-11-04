import { describe, expect, it } from "vitest";
import { sniffImageType } from "./imageSniff.ts";

const pad = (head: number[] | string) => Buffer.concat([typeof head === "string" ? Buffer.from(head, "latin1") : Buffer.from(head), Buffer.alloc(16)]);

describe("sniffImageType", () => {
  it("reconhece os formatos aceitos", () => {
    expect(sniffImageType(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(pad("GIF89a"))).toBe("image/gif");
    expect(sniffImageType(pad("RIFF\0\0\0\0WEBP"))).toBe("image/webp");
    expect(sniffImageType(pad("\0\0\0\x20ftypavif"))).toBe("image/avif");
  });

  it("recusa SVG, HTML e arquivos curtos", () => {
    expect(sniffImageType(pad('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(sniffImageType(pad("<!DOCTYPE html><html>"))).toBeNull();
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff]))).toBeNull();
  });
});

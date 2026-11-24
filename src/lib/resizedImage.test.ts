import { describe, expect, it } from "vitest";
import { isResizableUpload, resizedImageSrc, resizedSrcSet } from "./resizedImage";

describe("resizedImage", () => {
  it("só imagens de /uploads ganham ?w", () => {
    expect(resizedImageSrc("/uploads/spoilers/a.png", 640)).toBe("/uploads/spoilers/a.png?w=640");
    expect(resizedImageSrc("https://cdn.exemplo.com/a.png", 640)).toBe("https://cdn.exemplo.com/a.png");
    expect(resizedImageSrc("/uploads/doc.pdf", 640)).toBe("/uploads/doc.pdf");
    expect(isResizableUpload("/uploads/a.jpg?v=2")).toBe(false);
  });

  it("monta o srcset com as larguras do servidor", () => {
    expect(resizedSrcSet("/uploads/a.jpg", [320, 640])).toBe("/uploads/a.jpg?w=320 320w, /uploads/a.jpg?w=640 640w");
    expect(resizedSrcSet("https://x.com/a.jpg")).toBeUndefined();
  });
});

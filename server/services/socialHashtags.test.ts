/* Hashtags dos posts: o Instagram aceita no máximo 5 por post (anúncio de dez/2025) — cada post leva as 5 que mais
 * importam e a legenda termina exatamente com elas. */
import { describe, expect, it, vi } from "vitest";

vi.mock("@google/genai", () => ({ GoogleGenAI: class {} }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class {} }));

import { captionProblems, cardPostHashtags, withHashtags } from "./socialPublisherService";
import { INSTAGRAM_HASHTAG_MAX } from "./instagramPublisher";

describe("cardPostHashtags — as 5 da carta", () => {
  it("código e nome primeiro, depois comunidade e marca", () => {
    expect(cardPostHashtags({ code: "GD01-010", name: "Gundam Exia" })).toEqual(["GD01010", "GundamExia", "GundamCardGame", "GundamBrasil", "AnaheimHub"]);
  });

  it("spoiler troca uma de comunidade pela de spoiler", () => {
    expect(cardPostHashtags({ code: "GD06-001", name: "Gundam", isSpoiler: true })).toEqual(["GD06001", "Gundam", "GundamSpoiler", "GundamCardGame", "AnaheimHub"]);
  });

  it("nome que repete uma tag da marca não vira duplicata; completa até 5", () => {
    const tags = cardPostHashtags({ code: "ST01-001", name: "Gundam Card Game" });
    expect(tags).toHaveLength(INSTAGRAM_HASHTAG_MAX);
    expect(new Set(tags.map((t) => t.toLowerCase())).size).toBe(tags.length);
  });
});

describe("withHashtags — a legenda termina com as hashtags do post", () => {
  it("troca as da IA (a mais e outras) pelo bloco certo no fim", () => {
    const caption = "Gancho forte.\n\nTexto com #Inline no meio.\n\n#A #B #C #D #E #F #G #H";
    const out = withHashtags(caption, ["GundamCardGame", "AnaheimHub"]);
    expect(out).toBe("Gancho forte.\n\nTexto com no meio.\n\n#GundamCardGame #AnaheimHub");
    expect(captionProblems(out).some((p) => p.includes("hashtags"))).toBe(false);
  });

  it("legenda sem hashtags ganha o bloco", () => {
    expect(withHashtags("Só texto.", ["AnaheimHub"])).toBe("Só texto.\n\n#AnaheimHub");
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { api, type ApiPost } from "@/lib/api";
import { HomeArticlesCarousel } from "./HomeArticlesCarousel";

const article = (over: Partial<ApiPost> = {}): ApiPost => ({
  id: "a1",
  authorId: "u1",
  title: "Simulador em beta",
  slug: "simulador-beta",
  excerpt: "O que vem por aí",
  contentMd: "texto",
  coverImage: "/uploads/capa.jpg",
  postType: "NEWS",
  status: "PUBLISHED",
  publishedAt: "2026-11-01T14:25:18.475Z",
  createdAt: "2026-11-01T01:45:04.700Z",
  updatedAt: "2026-11-01T14:25:18.475Z",
  ...over,
});

function page(items: ApiPost[]) {
  return { items, page: 1, pageSize: 5, total: items.length, totalPages: 1 };
}

describe("HomeArticlesCarousel", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(cleanup);

  it("mostra o artigo publicado, com capa, resumo e link para ele, sem controles de carrossel", async () => {
    const list = vi.spyOn(api, "listPostsPage").mockResolvedValue(page([article()]));
    const { container } = render(<HomeArticlesCarousel />);

    expect(await screen.findByRole("heading", { name: "Simulador em beta" })).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith("PUBLISHED", { page: 1, pageSize: 5 });
    expect(screen.getByText("O que vem por aí")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ler artigo|read article/i })).toHaveAttribute("href", "/articles/simulador-beta");
    expect(container.querySelector("img")).toHaveAttribute("src", "/uploads/capa.jpg");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("com mais de um artigo, mostra as setas e um indicador por artigo", async () => {
    vi.spyOn(api, "listPostsPage").mockResolvedValue(page([article(), article({ id: "a2", slug: "outro", title: "Outro" })]));
    render(<HomeArticlesCarousel />);

    await screen.findByRole("heading", { name: "Simulador em beta" });
    // o slide fora de cena fica escondido de leitores de tela
    expect(screen.queryByRole("heading", { name: "Outro" })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("sem artigo publicado (ou com erro na API), mostra o aviso em vez de conteúdo fixo", async () => {
    vi.spyOn(api, "listPostsPage").mockRejectedValue(new Error("fora do ar"));
    render(<HomeArticlesCarousel />);

    expect(await screen.findByText(/nenhum artigo publicado|no articles published/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading")).toBeNull();
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import type { AdminSupporterUser, AdminSupportersOverview } from "@/lib/api";
import { SupporterBadge } from "@/components/support/SupporterBadge";
import { SupportersWall } from "@/components/support/SupportersWall";
import { UserTagChips } from "@/components/support/UserTagChips";

const apiMock = vi.hoisted(() => ({
  getAdminSupporters: vi.fn(),
  updateAdminSupporterUser: vi.fn(),
  searchAdminSupporterUsers: vi.fn(),
  createSupporterWallEntry: vi.fn(),
  updateSupporterWallEntry: vi.fn(),
  deleteSupporterWallEntry: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { AdminSupportersTab } from "./AdminSupportersTab";

const account = (over: Partial<AdminSupporterUser>): AdminSupporterUser => ({
  id: "u1", username: "amuro", displayName: "Amuro Ray", email: "amuro@ea.com", avatarUrl: null, isSupporter: false,
  supporterTier: null, supporterSince: null, supporterMessage: null, supporterClaimedAt: null, tags: [], ...over,
});

const overview = (over: Partial<AdminSupportersOverview> = {}): AdminSupportersOverview => ({ claims: [], supporters: [], tagged: [], wall: [], ...over });

beforeEach(() => {
  Object.values(apiMock).forEach((fn) => fn.mockReset());
});
afterEach(cleanup);

describe("selo, tags e mural", () => {
  it("selo com patente mostra a patente; sem patente, o selo genérico", () => {
    render(<SupporterBadge tier="PILOTO" />);
    expect(screen.getByText("Apoiador · Piloto")).toBeInTheDocument();
    cleanup();
    render(<SupporterBadge tier={null} />);
    expect(screen.getByText("Apoiador Anaheim Hub")).toBeInTheDocument();
  });

  it("tags fora do catálogo não aparecem", () => {
    render(<UserTagChips tags={["JUIZ", "INVENTADA"]} />);
    expect(screen.getByText("Juiz")).toBeInTheDocument();
    expect(screen.queryByText("INVENTADA")).not.toBeInTheDocument();
  });

  it("mural: conta vira link para o perfil; nome sem conta é só texto", () => {
    render(<SupportersWall supporters={[{ name: "Char", username: "char", tier: "COMANDANTE" }, { name: "Fã do Apoia.se", tier: "RECRUTA" }]} />);
    expect(screen.getByRole("link", { name: "Char" })).toHaveAttribute("href", "/u/char");
    expect(screen.queryByRole("link", { name: "Fã do Apoia.se" })).not.toBeInTheDocument();
    expect(screen.getByText("Apoiador · Comandante")).toBeInTheDocument();
  });
});

describe("aba Apoiadores do admin", () => {
  it("aprova pedido com a patente escolhida e recarrega", async () => {
    apiMock.getAdminSupporters.mockResolvedValueOnce(overview({ claims: [account({ supporterClaimedAt: "2026-11-17T10:00:00Z", supporterMessage: "Valeu!" })] }));
    apiMock.getAdminSupporters.mockResolvedValue(overview());
    apiMock.updateAdminSupporterUser.mockResolvedValue(account({ isSupporter: true, supporterTier: "AS" }));
    render(<AdminSupportersTab />);
    expect(await screen.findByText(/recado: “Valeu!”/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Patente para @amuro"), { target: { value: "AS" } });
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    await waitFor(() => expect(apiMock.updateAdminSupporterUser).toHaveBeenCalledWith("u1", { isSupporter: true, tier: "AS" }));
    await waitFor(() => expect(apiMock.getAdminSupporters).toHaveBeenCalledTimes(2));
  });

  it("recusa pedido sem dar o selo", async () => {
    apiMock.getAdminSupporters.mockResolvedValue(overview({ claims: [account({ supporterClaimedAt: "2026-11-17T10:00:00Z" })] }));
    apiMock.updateAdminSupporterUser.mockResolvedValue(account({}));
    render(<AdminSupportersTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Recusar" }));
    await waitFor(() => expect(apiMock.updateAdminSupporterUser).toHaveBeenCalledWith("u1", { claim: "reject" }));
  });

  it("dá várias tags a uma conta achada na busca", async () => {
    apiMock.getAdminSupporters.mockResolvedValue(overview());
    apiMock.searchAdminSupporterUsers.mockResolvedValue([account({ id: "u2", username: "kai", displayName: "Kai" })]);
    apiMock.updateAdminSupporterUser.mockResolvedValue(account({ id: "u2", username: "kai", tags: ["JUIZ", "BETA"] }));
    render(<AdminSupportersTab />);
    fireEvent.change(await screen.findByLabelText("Buscar conta"), { target: { value: "kai" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    const tags = await screen.findByRole("group", { name: "Tags de @kai" });
    const save = screen.getByRole("button", { name: "Salvar" });
    expect(save).toBeDisabled();
    fireEvent.click(within(tags).getByRole("button", { name: "Juiz" }));
    fireEvent.click(within(tags).getByRole("button", { name: "Testador beta" }));
    fireEvent.click(save);
    await waitFor(() => expect(apiMock.updateAdminSupporterUser).toHaveBeenCalledWith("u2", { isSupporter: false, tier: null, tags: ["JUIZ", "BETA"] }));
  });

  it("adiciona nome sem conta ao mural", async () => {
    apiMock.getAdminSupporters.mockResolvedValue(overview());
    apiMock.createSupporterWallEntry.mockResolvedValue({});
    render(<AdminSupportersTab />);
    fireEvent.change(await screen.findByLabelText("Nome no mural"), { target: { value: "Fã do Apoia.se" } });
    fireEvent.change(screen.getByLabelText("Patente no mural"), { target: { value: "PILOTO" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(apiMock.createSupporterWallEntry).toHaveBeenCalledWith({ displayName: "Fã do Apoia.se", tier: "PILOTO", message: undefined }));
  });
});

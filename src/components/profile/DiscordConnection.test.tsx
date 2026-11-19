// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({ startDiscordLink: vi.fn(), disconnectDiscord: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/api", () => ({ api }));
vi.mock("sonner", () => ({ toast }));

import { DiscordConnection } from "./DiscordConnection";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/profile");
});

describe("DiscordConnection", () => {
  it("sem conta conectada, o botão leva ao endereço de autorização do Discord", async () => {
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign, search: "" } as Location);
    api.startDiscordLink.mockResolvedValue({ url: "https://discord.com/oauth2/authorize?client_id=1" });
    render(<DiscordConnection connected={false} onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Conectar Discord" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://discord.com/oauth2/authorize?client_id=1"));
    vi.restoreAllMocks();
  });

  it("endereço que não é do Discord não é seguido", async () => {
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign, search: "" } as Location);
    api.startDiscordLink.mockResolvedValue({ url: "https://evil.example/oauth2/authorize?x" });
    render(<DiscordConnection connected={false} onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Conectar Discord" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(assign).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("conectado: mostra o nome e desconecta", async () => {
    const onChange = vi.fn();
    api.disconnectDiscord.mockResolvedValue({ ok: true });
    render(<DiscordConnection connected username="Amuro Ray" onChange={onChange} />);
    expect(screen.getByText("@Amuro Ray")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Desconectar" }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it("volta do Discord com ?discord=conectado: avisa uma vez e limpa a barra", async () => {
    window.history.replaceState(null, "", "/profile?discord=conectado");
    const onChange = vi.fn();
    render(<DiscordConnection connected={false} onChange={onChange} />);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe("");
    expect(onChange).toHaveBeenCalled();
  });
});

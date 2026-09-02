// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RotateDevicePrompt } from "./RotateDevicePrompt";

afterEach(cleanup);

describe("RotateDevicePrompt", () => {
  it("é um alertdialog rotulado com a instrução de girar", () => {
    render(<RotateDevicePrompt />);
    expect(screen.getByRole("alertdialog", { name: /modo paisagem/i })).toBeInTheDocument();
    expect(screen.getByText(/Gire para o modo paisagem/i)).toBeInTheDocument();
  });

  it("aceita className extra sem perder o overlay fixo", () => {
    render(<RotateDevicePrompt className="custom-x" />);
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.className).toMatch(/fixed/);
    expect(dialog.className).toMatch(/custom-x/);
  });
});

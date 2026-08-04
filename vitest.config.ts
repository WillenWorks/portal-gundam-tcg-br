import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "node",
    include: ["prisma/**/*.test.mjs", "scripts/**/*.test.mjs", "src/**/*.test.{ts,tsx}", "server/**/*.test.ts"],
  },
});

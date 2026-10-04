import { execSync } from "node:child_process";
import path from "path";
import babel from "@rolldown/plugin-babel";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// docs/46 — sha curto do motor pra bater build ↔ engine (Lane 0A consome
// `import.meta.env.VITE_ENGINE_SHA`). Fallback "dev" fora de um checkout git.
function gitShaCurto(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim() || "dev";
  } catch {
    return "dev";
  }
}

export default defineConfig({
  define: {
    "import.meta.env.VITE_ENGINE_SHA": JSON.stringify(process.env.VITE_ENGINE_SHA ?? gitShaCurto()),
  },
  plugins: [
    react(),
    // plugin-react 6 não roda Babel; o plugin de data-source passa pelo @rolldown/plugin-babel.
    babel({
      include: /\.[jt]sx(?:$|\?)/,
      plugins: [
        // Inject data-source attribute for AI agent source location
        "./scripts/babel-plugin-jsx-source-location.cjs",
      ],
    }),
    tailwindcss(),
  ],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name(id) {
                if (!id.includes("node_modules")) return null;
                if (id.includes("recharts")) return "charts";
                return "vendor";
              },
            },
          ],
        },
      },
    },
  },
});

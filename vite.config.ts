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
          // Grupos fixos só para o que TODA página usa; o resto (recharts, markdown, simulador…) o Rolldown divide
          // sozinho junto das páginas lazy que o usam. Não criar grupo "vendor"/"charts" genérico: cada grupo captura
          // também as dependências dos seus módulos, e um grupo de gráficos chegou a levar o React e o `clsx` junto,
          // pondo ~1,1 MB de vendor + recharts no carregamento inicial de toda página (1.756 kB → 706 kB de JS inicial).
          groups: [
            { name: "vendor-framework", test: /node_modules[\\/](react|react-dom|scheduler|wouter)[\\/]/, priority: 40 },
            { name: "vendor-ui", test: /node_modules[\\/]@radix-ui[\\/]/, priority: 30 },
            { name: "vendor-icons", test: /node_modules[\\/]lucide-react[\\/]/, priority: 30 },
          ],
        },
      },
    },
  },
});

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `dist` = build output; `scripts/` e `prisma/` são utilitários Node/dados
  // (alguns `.mjs`, um deles é até Python com extensão errada) — não fazem
  // parte do app tipado e nunca foram cobertos pelo lint da UI.
  globalIgnores(['dist', 'scripts/**', 'prisma/**', '*.config.js']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // `any` é usado deliberadamente e em larga escala em `lib/api.ts`,
      // `server/index.ts` e nas páginas (borda de dados não tipada) — manter
      // como aviso pra não esconder a dívida, sem quebrar o gate de lint.
      '@typescript-eslint/no-explicit-any': 'warn',
      // variáveis/args prefixados com `_` são descartes intencionais.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // shadcn/ui exporta variantes (`buttonVariants` etc.) ao lado do
      // componente no mesmo arquivo — padrão aceito, Fast Refresh só perde o
      // hot-reload desse arquivo.
      'react-refresh/only-export-components': 'warn',
      // regras novas do eslint-plugin-react-hooks (React Compiler) — apontam
      // refactors grandes que o time ainda não adotou; visíveis como aviso.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
])

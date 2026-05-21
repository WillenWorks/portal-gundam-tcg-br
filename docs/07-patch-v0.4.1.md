# Patch v0.4.1 — Correção do Prisma seed em ambiente ESM

## Correção aplicada

O comando:

```bash
pnpm prisma:seed
```

estava falhando porque o projeto usa:

```json
"type": "module"
```

no `package.json`, mas o seed anterior estava escrito com `require(...)` em arquivo `.js`.

## Ajuste feito

- script alterado de `node prisma/seed.js` para `node prisma/seed.cjs`
- seed renomeado para `prisma/seed.cjs`
- conteúdo CommonJS preservado para compatibilidade simples com o ambiente local

## Comando correto após o patch

```bash
pnpm prisma:seed
```

## Commit sugerido

```bash
fix(prisma): correct seed execution under esm project mode
```

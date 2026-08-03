# Atualização corrigida — Relações editoriais e detalhe da carta

## Correção deste pacote

A versão anterior não incluía `src/lib/api.ts`. Este arquivo agora está presente e registra os métodos usados pelas novas telas:

- `getCardRelations`
- `createCardRelation`
- `deleteCardRelation`

## Aplicação

1. Extraia este ZIP na **raiz do projeto** (`portal-gundam-tcg-br`), permitindo a substituição dos arquivos.
2. Execute:

```bash
pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm run build
```

3. Reinicie o frontend e a API como faz normalmente.

> A migration pode indicar que já foi aplicada. Isso é esperado se você já executou os comandos da versão anterior.

## Validação feita

- `npx tsc --noEmit`
- `pnpm run build`

Ambos concluídos sem erros com os arquivos deste pacote.

# Seed de traits e mídias

## O que foi incluído

- **77 traits canônicas** extraídas das cartas jogáveis do dataset API TCG.
  - A extração lê os valores entre parênteses de `attributes.Trait`.
  - O marcador técnico `-` é ignorado.
  - As variações `Cyber Newtype` e `CyberNewtype` foram consolidadas em `Cyber-Newtype`, preservando os aliases em `metadataJson`.
- **17 mídias/séries curadas** conforme a lista definida para o projeto.
  - `Mobile Suit Gundam IRON-BLOODED ORPHANS` foi normalizada para `Mobile Suit Gundam: Iron-Blooded Orphans` e mantida como alias.
- Cada taxonomy recebe metadados de origem para auditoria.
- A carga de traits e mídias **não cria pilotos como taxonomy**. Pilotos continuam sendo cartas do tipo `PILOT` e usam traits para compatibilidade de Link.

## Arquivos principais

- `prisma/apitcg-taxonomies.mjs`: módulo de normalização e upsert.
- `prisma/seed-apitcg-taxonomies.mjs`: seed isolado, sem alterar cards, sets, decks ou binders.
- `prisma/seed-apitcg.mjs`: seed completo; agora inclui as taxonomias ao final.
- `scripts/check-apitcg-taxonomies.mjs`: valida o dataset e a lista curada.

## Aplicar somente traits e mídias

Com o banco e a API desligados ou em estado estável, execute:

```powershell
pnpm install
pnpm prisma:generate
pnpm run catalog:apitcg:check:taxonomies
pnpm run prisma:seed:apitcg:taxonomies
```

Esse fluxo é idempotente: pode ser executado novamente sem duplicar registros.

## Recarregar todo o catálogo + taxonomias

Caso precise reconstruir cards, sets, decks e binders antes da carga:

```powershell
pnpm run catalog:apitcg:check
pnpm run catalog:apitcg:check:taxonomies
pnpm run prisma:rebuild:apitcg
```

O seed completo chama automaticamente o seed de traits e mídias após importar sets e cartas.

## Validação final

```powershell
npx prisma validate
pnpm run catalog:apitcg:check
pnpm run catalog:apitcg:check:taxonomies
pnpm run build
```

## Observação sobre mídias nas cartas

As mídias foram cadastradas como referência controlada, mas ainda não foram atribuídas automaticamente a cada carta. A extração da API TCG não fornece uma relação carta → anime/série confiável; esse vínculo deve ser tratado em uma futura etapa de curadoria para evitar associações incorretas.

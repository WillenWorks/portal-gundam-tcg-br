# Checklist de migration

Processo de segurança para mudar o schema do banco (`prisma/schema.prisma`) sem
perder dado ou quebrar ambiente de terceiros. Este documento é sobre **como aplicar**
mudança de schema; para convenção de dado (relações editoriais), ver
`docs/10-convencoes-relacoes-cartas.md`.

## O risco específico deste projeto: drift entre `db push` e `migrate`

O fluxo documentado em `docs/02-setup-local.md` usa **dois mecanismos diferentes** pra
sincronizar schema, e isso é a origem do risco real de perda de dado aqui:

- **`prisma db push`** (via `pnpm dev:api`, no dia a dia): sincroniza o banco com o
  schema atual, sem gerar arquivo de migration, sem histórico.
- **`prisma migrate dev`** (versionado, registrado em `prisma/migrations/`): compara
  o schema com o **histórico de migrations**, não com o banco em si.

Se você usar `db push` pra iterar rápido em uma mudança e, depois, rodar
`prisma migrate dev` pra formalizar essa mesma mudança como migration, o Prisma pode
detectar que o banco "andou" sem uma migration correspondente (**drift**) e vai
**propor resetar o banco local** pra recolocar tudo em sincronia com o histórico —
o que apaga todo o dado local, incluindo curadoria manual que não está em nenhum
arquivo fonte (ex: relações confirmadas manualmente na fila de curadoria).

**Regra prática: sempre rode `pnpm exec prisma migrate status` antes de qualquer
mudança de schema.** Se ele acusar drift, resolva isso *antes* de mexer em mais
nada — não empilhe a mudança nova em cima de um histórico já dessincronizado.

## Checklist — mudança de schema em dev local

1. `git status` limpo (sem mudança de schema pendente de outra tarefa).
2. `pnpm exec prisma migrate status` — confirma que não há drift acumulado.
3. Se precisar de dado real pra testar a mudança, prefira recriar do zero
   (`pnpm run catalog:bootstrap:fresh`, ver `docs/02-setup-local.md`) a editar um banco
   que já tem curadoria manual acumulada — assim, se algo sair errado, o prejuízo é
   só tempo de re-rodar o bootstrap, não trabalho de curadoria perdido.
4. Edite `prisma/schema.prisma`.
5. Gere a migration: `pnpm exec prisma migrate dev --name descricao-curta-da-mudanca`.
   Isso já aplica no banco local e gera o SQL em `prisma/migrations/`.
6. **Leia o SQL gerado** (`prisma/migrations/<timestamp>_.../migration.sql`) antes de
   commitar. O Prisma às vezes traduz uma intenção simples (ex: renomear campo) como
   `DROP COLUMN` + `ADD COLUMN`, que perde o dado da coluna antiga — ver seção abaixo.
7. `pnpm exec tsc -b` — confirma que o código (`server/`, `src/`) ainda compila contra
   o Prisma Client atualizado.
8. Rode a rota/feature afetada manualmente antes de dar commit.
9. Commit do schema + da pasta de migration juntos, nunca separados.

## Casos que merecem cuidado extra (risco de perda de dado)

| Mudança | Risco | Como fazer com segurança |
|---|---|---|
| Renomear campo/tabela | Prisma pode gerar `DROP` + `CREATE`, perdendo o dado da coluna antiga | Edite o SQL gerado manualmente pra `ALTER TABLE ... RENAME COLUMN`, ou faça em 2 migrations: adiciona campo novo → *(script de backfill)* → remove campo antigo, cada uma em momento separado |
| Remover coluna/tabela | Perda definitiva do dado nela | Confirme que ninguém no time/local depende do dado antes. Considere manter por 1 ciclo a mais como `@deprecated` em comentário antes de remover de fato |
| Trocar tipo de coluna (ex: `String` → `Int`) | Postgres pode rejeitar a conversão se houver dado incompatível, ou truncar silenciosamente | Teste a migration contra uma cópia do banco com dado real antes (não só banco vazio) |
| Adicionar campo `NOT NULL` sem default em tabela com dado existente | Migration falha na hora de aplicar (constraint viola linhas existentes) | Adicione com `?` (nullable) ou `@default(...)`, faça o backfill manual dos valores, só depois torne obrigatório numa migration seguinte |

## Rollback: não existe "desfazer" automático

O Prisma Migrate (na versão deste projeto) **não gera migration de reversão
automática** — não existe um `prisma migrate down`. As duas formas reais de reverter
uma migration problemática são:

1. **Restaurar de um backup** anterior à migration (ver frente de Backup do roadmap —
   ainda não implementada neste projeto no momento em que este doc foi escrito).
2. **Rollforward**: escrever uma migration *nova* que desfaz a anterior (ex: se a
   migration problemática criou uma coluna, a de correção remove essa coluna).
   Nunca edite ou apague uma migration já commitada/aplicada em qualquer ambiente
   compartilhado — isso quebra o histórico pra todo mundo que já rodou ela.

Ou seja: **testar antes de aplicar importa mais do que conseguir desfazer depois.**

## Checklist — aplicando em ambiente compartilhado ou produção

Este projeto ainda não tem um ambiente compartilhado/produção configurado (sem
CI/CD, sem banco remoto documentado até agora) — esta seção é pra quando isso
existir. `INSTRUCOES_APITCG.md` já cobre o comando (`prisma migrate deploy`); aqui
vai o checklist de decisão em volta dele:

1. A migration já está commitada e revisada (idealmente por outra pessoa) no `main`.
2. **Backup do banco de destino tirado e confirmado íntegro** antes de qualquer coisa.
3. Rode a migration primeiro contra uma cópia restaurada desse backup, não direto em
   produção — se houver ambiente de staging, use-o; se não houver, uma cópia local
   restaurada do backup já reduz muito o risco.
4. `pnpm exec prisma migrate status` no ambiente de destino, pra confirmar que o
   histórico bate exatamente com o que você espera antes do deploy.
5. `pnpm exec prisma migrate deploy` (nunca `migrate dev` em ambiente compartilhado —
   `dev` pode tentar resetar o banco se detectar drift; `deploy` só aplica o que falta,
   sem essa opção destrutiva).
6. Validação pós-deploy: `pnpm run catalog:apitcg:check` (se a mudança afeta catálogo)
   e um teste manual rápido da funcionalidade que motivou a migration.
7. Se algo der errado: rollforward (seção acima), não tentar editar a migration já
   aplicada.

## Referência rápida

```bash
pnpm exec prisma migrate status              # sempre rodar antes de mexer em schema
pnpm exec prisma migrate dev --name algo     # cria + aplica migration local
pnpm exec prisma migrate deploy              # aplica migrations pendentes, sem prompt destrutivo
pnpm exec prisma db push                     # sincroniza sem migration — só pra iteração rápida em dev
pnpm exec prisma db push --force-reset       # apaga tudo e recria pelo schema atual (só local)
```

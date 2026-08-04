# Backup e restore do banco

Como tirar e restaurar backup do PostgreSQL local (container docker compose).
Ver também `docs/11-checklist-migration.md` — backup é o passo 2 do checklist de
migration em ambiente compartilhado.

## Por que isso existe

Até este doc, a única menção a backup no projeto era uma frase em
`INSTRUCOES_APITCG.md`: *"Faça backup antes da alteração"* — sem comando, sem
script, sem instrução de restore. Dado derivado (catálogo de cartas) sempre pode
ser reconstruído do zero via `pnpm run catalog:bootstrap:fresh` (ver
`docs/02-setup-local.md`), mas dado gerado por gente — contas de usuário, decks,
binders, curadoria manual de relação — **não existe em nenhum arquivo fonte**. Se
sumir do banco, sumiu de verdade.

## Tirar um backup

```bash
pnpm run db:backup
```

Gera um arquivo em `backups/AAAA-MM-DDTHH-MM-SS-mmmZ.dump` (formato `custom` do
`pg_dump` — comprimido, restaurável seletivamente com `pg_restore`, é o formato
que a própria documentação do Postgres recomenda pra esse uso). A pasta
`backups/` está no `.gitignore` — um dump carrega hash de senha e email de
usuário real, nunca deve ir pro Git.

Pra identificar o motivo do backup mais tarde:

```bash
pnpm run db:backup -- --label antes-da-migration-card-relation
```

Requer `pnpm db:up` rodando — o script executa `pg_dump` **dentro do container**
via `docker compose exec`, não precisa de PostgreSQL client instalado na máquina.

## Restaurar um backup

```bash
pnpm run db:restore -- "backups/2026-08-03T22-10-00-000Z.dump"
```

Pede confirmação explícita (digitar "sim") antes de rodar, porque **sobrescreve
todo o conteúdo atual do banco** (`pg_restore --clean --if-exists`) — não tem
desfazer depois disso. Se quiser guardar o estado atual antes de restaurar algo
mais velho, rode `pnpm run db:backup` primeiro.

Pra pular a confirmação (uso em script automatizado, não recomendado manualmente):

```bash
pnpm run db:restore -- "backups/2026-08-03T22-10-00-000Z.dump" --force
```

> O `--` depois de `db:backup`/`db:restore` é necessário — sem ele, o pnpm tenta
> interpretar `--label`/`--force`/o caminho do arquivo como flags dele mesmo, não
> como argumento pro script.

## Quando tirar backup

- **Sempre antes de aplicar uma migration** em qualquer banco que tenha dado que
  importa (ver `docs/11-checklist-migration.md`).
- **Antes de rodar `catalog:bootstrap:fresh` ou `prisma:reset`** se o banco atual
  tiver curadoria manual ainda não commitada em lugar nenhum (a maioria da
  curadoria vem de `curation:gcg:apply`, que é reproduzível a partir do dataset —
  mas qualquer ajuste manual feito direto na fila do admin não é).
- **Rotina, se/quando este projeto tiver um ambiente compartilhado ou produção**
  — este doc ainda não cobre agendamento automático de backup porque esse
  ambiente não existe hoje; quando existir, vale revisitar com um cron/job
  agendado em vez de execução manual.

## O que este backup NÃO cobre

- Arquivos enviados via `STORAGE_DRIVER=local` (`public/uploads/`) — o dump só
  cobre o banco, não o sistema de arquivos. Se usarem upload local de imagens de
  carta customizadas, isso precisa de backup separado (ou migrar pra
  `STORAGE_DRIVER=supabase`, que já teria durabilidade própria).
- Agendamento automático — hoje é um comando manual. Formalizar rotina (cron,
  retenção, backup fora do host) é trabalho futuro, não coberto aqui.

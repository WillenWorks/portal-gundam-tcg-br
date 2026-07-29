# Correção — painel Admin sem dados

Substitua o arquivo `src/pages/AdminPage.tsx` pelo arquivo de mesmo caminho incluído neste pacote.

## O que foi corrigido

O painel administrativo carregava usuários, sets, cartas, rulings e taxonomias com uma única operação conjunta. Assim, se uma rota falhasse — por exemplo, `/api/taxonomies` após uma alteração de migration — nenhuma das respostas bem-sucedidas era exibida.

A versão corrigida:

- carrega cada recurso de forma independente;
- mantém sets, cartas e demais dados visíveis mesmo se uma rota falhar;
- mostra um toast com o recurso e a mensagem de erro retornada pela API;
- busca até 80 cartas por vez no endpoint paginado, evitando renderizar as 1.812 cartas simultaneamente.

## Reinicie aplicação e API

Feche processos antigos de Vite/API antes de iniciar novamente. No diretório do projeto, abra dois terminais.

**Terminal 1 — API**

```powershell
pnpm run dev:api
```

**Terminal 2 — frontend**

```powershell
pnpm run dev
```

Depois, faça um recarregamento forçado no navegador com `Ctrl + Shift + R`.

## Verificação direta da API

Com a API iniciada, abra estas URLs no navegador:

- `http://localhost:8787/api/health`
- `http://localhost:8787/api/sets`
- `http://localhost:8787/api/cards?page=1&pageSize=1`

Após a carga completa, o esperado é:

- `health` com `cardCount` maior que zero;
- `sets` retornando 22 registros;
- `cards` retornando um objeto com `items`, `total` e `totalPages`.

> O Prisma Studio e a API devem apontar para o mesmo `DATABASE_URL` no `.env` localizado na raiz do projeto. Reiniciar a API após qualquer alteração de banco ou `.env` evita manter uma conexão/processo antigo.

Se aparecer um toast no Admin após esta correção, envie a mensagem completa: ela identificará a rota que ainda precisa de ajuste.

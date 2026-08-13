# Deploy (Vercel + Render + Supabase) e login com Google

Arquitetura: front-end estático no **Vercel**, API Express no **Render** (processo de
verdade, não serverless — importante pro simulador futuro precisar de WebSocket),
banco Postgres no **Supabase** (não expira, ao contrário do Postgres grátis do Render).

Tudo que eu (Claude) consigo preparar já está pronto no código (`render.yaml`,
`vercel.json`, script `start`, CORS configurável, migration). As etapas abaixo exigem
login nas suas próprias contas — ninguém mais consegue fazer isso por você.

## 0. Antes de tudo: o fluxo de branch

**Atualização (ago/2026): o fluxo é `dev`/`main`.** `dev` é onde o trabalho e teste
acontece; `main` é a branch de produção — Render e Vercel observam essa branch, só
recebe merge quando algo em `dev` está validado e pronto pra ir ao ar. A branch
`production` foi criada num momento anterior mas nunca chegou a ser usada de
verdade — fica parada, sem uso, pode ser removida quando quiser.

```bash
# trabalha e testa normalmente na dev
git checkout dev
# ...commits normais...

# quando validar que está pronto pra ir ao ar:
git checkout main
git merge dev
git push origin main
git checkout dev
```

Só um push em `main` dispara deploy (Vercel/Render já observam essa branch — passo 2
e 3 abaixo). `dev` fica livre pra testar sem risco de subir coisa quebrada.

## 1. Supabase (banco de dados)

1. Cria conta em [supabase.com](https://supabase.com) (dá pra usar login do GitHub).
2. "New Project" — escolhe uma senha forte pro banco (anota, vai precisar).
3. Espera o projeto provisionar (~2 min).
4. Vai em **Project Settings → Database → Connection string** → escolhe a aba
   **"Session pooler"** (não "Direct connection" — desde 2024 ela só resolve em
   IPv6, e o Render não tem saída IPv6, dá erro P1001 "Can't reach database
   server"; e não "Transaction pooler"/porta 6543 também, que às vezes conflita
   com o jeito que o Prisma prepara consulta). O host muda de
   `db.<projeto>.supabase.co` pra `aws-0-<região>.pooler.supabase.com`, porta
   5432, usuário no formato `postgres.<projeto>` — copia a URI completa dali,
   essa é sua `DATABASE_URL` de produção. Troca `[YOUR-PASSWORD]` pela senha do
   passo 2 — se a senha tiver caractere especial (`@`, `#`, `%` etc), precisa
   codificar em formato de URL primeiro (ex: `@` vira `%40`), senão o Postgres
   confunde com separador da string de conexão.
5. (Opcional, mas recomendado): vai em **Project Settings → Database** e ativa
   backup automático se o plano permitir.
6. Se for usar Supabase Storage pras imagens (recomendado em produção, em vez de
   `STORAGE_DRIVER=local`, que perde arquivo a cada deploy no Render): **Storage →
   New bucket** → chama de `card-images`, marca como público. Depois em **Project
   Settings → API**, copia `Project URL` (=`SUPABASE_URL`) e a chave `service_role`
   (=`SUPABASE_SERVICE_ROLE_KEY` — essa é secreta, nunca vai no front-end).

Guarda esses 4 valores: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
a senha do banco.

## 2. Render (API)

1. Cria conta em [render.com](https://render.com) com login do GitHub (assim ele já
   pede autorização pra ler seus repositórios).
2. **New → Web Service** → escolhe o repositório `portal-gundam-tcg-br`.
3. Na tela de configuração:
   - **Branch**: `main` (é a branch de produção — trabalho/teste acontece em `dev`,
     só sobe quando você faz merge pra `main`).
   - **Root Directory**: deixa vazio (raiz do repo).
   - **Runtime**: Node.
   - **Build Command**: `pnpm install --frozen-lockfile && pnpm run prisma:generate`
   - **Start Command**: `pnpm run start`
   - **Instance Type**: Free.
4. Em **Environment**, adiciona as variáveis (valores conforme seu ambiente real):
   - `DATABASE_URL` → a do Supabase (passo 1.4)
   - `JWT_SECRET` → gera uma string aleatória longa (ex: `openssl rand -hex 32` no
     terminal, ou qualquer gerador de senha forte)
   - `API_PORT` → `8787`
   - `ALLOWED_ORIGINS` → o domínio que o Vercel vai te dar no passo 3 (ex:
     `https://portal-gundam-tcg-br.vercel.app`) — pode deixar em branco por enquanto
     e voltar aqui depois de ter o domínio do Vercel
   - `STORAGE_DRIVER` → `supabase` (se configurou o bucket no passo 1.6) ou `local`
     se quiser adiar isso
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` → se for
     usar storage do Supabase
   - `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` → pro primeiro admin
   - `GOOGLE_CLIENT_ID` → vem do passo 4, pode deixar em branco por enquanto
5. **Create Web Service**. O primeiro deploy roda `prisma migrate deploy`
   automaticamente (via `pnpm run start`) — cria todas as tabelas do zero no banco
   Supabase vazio.
6. Depois do deploy, roda o bootstrap do catálogo **uma vez** — Render tem um
   "Shell" no painel do serviço (aba **Shell**), abre e roda:
   ```bash
   pnpm run catalog:bootstrap
   ```
7. Anota a URL que o Render deu ao serviço (ex:
   `https://portal-gundam-tcg-br-api.onrender.com`) — é a sua API em produção.

## 3. Vercel (front-end)

1. Cria conta em [vercel.com](https://vercel.com) com login do GitHub.
2. **Add New → Project** → importa `portal-gundam-tcg-br`.
3. Ele deve detectar Vite automaticamente (o `vercel.json` já deixa isso explícito
   mesmo assim). Confirma:
   - **Build Command**: `pnpm run build`
   - **Output Directory**: `dist`
4. Em **Environment Variables**:
   - `VITE_API_BASE_URL` → `https://SEU-SERVICO.onrender.com/api` (a URL do passo 2.7)
   - `VITE_APP_ENV` → `production`
   - `VITE_GOOGLE_CLIENT_ID` → vem do passo 4, pode deixar em branco por enquanto
5. Em **Settings → Git**, confirma que a **Production Branch** está configurada como
   `main` (é essa que já está no ar — trabalho/teste fica em `dev`).
6. **Deploy**. Anota o domínio que o Vercel deu (ex:
   `https://portal-gundam-tcg-br.vercel.app`).
7. **Volta no Render** (passo 2.4) e preenche `ALLOWED_ORIGINS` com esse domínio —
   sem isso a API recusa as chamadas do front por CORS. Salva, o Render reinicia
   sozinho.

## 4. Login com Google (opcional, mas você pediu)

1. Vai em [console.cloud.google.com](https://console.cloud.google.com) — pode usar
   qualquer conta Google sua.
2. Cria um projeto novo (ou usa um existente).
3. **APIs & Services → OAuth consent screen**:
   - User type: **External**.
   - Preenche nome do app ("Portal Gundam TCG BR"), e-mail de suporte, logo se
     quiser.
   - Escopos: deixa o padrão (email, profile, openid) — não precisa pedir escopo
     extra.
   - Em "Test users" (enquanto o app estiver em modo teste), adiciona os e-mails dos
     seus colegas jogadores que vão testar — sem isso o Google bloqueia login de
     quem não está na lista, até você publicar o app de verdade.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: adiciona os dois domínios —
     `https://portal-gundam-tcg-br.vercel.app` (produção) e
     `http://localhost:5173` (seu ambiente local, se quiser testar aí também).
   - Não precisa preencher "Authorized redirect URIs" — o fluxo usado (Google
     Identity Services / One Tap) não redireciona, só devolve um token pro
     JavaScript da página.
5. Copia o **Client ID** gerado (formato `123456-abc...apps.googleusercontent.com`).
6. Preenche esse valor em **dois lugares**:
   - Render: variável `GOOGLE_CLIENT_ID`
   - Vercel: variável `VITE_GOOGLE_CLIENT_ID`
7. Redeploy dos dois (Render reinicia sozinho quando muda variável; no Vercel, um
   "Redeploy" manual no painel já resolve, já que variável de front-end só entra no
   build).

Depois disso, o botão "Continuar com Google" aparece sozinho na tela de login — o
código já verifica se a variável existe antes de mostrar o botão.

## 5. Checklist pós-deploy

- [ ] `https://SEU-SERVICO.onrender.com/api/health` responde `{"ok": true, ...}`
- [ ] `https://portal-gundam-tcg-br.vercel.app` carrega a Home
- [ ] Login por e-mail/senha funciona (usa o admin criado em `SEED_ADMIN_EMAIL`)
- [ ] `/database` mostra cartas (confirma que o `catalog:bootstrap` rodou)
- [ ] Login com Google aparece e funciona (se configurado)
- [ ] Criar um deck e salvar funciona ponta a ponta

## Sobre o plano gratuito (limitações a saber)

- **Render free**: o serviço "dorme" depois de ~15 min sem uso — a próxima requisição
  demora ~1 min pra acordar. Pros seus colegas testando, isso aparece como "primeira
  carregada lenta". Aceitável pra fase de teste; se incomodar, o plano pago começa em
  torno de US$7/mês e remove isso.
- **Supabase free**: o banco pausa depois de 7 dias **sem nenhuma query** (não é
  sobre visita ao site, é sobre uso real do banco). Os dados não somem, só demora
  ~30s pra acordar na primeira query depois da pausa. Testando semanalmente com
  colegas, isso não deve incomodar.
- Nenhum dos dois pede cartão de crédito no plano grátis.

## Quando (e pra onde) migrar pago depois

Se o projeto crescer (mais jogadores, precisa de uptime sem "acordar", ou o banco
passar de 500MB): a ordem natural de upgrade é primeiro o Render (US$7/mês tira o
"dormir"), depois o Supabase (US$25/mês tira a pausa e aumenta o limite) — nessa
ordem porque o "dormir" do Render é o que mais aparece pro usuário final. Domínio
próprio (tipo `portalgundambr.com.br`) fica independente disso, registra quando
quiser via Registro.br (domínio `.br`) ou Cloudflare/Namecheap (genérico), e aponta
o DNS pro Vercel — não precisa trocar nada de arquitetura pra isso.

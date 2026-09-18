# Guia de Arquitetura & Migração para Hostinger VPS (v2.0)

> **Documento de Infraestrutura e DevOps**  
> Data: 2026-09-16 | Arquiteto: Willen & Antigravity  
> Status: Planejamento & Pronto para Transição  
> Referências: [docs/54-plano-mestre-evolucao-sistema-e-zero-system.md](54-plano-mestre-evolucao-sistema-e-zero-system.md), [docs/12-backup-restaurar-banco.md](12-backup-restaurar-banco.md), [docker-compose.yml](../docker-compose.yml)

---

## 1. Visão Geral da Migração

Atualmente, o projeto opera de forma distribuída:
- **Frontend**: Vercel (Single Page Application Vite/React).
- **Backend**: Render (Web Service Node.js Express + Socket.io).
- **Banco de Dados**: Supabase (PostgreSQL 16).

A transição para a **Hostinger VPS (Virtual Private Server com Linux Ubuntu 22.04/24.04 LTS)** unifica a infraestrutura em um ambiente dedicado de alta performance, eliminando cold-starts de instâncias gratuitas, garantindo controle total de rede para WebSockets do Simulador e reduzindo custos operacionais.

```
                               ┌────────────────────────────────────────────────────────┐
                               │                    INTERNET / PLAYERS                  │
                               └──────────────────────────┬─────────────────────────────┘
                                                          │ HTTPS / WSS (Porta 443)
                                                          ▼
                               ┌────────────────────────────────────────────────────────┐
                               │                   HOSTINGER VPS (Linux)                │
                               │                                                        │
                               │   ┌────────────────────────────────────────────────┐   │
                               │   │               NGINX REVERSE PROXY              │   │
                               │   │          Certbot SSL (Let's Encrypt)           │   │
                               │   └──────────────┬──────────────────┬──────────────┘   │
                               │                  │                  │                  │
                               │  /api/*, /socket.io/*            Static Assets (/)     │
                               │                  ▼                  ▼                  │
                               │   ┌──────────────────────┐  ┌──────────────────────┐   │
                               │   │  BACKEND (Node/PM2)  │  │  FRONTEND (dist/)    │   │
                               │   │  Express + Socket.io │  │  React 19 SPA Build  │   │
                               │   │  Porta local 3001    │  │  Cache de Borda      │   │
                               │   └──────────┬───────────┘  └──────────────────────┘   │
                               │              │                                         │
                               │              ▼                                         │
                               │   ┌────────────────────────────────────────────────┐   │
                               │   │          POSTGRESQL 16 (Docker / Nativo)       │   │
                               │   │          Volume Persistente + Backup Diário    │   │
                               │   └────────────────────────────────────────────────┘   │
                               └────────────────────────────────────────────────────────┘
```

---

## 2. Estratégia de Migração do Banco de Dados (Supabase → VPS)

Para migrar sem perda de dados (contas de usuários, decks criados, torneios e logs do simulador):

### Passo 1: Exportação do Banco Atual (Supabase)
Execute o dump no terminal local com acesso à `DATABASE_URL` do Supabase:
```bash
# Dump completo em formato custom compactado
pg_dump "postgres://postgres.[ref]:[senha]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file=backups/supabase-migracao-vps.dump
```

### Passo 2: Provisionamento do PostgreSQL na VPS
Utilizando o `docker-compose.yml` já existente no repositório:
```yaml
# docker-compose.prod.yml na VPS
services:
  postgres:
    image: postgres:16-alpine
    container_name: gundam-postgres-prod
    restart: always
    environment:
      POSTGRES_DB: gundam_portal
      POSTGRES_USER: gundam_admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "127.0.0.1:5432:5432" # Blindado contra acessos externos
    volumes:
      - /var/lib/gundam-db:/var/lib/postgresql/data
```

### Passo 3: Restauração na VPS
Transfira o arquivo `.dump` para a VPS via `scp` e execute a restauração:
```bash
# Na VPS:
docker exec -i gundam-postgres-prod pg_restore \
  -U gundam_admin \
  -d gundam_portal \
  --clean \
  --if-exists \
  < supabase-migracao-vps.dump

# Executar migrations pendentes do Prisma:
pnpm prisma migrate deploy
```

---

## 3. Configuração do Servidor Web (Nginx + WebSockets)

O Nginx na VPS é configurado para suportar tráfego HTTP/2 e **WebSockets bidirecionais contínuos** para a Arena Asticassia:

```nginx
# /etc/nginx/sites-available/portal-gundam.conf
server {
    server_name portal-gundam.com.br www.portal-gundam.com.br;

    # 1. Frontend SPA (Arquivos estáticos compilados pelo Vite)
    location / {
        root /var/www/portal-gundam/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
        expires 1d;
        add_header Cache-Control "public, no-transform";
    }

    # 2. Cache longo para imagens de cartas e assets
    location /assets/ {
        root /var/www/portal-gundam/dist;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 3. API REST do Backend
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 4. WebSockets do Simulador (Socket.io)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s; # Impede queda por inatividade em partidas longas
        proxy_send_timeout 86400s;
    }
}
```

---

## 4. Gerenciamento de Processos com PM2

Na VPS, o Node.js roda sob controle do **PM2**, garantindo reinicialização automática em caso de falha ou reboot da máquina:

```javascript
// ecosystem.config.cjs na raiz do projeto
module.exports = {
  apps: [
    {
      name: "gundam-backend",
      script: "node_modules/.bin/tsx",
      args: "server/index.ts",
      env: {
        NODE_ENV: "production",
        PORT: 3001
      },
      max_memory_restart: "1G",
      instances: 1, // 1 instância para manter o matchStore em memória consistente
      autorestart: true
    }
  ]
};
```

Comandos operacionais:
```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

---

## 5. Rotina de Backup Automatizado (Cron Diário)

Configuração de backup noturno no crontab da VPS (`crontab -e`):
```bash
0 4 * * * /var/www/portal-gundam/scripts/cron-backup.sh
```
O script gera o dump com carimbo de data/hora, mantém os últimos 30 dias locais e sincroniza para armazenamento remoto seguro (Google Drive / S3).

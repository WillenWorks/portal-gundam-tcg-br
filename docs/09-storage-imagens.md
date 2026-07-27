# Storage de imagens — local e deploy

Esta versão prepara o cadastro de múltiplas artes por carta para dois cenários:

1. **Local** — imagens salvas em disco em `public/uploads`
2. **Online** — imagens salvas em Supabase Storage, mantendo URLs públicas e persistentes

## Como funciona

O admin continua usando a rota:

```txt
POST /api/cards/upload-image
```

Essa rota recebe:

- `image`: arquivo da imagem
- `cardCode`: código da carta, usado na organização do caminho
- `artId`: ID local da arte no modal
- `label`: rótulo da arte

O backend escolhe onde salvar conforme `STORAGE_DRIVER`.

## Modo local

No `.env`:

```env
STORAGE_DRIVER="local"
LOCAL_UPLOAD_DIR="public/uploads"
PUBLIC_APP_URL="http://localhost:8787"
MAX_IMAGE_UPLOAD_MB="8"
```

As imagens ficam em caminhos como:

```txt
public/uploads/cards/2026/07/gd01-001/art-abc12345.webp
```

E são servidas em:

```txt
/uploads/cards/2026/07/gd01-001/art-abc12345.webp
```

Esse modo é ótimo para desenvolvimento e testes locais.

## Modo Supabase Storage

No deploy, use:

```env
STORAGE_DRIVER="supabase"
SUPABASE_URL="https://SEU-PROJETO.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="sua-service-role-key"
SUPABASE_STORAGE_BUCKET="card-images"
SUPABASE_STORAGE_PUBLIC_BASE_URL=""
MAX_IMAGE_UPLOAD_MB="8"
```

O bucket `card-images` deve existir no Supabase Storage.

Para uso simples, deixe o bucket público. Assim as cartas podem usar URLs como:

```txt
https://SEU-PROJETO.supabase.co/storage/v1/object/public/card-images/cards/2026/07/gd01-001/art-xxxx.webp
```

> Importante: `SUPABASE_SERVICE_ROLE_KEY` deve ficar **somente no backend**. Nunca exponha essa chave no frontend.

## Persistência na carta

A arte marcada como principal sincroniza automaticamente com os campos legados:

- `imageUrl`
- `thumbUrl`
- `imageSourceUrl`

Todas as artes ficam em:

```json
metadataJson.artVariants
```

Formato salvo:

```json
[
  {
    "id": "art-abc123",
    "label": "Alt Art",
    "url": "https://.../image.webp",
    "thumbUrl": "",
    "sourceUrl": "supabase:cards/2026/07/gd01-001/art-abc123.webp",
    "rarity": "LR+",
    "isPrimary": true,
    "position": 0
  }
]
```

## Teste recomendado

1. Rode a API e frontend:

```bash
pnpm dev:full
```

2. Entre como admin
3. Abra uma carta
4. Na biblioteca de artes:
   - adicione duas artes
   - faça upload local em cada uma
   - marque uma como principal
   - salve a carta
5. Reabra a carta e confirme:
   - as duas artes continuam listadas
   - a arte principal manteve a estrela
   - a tabela usa a arte principal como preview

## Observação para deploy

Não use `STORAGE_DRIVER=local` em ambientes efêmeros como Vercel/Render/Fly sem volume persistente. Para deploy real, prefira `supabase` ou outro storage persistente/CDN.

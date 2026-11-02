ALTER TABLE "Post" ADD COLUMN "homeImage" TEXT;
ALTER TABLE "Post" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "Post_tags_idx" ON "Post" USING GIN ("tags");

-- O único artigo publicado até aqui: o selo "Simulador" gravado na arte vira hashtag, e a capa passa a ser a arte sem selos.
UPDATE "Post"
SET "tags" = ARRAY['simulador', 'gd06'],
    "coverImage" = '/images/articles/simulador-beta-gd06-capa.jpg',
    "homeImage" = '/images/articles/simulador-beta-gd06-capa.jpg'
WHERE "slug" = 'simulador-beta-gd06-stardust-trails-veda';

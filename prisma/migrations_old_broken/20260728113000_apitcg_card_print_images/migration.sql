-- Preserva reprints/promos com o mesmo número de carta e armazena os três tamanhos fornecidos pela API TCG.
ALTER TABLE "Card"
  ADD COLUMN "externalId" TEXT,
  ADD COLUMN "imageSmallUrl" TEXT,
  ADD COLUMN "imageMediumUrl" TEXT,
  ADD COLUMN "imageLargeUrl" TEXT;

DROP INDEX IF EXISTS "Card_code_key";

CREATE UNIQUE INDEX "Card_externalId_key" ON "Card"("externalId");
CREATE INDEX "Card_code_idx" ON "Card"("code");
CREATE INDEX "Card_setId_code_idx" ON "Card"("setId", "code");

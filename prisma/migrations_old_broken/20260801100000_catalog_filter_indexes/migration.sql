-- Catálogo administrativo: filtros, ordenação e busca textual.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Card_isActive_code_idx" ON "Card" ("isActive", "code");
CREATE INDEX IF NOT EXISTS "Card_isActive_updatedAt_code_idx" ON "Card" ("isActive", "updatedAt", "code");
CREATE INDEX IF NOT EXISTS "Card_isActive_nameEn_code_idx" ON "Card" ("isActive", "nameEn", "code");
CREATE INDEX IF NOT EXISTS "Card_isActive_cardType_color_idx" ON "Card" ("isActive", "cardType", "color");
CREATE INDEX IF NOT EXISTS "Card_isActive_setId_idx" ON "Card" ("isActive", "setId");
CREATE INDEX IF NOT EXISTS "Card_isActive_rarity_code_idx" ON "Card" ("isActive", "rarity", "code");
CREATE INDEX IF NOT EXISTS "Card_isActive_legalityStatus_idx" ON "Card" ("isActive", "legalityStatus");
CREATE INDEX IF NOT EXISTS "Card_isActive_ap_code_idx" ON "Card" ("isActive", "ap", "code");
CREATE INDEX IF NOT EXISTS "Card_isActive_hp_code_idx" ON "Card" ("isActive", "hp", "code");
CREATE INDEX IF NOT EXISTS "Card_isActive_cost_code_idx" ON "Card" ("isActive", "cost", "code");
CREATE INDEX IF NOT EXISTS "Card_isActive_level_code_idx" ON "Card" ("isActive", "level", "code");

-- Busca livre usa contains/ILIKE em múltiplos campos; GIN trigram acelera esses termos.
CREATE INDEX IF NOT EXISTS "Card_nameEn_trgm_idx" ON "Card" USING GIN ("nameEn" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Card_namePt_trgm_idx" ON "Card" USING GIN ("namePt" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Card_code_trgm_idx" ON "Card" USING GIN ("code" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Card_sourceTitle_trgm_idx" ON "Card" USING GIN ("sourceTitle" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Card_series_trgm_idx" ON "Card" USING GIN ("series" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Card_trait_trgm_idx" ON "Card" USING GIN ("trait" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Card_linkText_trgm_idx" ON "Card" USING GIN ("linkText" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Card_pilotName_trgm_idx" ON "Card" USING GIN ("pilotName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Card_traits_gin_idx" ON "Card" USING GIN ("traits");
CREATE INDEX IF NOT EXISTS "Card_keywordTags_gin_idx" ON "Card" USING GIN ("keywordTags");

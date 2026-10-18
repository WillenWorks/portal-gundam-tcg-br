-- Admin: gestão sólida de Traits/Séries. Séries (kind=SOURCE_TITLE) ganham campos
-- próprios de capa e link oficial no admin, mesmo padrão já usado em CardSet
-- (coverImage como coluna dedicada, galeria extra dentro de metadataJson.galleryImages).
-- Não afeta kind=TRAIT, que continua usando só name/description.

ALTER TABLE "TaxonomyEntry" ADD COLUMN "coverImage" TEXT;
ALTER TABLE "TaxonomyEntry" ADD COLUMN "officialUrl" TEXT;

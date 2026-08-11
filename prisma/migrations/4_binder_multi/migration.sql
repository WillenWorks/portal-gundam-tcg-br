-- Multiplos binders por usuario (antes so podia ter 1 WISHLIST + 1 OWNED) --
-- E indice unico (CREATE UNIQUE INDEX), nao constraint formal -- DROP CONSTRAINT
-- nao reconhece isso, precisa ser DROP INDEX.
DROP INDEX IF EXISTS "CardBinder_userId_kind_key";
ALTER TABLE "CardBinderItem" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- Pastas de Coleção Públicas (PublicBinderPage) -- tag opcional "Para Troca" / "Desejo"
-- por item de binder, editável pelo dono e exibida na vitrine pública.

-- CreateEnum
CREATE TYPE "BinderItemTag" AS ENUM ('FOR_TRADE', 'WISHLIST');

-- AlterTable
ALTER TABLE "CardBinderItem" ADD COLUMN "tag" "BinderItemTag";

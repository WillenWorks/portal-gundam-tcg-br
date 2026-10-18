-- Remove o conceito de "tipo" de binder (desejos/possuidas) -- vira organizacao
-- livre do usuario, so nome e conteudo, sem categoria imposta pelo sistema.
ALTER TABLE "CardBinder" DROP COLUMN "kind";
DROP TYPE "BinderKind";

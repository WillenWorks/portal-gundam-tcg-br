-- post do Instagram para artigo publicado
ALTER TYPE "SocialPostType" ADD VALUE 'ARTICLE';

-- deck novo nasce público (o dono muda para privado na criação ou na edição)
ALTER TABLE "Deck" ALTER COLUMN "visibility" SET DEFAULT 'PUBLIC';

-- Idioma da interface escolhido no perfil, no topo do site ou no simulador ("pt-BR" | "en")
ALTER TABLE "User" ADD COLUMN "preferredSiteLanguage" TEXT NOT NULL DEFAULT 'pt-BR';

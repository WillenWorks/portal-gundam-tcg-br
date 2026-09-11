-- Classificação tática de evento (abas da Central de Eventos, ver
-- PLANO_METAGAME_TORNEIOS_TELEMETRIA.md §2.1) + partes de VOD do YouTube.
-- Aplica tanto a Tournament (report retroativo) quanto a HostedEvent (ao vivo).

-- CreateEnum
CREATE TYPE "TournamentTier" AS ENUM ('LARGE_OFFICIAL', 'SMALL_OFFICIAL', 'UNOFFICIAL', 'RANKED', 'TEAM');

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN "tier" "TournamentTier" NOT NULL DEFAULT 'SMALL_OFFICIAL';
ALTER TABLE "Tournament" ADD COLUMN "vodUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "HostedEvent" ADD COLUMN "tier" "TournamentTier" NOT NULL DEFAULT 'UNOFFICIAL';
ALTER TABLE "HostedEvent" ADD COLUMN "vodUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

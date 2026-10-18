-- Fase A do plano "reorganização do admin + hoster": flag para um usuário
-- organizar eventos ao vivo (diferente do Tournament, que é report retroativo
-- feito pelo admin), e o esqueleto do evento em si (dono, local/data/formato/
-- limite de jogadores, status). Participantes, trava de deck e rodadas/pontuação
-- entram em migrations futuras.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "isHoster" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "HostedEventStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "HostedEvent" (
    "id" TEXT NOT NULL,
    "hosterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "format" TEXT NOT NULL DEFAULT 'constructed',
    "venueName" TEXT,
    "city" TEXT,
    "country" TEXT,
    "dateStart" TIMESTAMP(3) NOT NULL,
    "dateEnd" TIMESTAMP(3),
    "maxPlayers" INTEGER,
    "status" "HostedEventStatus" NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HostedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HostedEvent_hosterId_idx" ON "HostedEvent"("hosterId");

-- CreateIndex
CREATE INDEX "HostedEvent_status_idx" ON "HostedEvent"("status");

-- CreateIndex
CREATE INDEX "HostedEvent_dateStart_idx" ON "HostedEvent"("dateStart");

-- AddForeignKey
ALTER TABLE "HostedEvent" ADD CONSTRAINT "HostedEvent_hosterId_fkey" FOREIGN KEY ("hosterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

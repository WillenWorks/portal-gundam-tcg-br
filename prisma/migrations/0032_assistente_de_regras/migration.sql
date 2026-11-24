-- Assistente de regras pt-BR: perguntas feitas (cota diária por conta, cache e fila de curadoria).
-- CreateTable
CREATE TABLE "RulesQuestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "answer" TEXT,
    "sourceIds" TEXT[],
    "citedIds" TEXT[],
    "notFound" BOOLEAN NOT NULL DEFAULT false,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "latencyMs" INTEGER,
    "feedback" INTEGER,
    "feedbackNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RulesQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RulesQuestion_userId_createdAt_idx" ON "RulesQuestion"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RulesQuestion_notFound_createdAt_idx" ON "RulesQuestion"("notFound", "createdAt");

-- CreateIndex
CREATE INDEX "RulesQuestion_createdAt_idx" ON "RulesQuestion"("createdAt");

-- AddForeignKey
ALTER TABLE "RulesQuestion" ADD CONSTRAINT "RulesQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


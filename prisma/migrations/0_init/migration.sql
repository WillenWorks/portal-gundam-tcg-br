-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'EDITOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('NEWS', 'PREVIEW', 'REVIEW', 'GUIDE');

-- CreateEnum
CREATE TYPE "DeckVisibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "RuleSourceType" AS ENUM ('OFFICIAL_FAQ', 'OFFICIAL_RULES', 'COMMUNITY_EXPLAINER');

-- CreateEnum
CREATE TYPE "CardLanguage" AS ENUM ('PT_BR', 'EN');

-- CreateEnum
CREATE TYPE "BinderKind" AS ENUM ('WISHLIST', 'OWNED');

-- CreateEnum
CREATE TYPE "SetKind" AS ENUM ('BOOSTER_PACK', 'STARTER_DECK', 'ACCESSORIES', 'PREMIUM_BANDAI', 'OTHER');

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('UNIT', 'PILOT', 'COMMAND', 'COMMAND_PILOT', 'BASE', 'RESOURCE', 'EX_BASE', 'EX_RESOURCE', 'UNIT_TOKEN');

-- CreateEnum
CREATE TYPE "TaxonomyKind" AS ENUM ('TRAIT', 'SOURCE_TITLE');

-- CreateEnum
CREATE TYPE "CardRelationType" AS ENUM ('PILOT_OF', 'SUPPORTS', 'UPGRADE_OF', 'SAME_ARCHETYPE', 'STORY_RELATED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "preferredCardLanguage" "CardLanguage" NOT NULL DEFAULT 'PT_BR',
    "bio" TEXT,
    "avatarUrl" TEXT,
    "preferredTheme" TEXT DEFAULT 'dark',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardSet" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "namePt" TEXT,
    "releaseDate" TIMESTAMP(3),
    "officialUrl" TEXT,
    "coverImage" TEXT,
    "shortDescription" TEXT,
    "setType" "SetKind" NOT NULL DEFAULT 'BOOSTER_PACK',
    "productCodeAlt" TEXT,
    "msrpUsd" DOUBLE PRECISION,
    "contentSummaryEn" TEXT,
    "contentSummaryPt" TEXT,
    "raritySummary" TEXT,
    "productNotes" TEXT,
    "sourceTitles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "starterDeckVariantOf" TEXT,
    "metadataJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CardSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxonomyEntry" (
    "id" TEXT NOT NULL,
    "kind" "TaxonomyKind" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "metadataJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaxonomyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardModel" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "namePt" TEXT,
    "cardType" "CardType" NOT NULL,
    "cardSubtypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "color" TEXT,
    "level" INTEGER,
    "cost" INTEGER,
    "ap" INTEGER,
    "hp" INTEGER,
    "trait" TEXT,
    "traits" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "series" TEXT,
    "sourceTitle" TEXT,
    "zone" TEXT,
    "linkText" TEXT,
    "pilotName" TEXT,
    "effectEn" TEXT,
    "effectPt" TEXT,
    "triggerKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "keywordTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "effectKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "textSectionsJson" JSONB,
    "hasBurst" BOOLEAN NOT NULL DEFAULT false,
    "hasMain" BOOLEAN NOT NULL DEFAULT false,
    "hasAction" BOOLEAN NOT NULL DEFAULT false,
    "oncePerTurn" BOOLEAN NOT NULL DEFAULT false,
    "legalityStatus" TEXT DEFAULT 'legal',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CardModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "cardModelId" TEXT,
    "externalId" TEXT,
    "nameEn" TEXT NOT NULL,
    "namePt" TEXT,
    "cardType" "CardType" NOT NULL,
    "cardSubtypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "color" TEXT,
    "level" INTEGER,
    "cost" INTEGER,
    "ap" INTEGER,
    "hp" INTEGER,
    "rarity" TEXT,
    "isPrimaryPrint" BOOLEAN NOT NULL DEFAULT false,
    "printLabel" TEXT,
    "trait" TEXT,
    "traits" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "series" TEXT,
    "sourceTitle" TEXT,
    "zone" TEXT,
    "linkText" TEXT,
    "pilotName" TEXT,
    "effectEn" TEXT,
    "effectPt" TEXT,
    "triggerKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "keywordTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "effectKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "textSectionsJson" JSONB,
    "hasBurst" BOOLEAN NOT NULL DEFAULT false,
    "hasMain" BOOLEAN NOT NULL DEFAULT false,
    "hasAction" BOOLEAN NOT NULL DEFAULT false,
    "oncePerTurn" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT,
    "thumbUrl" TEXT,
    "imageSmallUrl" TEXT,
    "imageMediumUrl" TEXT,
    "imageLargeUrl" TEXT,
    "imageSourceUrl" TEXT,
    "officialUrl" TEXT,
    "metadataJson" JSONB,
    "legalityStatus" TEXT DEFAULT 'legal',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "setId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardRelation" (
    "id" TEXT NOT NULL,
    "sourceModelId" TEXT NOT NULL,
    "targetModelId" TEXT NOT NULL,
    "relationType" "CardRelationType" NOT NULL,
    "notePt" TEXT,
    "sourceUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CardRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'constructed',
    "visibility" "DeckVisibility" NOT NULL DEFAULT 'PRIVATE',
    "notes" TEXT,
    "coverImage" TEXT,
    "shareId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "featuredCardIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Deck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckItem" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "section" TEXT NOT NULL DEFAULT 'main',
    CONSTRAINT "DeckItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardBinder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "BinderKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "shareId" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CardBinder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardBinderItem" (
    "id" TEXT NOT NULL,
    "binderId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    CONSTRAINT "CardBinderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ruling" (
    "id" TEXT NOT NULL,
    "sourceType" "RuleSourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "questionEn" TEXT,
    "answerEn" TEXT,
    "questionPt" TEXT,
    "answerPt" TEXT,
    "examplePlayPt" TEXT,
    "originalUrl" TEXT,
    "relatedKeyword" TEXT,
    "relatedPhase" TEXT,
    "officialUpdatedAt" TIMESTAMP(3),
    "translationStatus" TEXT DEFAULT 'pending',
    "cardId" TEXT,
    "cardModelId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Ruling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizer" TEXT,
    "country" TEXT,
    "city" TEXT,
    "format" TEXT NOT NULL DEFAULT 'constructed',
    "season" TEXT,
    "sourceUrl" TEXT,
    "participantCount" INTEGER,
    "roundCount" INTEGER,
    "topCutSize" INTEGER,
    "dateStart" TIMESTAMP(3),
    "dateEnd" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentEntry" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "placement" INTEGER,
    "wins" INTEGER,
    "losses" INTEGER,
    "draws" INTEGER,
    "archetype" TEXT,
    "deckId" TEXT,
    CONSTRAINT "TournamentEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "contentMd" TEXT NOT NULL,
    "coverImage" TEXT,
    "galleryJson" JSONB,
    "youtubeUrl" TEXT,
    "postType" "PostType" NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "CardSet_code_key" ON "CardSet"("code");
CREATE UNIQUE INDEX "TaxonomyEntry_kind_name_key" ON "TaxonomyEntry"("kind", "name");
CREATE UNIQUE INDEX "TaxonomyEntry_kind_slug_key" ON "TaxonomyEntry"("kind", "slug");
CREATE UNIQUE INDEX "CardModel_code_key" ON "CardModel"("code");
CREATE INDEX "CardModel_isActive_code_idx" ON "CardModel"("isActive", "code");
CREATE UNIQUE INDEX "Card_externalId_key" ON "Card"("externalId");
CREATE INDEX "Card_code_idx" ON "Card"("code");
CREATE INDEX "Card_cardModelId_idx" ON "Card"("cardModelId");
CREATE INDEX "Card_setId_code_idx" ON "Card"("setId", "code");
CREATE INDEX "Card_isActive_code_idx" ON "Card"("isActive", "code");
CREATE INDEX "Card_isActive_updatedAt_code_idx" ON "Card"("isActive", "updatedAt", "code");
CREATE INDEX "Card_isActive_nameEn_code_idx" ON "Card"("isActive", "nameEn", "code");
CREATE INDEX "Card_isActive_cardType_color_idx" ON "Card"("isActive", "cardType", "color");
CREATE INDEX "Card_isActive_setId_idx" ON "Card"("isActive", "setId");
CREATE INDEX "Card_isActive_rarity_code_idx" ON "Card"("isActive", "rarity", "code");
CREATE INDEX "Card_isActive_legalityStatus_idx" ON "Card"("isActive", "legalityStatus");
CREATE INDEX "Card_isActive_ap_code_idx" ON "Card"("isActive", "ap", "code");
CREATE INDEX "Card_isActive_hp_code_idx" ON "Card"("isActive", "hp", "code");
CREATE INDEX "Card_isActive_cost_code_idx" ON "Card"("isActive", "cost", "code");
CREATE INDEX "Card_isActive_level_code_idx" ON "Card"("isActive", "level", "code");
CREATE UNIQUE INDEX "CardRelation_sourceModelId_targetModelId_relationType_key" ON "CardRelation"("sourceModelId", "targetModelId", "relationType");
CREATE INDEX "CardRelation_sourceModelId_isActive_idx" ON "CardRelation"("sourceModelId", "isActive");
CREATE INDEX "CardRelation_targetModelId_isActive_idx" ON "CardRelation"("targetModelId", "isActive");
CREATE UNIQUE INDEX "Deck_shareId_key" ON "Deck"("shareId");
CREATE UNIQUE INDEX "DeckItem_deckId_cardId_section_key" ON "DeckItem"("deckId", "cardId", "section");
CREATE UNIQUE INDEX "CardBinder_shareId_key" ON "CardBinder"("shareId");
CREATE UNIQUE INDEX "CardBinder_userId_kind_key" ON "CardBinder"("userId", "kind");
CREATE UNIQUE INDEX "CardBinderItem_binderId_cardId_key" ON "CardBinderItem"("binderId", "cardId");
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_cardModelId_fkey" FOREIGN KEY ("cardModelId") REFERENCES "CardModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Card" ADD CONSTRAINT "Card_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CardRelation" ADD CONSTRAINT "CardRelation_sourceModelId_fkey" FOREIGN KEY ("sourceModelId") REFERENCES "CardModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardRelation" ADD CONSTRAINT "CardRelation_targetModelId_fkey" FOREIGN KEY ("targetModelId") REFERENCES "CardModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeckItem" ADD CONSTRAINT "DeckItem_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeckItem" ADD CONSTRAINT "DeckItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardBinder" ADD CONSTRAINT "CardBinder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardBinderItem" ADD CONSTRAINT "CardBinderItem_binderId_fkey" FOREIGN KEY ("binderId") REFERENCES "CardBinder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardBinderItem" ADD CONSTRAINT "CardBinderItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ruling" ADD CONSTRAINT "Ruling_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ruling" ADD CONSTRAINT "Ruling_cardModelId_fkey" FOREIGN KEY ("cardModelId") REFERENCES "CardModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TournamentEntry" ADD CONSTRAINT "TournamentEntry_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentEntry" ADD CONSTRAINT "TournamentEntry_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

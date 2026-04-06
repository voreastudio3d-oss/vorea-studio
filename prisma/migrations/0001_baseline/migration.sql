-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MembershipTier" AS ENUM ('FREE', 'PRO', 'STUDIO_PRO');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin', 'superadmin');

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('Draft', 'Published', 'Archived');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "tier" "MembershipTier" NOT NULL DEFAULT 'FREE',
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "avatarUrl" TEXT,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "models" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scadSource" TEXT,
    "status" "ModelStatus" NOT NULL DEFAULT 'Draft',
    "params" JSONB NOT NULL DEFAULT '{}',
    "wireframe" BOOLEAN NOT NULL DEFAULT false,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "thumbnailUrl" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gcode_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gcode" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gcode_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_credits" (
    "userId" TEXT NOT NULL,
    "freeUsed" INTEGER NOT NULL DEFAULT 0,
    "purchasedCredits" INTEGER NOT NULL DEFAULT 0,
    "totalExported" INTEGER NOT NULL DEFAULT 0,
    "lastExportAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_credits_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'bug',
    "message" TEXT NOT NULL,
    "screenshot" TEXT,
    "stateSnapshot" TEXT,
    "userEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "aiReview" JSONB,
    "aiReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_plans" (
    "id" TEXT NOT NULL,
    "tier" "MembershipTier" NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yearlyPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "features" JSONB NOT NULL DEFAULT '[]',
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paypal_orders" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "capturedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paypal_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paypal_subscriptions" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "tier" "MembershipTier" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVAL_PENDING',
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paypal_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "alerts" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kv_store" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kv_store_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "api_key_vault" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "label" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_key_vault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_sources" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "baseUrl" TEXT NOT NULL,
    "feedUrl" TEXT,
    "listingUrl" TEXT,
    "fetchMode" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_articles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "titleOriginal" TEXT NOT NULL,
    "titleDisplayEs" TEXT NOT NULL,
    "summaryEs" TEXT NOT NULL,
    "detailEs" TEXT NOT NULL,
    "titleDisplayEn" TEXT,
    "summaryEn" TEXT,
    "detailEn" TEXT,
    "sourceExcerpt" TEXT,
    "imageUrl" TEXT,
    "author" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceLanguage" TEXT,
    "publishedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "dedupeHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_ingestion_runs" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "insertedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "news_ingestion_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_studio_recipes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "familyHint" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "parameterOverrides" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_studio_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_studio_families" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "nameEs" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "descriptionEs" TEXT,
    "descriptionEn" TEXT,
    "imageUrl" TEXT,
    "scadTemplate" TEXT NOT NULL,
    "parameters" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'active',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_studio_families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_studio_presets" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "labelEs" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "promptEs" TEXT NOT NULL,
    "promptEn" TEXT NOT NULL,
    "imageUrl" TEXT,
    "overrideValues" JSONB NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_studio_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_generation_traces" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "promptRawEncrypted" JSONB,
    "promptNormalized" TEXT NOT NULL,
    "attemptHistory" JSONB,
    "intent" TEXT NOT NULL,
    "riskFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "familySlugRequested" TEXT NOT NULL,
    "familySlugResolved" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "lane" TEXT NOT NULL,
    "manualMode" BOOLEAN NOT NULL DEFAULT false,
    "creditCost" INTEGER NOT NULL DEFAULT 0,
    "estimatedUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "failureCode" TEXT,
    "routingReason" TEXT,
    "selfHealed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_generation_traces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_generation_daily_aggregates" (
    "id" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "totalSuccess" INTEGER NOT NULL DEFAULT 0,
    "totalFailures" INTEGER NOT NULL DEFAULT 0,
    "totalCredits" INTEGER NOT NULL DEFAULT 0,
    "totalEstimatedUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_generation_daily_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regional_storage_daily_aggregates" (
    "id" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "regionCode" TEXT NOT NULL,
    "aiStorageBytes" BIGINT NOT NULL DEFAULT 0,
    "aiImageBytes" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regional_storage_daily_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telemetry_events" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "trigger" TEXT NOT NULL,
    "page" TEXT NOT NULL DEFAULT 'relief',
    "surfaceMode" TEXT,
    "subdivisions" INTEGER,
    "maxHeight" DOUBLE PRECISION,
    "smoothing" INTEGER,
    "colorZones" INTEGER,
    "invert" BOOLEAN,
    "solid" BOOLEAN,
    "baseThickness" DOUBLE PRECISION,
    "plateWidth" DOUBLE PRECISION,
    "plateDepth" DOUBLE PRECISION,
    "cylinderRadius" DOUBLE PRECISION,
    "cylinderHeight" DOUBLE PRECISION,
    "polygonSides" INTEGER,
    "polygonRadius" DOUBLE PRECISION,
    "imageFormat" TEXT,
    "imageScale" DOUBLE PRECISION,
    "imageScaleMode" TEXT,
    "exportFormat" TEXT,
    "threeMfColorMode" TEXT,
    "meshScore" TEXT,
    "meshFaces" INTEGER,
    "meshVertices" INTEGER,
    "boundaryEdges" INTEGER,
    "nonManifoldEdges" INTEGER,
    "meshVolume" DOUBLE PRECISION,
    "snapshotId" TEXT,
    "errorMessage" TEXT,
    "extraParams" JSONB DEFAULT '{}',
    "generationTimeMs" INTEGER,
    "exportTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telemetry_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "models_userId_idx" ON "models"("userId");

-- CreateIndex
CREATE INDEX "gcode_items_userId_idx" ON "gcode_items"("userId");

-- CreateIndex
CREATE INDEX "feedback_userId_idx" ON "feedback"("userId");

-- CreateIndex
CREATE INDEX "feedback_status_idx" ON "feedback"("status");

-- CreateIndex
CREATE UNIQUE INDEX "membership_plans_tier_key" ON "membership_plans"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "paypal_orders_orderId_key" ON "paypal_orders"("orderId");

-- CreateIndex
CREATE INDEX "paypal_orders_userId_idx" ON "paypal_orders"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "paypal_subscriptions_subscriptionId_key" ON "paypal_subscriptions"("subscriptionId");

-- CreateIndex
CREATE INDEX "paypal_subscriptions_userId_idx" ON "paypal_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "paypal_subscriptions_subscriptionId_idx" ON "paypal_subscriptions"("subscriptionId");

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- CreateIndex
CREATE INDEX "api_key_vault_userId_idx" ON "api_key_vault"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "api_key_vault_userId_provider_key" ON "api_key_vault"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "news_sources_slug_key" ON "news_sources"("slug");

-- CreateIndex
CREATE INDEX "news_sources_enabled_priority_idx" ON "news_sources"("enabled", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "news_articles_slug_key" ON "news_articles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "news_articles_dedupeHash_key" ON "news_articles"("dedupeHash");

-- CreateIndex
CREATE INDEX "news_articles_status_publishedAt_idx" ON "news_articles"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "news_articles_expiresAt_idx" ON "news_articles"("expiresAt");

-- CreateIndex
CREATE INDEX "news_articles_sourceId_publishedAt_idx" ON "news_articles"("sourceId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "news_articles_sourceId_canonicalUrl_key" ON "news_articles"("sourceId", "canonicalUrl");

-- CreateIndex
CREATE INDEX "news_ingestion_runs_startedAt_idx" ON "news_ingestion_runs"("startedAt");

-- CreateIndex
CREATE INDEX "news_ingestion_runs_sourceId_startedAt_idx" ON "news_ingestion_runs"("sourceId", "startedAt");

-- CreateIndex
CREATE INDEX "ai_studio_recipes_userId_idx" ON "ai_studio_recipes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_studio_families_slug_key" ON "ai_studio_families"("slug");

-- CreateIndex
CREATE INDEX "ai_studio_families_status_engine_idx" ON "ai_studio_families"("status", "engine");

-- CreateIndex
CREATE UNIQUE INDEX "ai_studio_presets_slug_key" ON "ai_studio_presets"("slug");

-- CreateIndex
CREATE INDEX "ai_studio_presets_familyId_idx" ON "ai_studio_presets"("familyId");

-- CreateIndex
CREATE INDEX "ai_generation_traces_userId_createdAt_idx" ON "ai_generation_traces"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_generation_traces_provider_model_createdAt_idx" ON "ai_generation_traces"("provider", "model", "createdAt");

-- CreateIndex
CREATE INDEX "ai_generation_traces_status_createdAt_idx" ON "ai_generation_traces"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ai_generation_daily_aggregates_day_provider_idx" ON "ai_generation_daily_aggregates"("day", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "ai_generation_daily_aggregates_day_provider_model_tier_qual_key" ON "ai_generation_daily_aggregates"("day", "provider", "model", "tier", "quality");

-- CreateIndex
CREATE INDEX "regional_storage_daily_aggregates_day_regionCode_idx" ON "regional_storage_daily_aggregates"("day", "regionCode");

-- CreateIndex
CREATE UNIQUE INDEX "regional_storage_daily_aggregates_day_regionCode_key" ON "regional_storage_daily_aggregates"("day", "regionCode");

-- CreateIndex
CREATE INDEX "telemetry_events_trigger_createdAt_idx" ON "telemetry_events"("trigger", "createdAt");

-- CreateIndex
CREATE INDEX "telemetry_events_surfaceMode_createdAt_idx" ON "telemetry_events"("surfaceMode", "createdAt");

-- CreateIndex
CREATE INDEX "telemetry_events_userId_createdAt_idx" ON "telemetry_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "telemetry_events_meshScore_createdAt_idx" ON "telemetry_events"("meshScore", "createdAt");

-- AddForeignKey
ALTER TABLE "models" ADD CONSTRAINT "models_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gcode_items" ADD CONSTRAINT "gcode_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_credits" ADD CONSTRAINT "export_credits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paypal_orders" ADD CONSTRAINT "paypal_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key_vault" ADD CONSTRAINT "api_key_vault_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "news_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_ingestion_runs" ADD CONSTRAINT "news_ingestion_runs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "news_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_studio_recipes" ADD CONSTRAINT "ai_studio_recipes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_studio_presets" ADD CONSTRAINT "ai_studio_presets_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ai_studio_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generation_traces" ADD CONSTRAINT "ai_generation_traces_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry_events" ADD CONSTRAINT "telemetry_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


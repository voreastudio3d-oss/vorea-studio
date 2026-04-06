/**
 * Prisma Seed Script — Vorea Studio
 *
 * Populates the local PostgreSQL database with development data
 * matching the mock data currently hardcoded in storage.ts.
 *
 * Run: npx prisma db seed
 * Safe to re-run: uses upsert for idempotency.
 */

import dotenv from "dotenv";
dotenv.config();

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import {
  COMMUNITY_MODELS,
  getCommunitySeedUsers,
} from "../src/app/data/community-data.ts";
import { seedDefaultNewsSources } from "../server/news-service.js";
import * as auth from "../server/auth.js";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://vorea:vorea_dev@localhost:5432/vorea_studio?schema=public";

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding Vorea Studio database...\n");

  // ─── 1. Default User Sync ─────────────────────────────────────────────
  
  let defaultAuth = await auth.getUserByEmail("alex@vorea.studio");
  if (!defaultAuth) {
    defaultAuth = await auth.createUser("alex@vorea.studio", "d3d05B3", {
      displayName: "Alex Maker",
      username: "@alex_maker",
      tier: "STUDIO_PRO",
      role: "user"
    });
  }

  const defaultUser = await prisma.user.upsert({
    where: { email: "alex@vorea.studio" },
    update: {},
    create: {
      id: defaultAuth.id,
      email: "alex@vorea.studio",
      displayName: "Alex Maker",
      username: "@alex_maker",
      tier: "STUDIO_PRO",
      role: "user",
    },
  });
  console.log(`  ✓ User: ${defaultUser.displayName} (${defaultUser.email})`);

  // ─── 2. Owner / Super Admin ───────────────────────────────────────
  let ownerAuth = await auth.getUserByEmail("vorea.studio3d@gmail.com");
  if (!ownerAuth) {
    ownerAuth = await auth.createUser("vorea.studio3d@gmail.com", "d3d05B3", {
      displayName: "Vorea Admin",
      username: "@vorea_admin",
      tier: "STUDIO_PRO",
      role: "superadmin"
    });
  }

  const ownerUser = await prisma.user.upsert({
    where: { email: "vorea.studio3d@gmail.com" },
    update: {},
    create: {
      id: ownerAuth.id,
      email: "vorea.studio3d@gmail.com",
      displayName: "Vorea Admin",
      username: "@vorea_admin",
      tier: "STUDIO_PRO",
      role: "superadmin",
    },
  });
  console.log(`  ✓ User: ${ownerUser.displayName} (${ownerUser.role})`);

  // ─── 2.5 QA Smoke Admin Account ────────────────────────────────────
  let qaAuth = await auth.getUserByEmail("qa.admin@vorea.studio");
  if (!qaAuth) {
    qaAuth = await auth.createUser("qa.admin@vorea.studio", "qa_admin_d3d05B3!", {
      displayName: "QA Smoke Admin",
      username: "@qa_admin_smoke",
      tier: "STUDIO_PRO",
      role: "superadmin"
    });
  }

  const qaUser = await prisma.user.upsert({
    where: { email: "qa.admin@vorea.studio" },
    update: {},
    create: {
      id: qaAuth.id,
      email: "qa.admin@vorea.studio",
      displayName: "QA Smoke Admin",
      username: "@qa_admin_smoke",
      tier: "STUDIO_PRO",
      role: "superadmin",
    },
  });
  console.log(`  ✓ QA User: ${qaUser.displayName} (${qaUser.role})`);

  // ─── 3. Seed Models ──────────────────────────────────────────────
  const model1 = await prisma.model.upsert({
    where: { id: "m_seed_1" },
    update: {},
    create: {
      id: "m_seed_1",
      userId: defaultUser.id,
      title: "Customizable Bracket v3",
      status: "Published",
      params: { radius: 10, height: 20, resolution: 32 },
      wireframe: false,
      likes: 120,
      downloads: 450,
      thumbnailUrl:
        "https://images.unsplash.com/photo-1565789398675-a61b310b7711?w=800&q=80",
      createdAt: new Date("2025-06-10"),
      updatedAt: new Date("2025-09-22"),
    },
  });

  const model2 = await prisma.model.upsert({
    where: { id: "m_seed_2" },
    update: {},
    create: {
      id: "m_seed_2",
      userId: defaultUser.id,
      title: "Voronoi Phone Stand",
      status: "Draft",
      params: { radius: 8, height: 35, resolution: 64 },
      wireframe: false,
      likes: 45,
      downloads: 112,
      thumbnailUrl:
        "https://images.unsplash.com/photo-1644224076179-31d622e21511?w=800&q=80",
      createdAt: new Date("2025-11-01"),
      updatedAt: new Date("2025-12-05"),
    },
  });
  console.log(`  ✓ Models: ${model1.title}, ${model2.title}`);

  // ─── 4. Membership Plans ──────────────────────────────────────────
  const plans = [
    {
      tier: "FREE" as const,
      name: "Free",
      monthlyPrice: 0,
      yearlyPrice: 0,
      features: [
        "Basic 3D preview",
        "6 GCode exports",
        "Community models",
      ],
      highlighted: false,
    },
    {
      tier: "PRO" as const,
      name: "Pro",
      monthlyPrice: 9.99,
      yearlyPrice: 99.99,
      features: [
        "Unlimited GCode exports",
        "Priority rendering",
        "Custom materials",
        "STL download",
      ],
      highlighted: true,
    },
    {
      tier: "STUDIO_PRO" as const,
      name: "Studio Pro",
      monthlyPrice: 24.99,
      yearlyPrice: 249.99,
      features: [
        "Everything in Pro",
        "API access",
        "Team workspaces",
        "White-label exports",
        "Priority support",
      ],
      highlighted: false,
    },
  ];

  for (const plan of plans) {
    await prisma.membershipPlan.upsert({
      where: { tier: plan.tier },
      update: {},
      create: plan,
    });
  }
  console.log(`  ✓ Membership plans: ${plans.map((p) => p.name).join(", ")}`);

  // ─── 5. Default Export Credits ────────────────────────────────────
  await prisma.exportCredits.upsert({
    where: { userId: defaultUser.id },
    update: {},
    create: {
      userId: defaultUser.id,
      freeUsed: 0,
      purchasedCredits: 0,
      totalExported: 0,
    },
  });
  console.log(`  ✓ Export credits initialized for ${defaultUser.displayName}`);

  // ─── 6. Admin Config Singleton ────────────────────────────────────
  await prisma.adminConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      alerts: {},
      settings: {
        maintenanceMode: false,
        maxUploadSizeMb: 50,
        defaultResolution: 32,
      },
    },
  });
  console.log(`  ✓ Admin config singleton`);

  // ─── 7. Credit Packs (as activity log for reference) ──────────────
  await prisma.activityLog.upsert({
    where: { id: "seed_credit_packs" },
    update: {},
    create: {
      id: "seed_credit_packs",
      action: "CREDIT_PACKS_DEFINED",
      details: {
        packs: [
          { id: "pack_10", name: "10 Exportaciones", credits: 10, price: 2.99 },
          { id: "pack_30", name: "30 Exportaciones", credits: 30, price: 6.99, popular: true },
          { id: "pack_100", name: "100 Exportaciones", credits: 100, price: 17.99 },
        ],
      },
    },
  });
  console.log(`  ✓ Credit packs reference logged`);

  // ─── 8. Community Users + Models (shared source of truth) ────────
  const communityUsers = new Map(
    getCommunitySeedUsers("vorea.community").map((u) => [u.id, u])
  );

  for (const model of COMMUNITY_MODELS) {
    const userSeed = communityUsers.get(model.authorId);
    if (!userSeed) {
      throw new Error(`Missing seed user for authorId=${model.authorId}`);
    }

    const user = await prisma.user.upsert({
      where: { id: userSeed.id },
      update: {},
      create: {
        id: userSeed.id,
        email: userSeed.email,
        displayName: userSeed.displayName,
        username: userSeed.username,
        tier: "FREE",
        role: "user",
      },
    });

    await prisma.model.upsert({
      where: { id: model.id },
      update: {},
      create: {
        id: model.id,
        userId: user.id,
        title: model.title,
        scadSource: model.scadSource || "",
        status: model.status === "draft" ? "Draft" : "Published",
        likes: model.likes,
        downloads: model.downloads,
        thumbnailUrl: model.thumbnailUrl,
        tags: model.tags,
        featured: model.featured,
        params: {
          communityMeta: {
            isCommunity: true,
            authorName: model.authorName,
            authorUsername: model.authorUsername,
            authorAvatarUrl: model.authorAvatarUrl ?? null,
            modelType: model.modelType,
            media: model.media,
            reliefConfig: model.reliefConfig ?? null,
            commentCount: 0,
          },
        },
        createdAt: new Date(model.createdAt),
        updatedAt: new Date(model.updatedAt),
      },
    });
    console.log(`  ✓ Community: ${userSeed.displayName} → ${model.title}`);
  }

  // ─── 8.5. Seed AiStudioRecipes for Trends ────────────────────────
  const RECIPE_IDEAS = [
    { name: "Caja Apilable Universal", familyHint: "hex_box", prompt: "Caja hexagonal de 15cm con tapa a presión, paredes de 2mm" },
    { name: "Soporte Movil", familyHint: "phone_stand", prompt: "Soporte para celular inclinación 45 grados, estilo minimalista" },
    { name: "Organizador de Cables", familyHint: "cable_clip", prompt: "Clip para organizar 5 cables USB grosor mediano" },
    { name: "Jarrón Voronoi", familyHint: "vase_voronoi", prompt: "Jarrón alto paramétrico estilo Voronoi, 20cm, cuello estrecho" },
    { name: "Engranaje Helicoidal", familyHint: "gear", prompt: "Engranaje helicoidal de 12 dientes, radio 30mm, eje en D" },
    { name: "Maceta Geométrica", familyHint: "planter", prompt: "Macetero poligonal con agujeros de drenaje, base 10cm" },
    { name: "Soporte Auriculares", familyHint: "headphone_stand", prompt: "Soporte de mesa para auriculares overhead ancho" },
    { name: "Llavero Personal", familyHint: "keychain", prompt: "Llavero base plana con texto grueso superior" }
  ];

  for (let i = 0; i < 25; i++) {
    const idea = RECIPE_IDEAS[Math.floor(Math.random() * RECIPE_IDEAS.length)];
    const assignedUser = Math.random() > 0.5 ? defaultUser : ownerUser;
    
    await prisma.aiStudioRecipe.upsert({
      where: { id: `seed_recipe_${i}` },
      update: {},
      create: {
        id: `seed_recipe_${i}`,
        userId: assignedUser.id,
        name: idea.name + (i > 7 ? ` (Var ${i})` : ""),
        prompt: idea.prompt,
        engine: "fdm",
        quality: "draft",
        familyHint: idea.familyHint,
        parameterOverrides: {
          width: Math.floor(Math.random() * 50) + 10,
          height: Math.floor(Math.random() * 80) + 20,
        }
      }
    });
  }
  console.log(`  ✓ 25 AI Studio Recipes seeded for trend analysis`);

  // ─── 9. News Sources ────────────────────────────────────────
  await seedDefaultNewsSources();
  console.log(`  ✓ News sources seeded`);

  console.log("\n🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

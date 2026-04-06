import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import * as crypto from "node:crypto";
import * as auth from "../server/auth.js"; // Uses auth_users

const connectionString = process.env.DATABASE_URL || "postgresql://vorea:vorea_dev@localhost:5432/vorea_studio?schema=public";
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TEST_USERS = [
  { email: "vorea.studio3d@gmail.com", role: "superadmin", tier: "STUDIO PRO", pass: "d3d05B3" },
  { email: "admin@voreastudio.com", role: "superadmin", tier: "STUDIO PRO", pass: "d3d05B3" },
  { email: "pro_maker@test.com", role: "user", tier: "PRO", pass: "d3d05B3" },
  { email: "free_user1@test.com", role: "user", tier: "FREE", pass: "d3d05B3" },
  { email: "free_user2@test.com", role: "user", tier: "FREE", pass: "d3d05B3" },
  { email: "studio_artist@test.com", role: "user", tier: "STUDIO PRO", pass: "d3d05B3" }
];

const RECIPE_IDEAS = [
  { name: "Caja Hexagonal Apilable", family: "hex_box", prompt: "Caja hexagonal de 15cm con tapa a presión." },
  { name: "Soporte Movil Ergonomico", family: "phone_stand", prompt: "Soporte de celular inclinación 45 grados." },
  { name: "Organizador de Cables", family: "cable_clip", prompt: "Clip para 5 cables USB grosor mediano." },
  { name: "Jarrón Voronoi", family: "vase_voronoi", prompt: "Jarrón alto paramétrico estilo Voronoi, 20cm." },
  { name: "Engranaje 12 Dientes", family: "gear", prompt: "Engranaje de 12 dientes, radio 30mm, eje D." }
];

async function seed() {
  console.log("🌱 Starting Seed...");

  for (const tu of TEST_USERS) {
    // 1. Sync to Auth (auth_users - Login valid)
    let authUser = await auth.getUserByEmail(tu.email);
    if (!authUser) {
      authUser = await auth.createUser(tu.email, tu.pass, {
        role: tu.role,
        tier: tu.tier,
        displayName: tu.email.split('@')[0],
      });
      console.log(`✅ Auth User created: ${tu.email}`);
    } else {
      console.log(`ℹ️ Auth User exists: ${tu.email}`);
    }

    // 2. Sync to Prisma Public Users (Linked Relations)
    let pUser = await prisma.user.findUnique({ where: { email: tu.email } });
    if (!pUser) {
      pUser = await prisma.user.create({
        data: {
          id: authUser.id, // Ensure IDs match for relation integrity
          email: tu.email,
          displayName: authUser.display_name,
          username: authUser.username,
          tier: tu.tier.replace(" ", "_") as any,
          role: authUser.role === "superadmin" ? "superadmin" : "user",
        }
      });
      console.log(`✅ Prisma User mapped: ${tu.email}`);
    }

    // 3. Generate 3-5 AiStudioRecipes per user
    const recipesCount = await prisma.aiStudioRecipe.count({ where: { userId: pUser.id } });
    if (recipesCount === 0) {
      const numRecipes = Math.floor(Math.random() * 3) + 3; // 3 to 5
      for (let i = 0; i < numRecipes; i++) {
        const idea = RECIPE_IDEAS[Math.floor(Math.random() * RECIPE_IDEAS.length)];
        const generatedCode = `
// Simulated user generated SCAD for deeper analysis
module custom_${idea.family}() {
  $fn = ${Math.floor(Math.random() * 50) + 30};
  difference() {
    cube([${Math.floor(Math.random() * 100)}, 50, 20], center=true);
    cylinder(h=30, r=5, center=true);
  }
}
custom_${idea.family}();
`;
        await prisma.aiStudioRecipe.create({
          data: {
            userId: pUser.id,
            name: `${idea.name} v${Math.floor(Math.random() * 5) + 1}`,
            prompt: idea.prompt,
            familyHint: idea.family,
            engine: "fdm",
            quality: "draft",
            parameterOverrides: { width: Math.random() * 100, depth: 50, _simulatedScad: generatedCode },
          }
        });
      }
      console.log(`✅ AiStudioRecipes injected for: ${tu.email}`);
    }
  }

  console.log("🌲 Seed completed successfully!");
}

seed()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

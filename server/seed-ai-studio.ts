import { PrismaClient } from "@prisma/client";
import { generateScadFromSpec } from "../src/app/engine/generators/index";
import { buildParameterBlueprint } from "../src/app/engine/spec-builder";
import { PARAMETRIC_FAMILIES, InstructionSpecV1, ParametricFamily } from "../src/app/engine/instruction-spec";
import * as dotenv from "dotenv";

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting AI Studio seed...");

  const allFamilies: ParametricFamily[] = [
    ...(PARAMETRIC_FAMILIES.fdm as unknown as ParametricFamily[]),
    ...(PARAMETRIC_FAMILIES.organic as unknown as ParametricFamily[])
  ];

  let orderPriority = 1000;

  for (const family of allFamilies) {
    const engine = PARAMETRIC_FAMILIES.fdm.includes(family as any) ? "fdm" : "organic";
    
    // Generate raw SCAD using default fallback properties
    const dummySpec: InstructionSpecV1 = {
      version: "1.0",
      prompt: "Seed prompt",
      engine,
      family,
      intent: "Seed",
      qualityProfile: "draft",
      printProfile: "fdm",
      tags: [],
      constraints: {},
      parameters: [],
      warnings: []
    };

    const result = generateScadFromSpec(dummySpec);
    let { scad, modelName } = result;

    // Build the parameters JSON config
    const blueprint = buildParameterBlueprint(engine, family, "draft");
    const paramDict: Record<string, any> = {};
    blueprint.forEach(p => {
      paramDict[p.name] = {
        type: p.type,
        default: p.defaultValue,
        min: p.min,
        max: p.max,
        step: p.step,
        description: p.description
      };
    });

    // We must strip out the global parameter assignments from the generated SCAD
    // Because the new dynamic runParametricPipeline will PREPEND these.
    // In OpenSCAD, the last assignment wins, so if they remain in the template, they will override user input.
    const varsToRemove = blueprint.map(p => p.name).concat(['quality_level', '\\$fn', 'layers', 'steps']);
    const regex = new RegExp(`^(${varsToRemove.join('|')})\\s*=.*$`, 'gm');

    let cleanScad = scad
      .replace(regex, '')
      .replace(/^\/\/.*$/gm, '') // remove comments
      .replace(/\n\s*\n/g, '\n\n') // normalize newlines
      .trim();

    // Map family to image (dummy images for now, or match based on name)
    const imageMap: Record<string, string> = {
      "drawer-organizer-tray": "https://images.unsplash.com/photo-1584820927498-cafe2c1c6e11?w=800&auto=format&fit=crop",
      "storage-box": "https://images.unsplash.com/photo-1622485541604-585aef970c67?w=800&auto=format&fit=crop",
      "planter-drip-system": "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800&auto=format&fit=crop",
    };
    const imageUrl = imageMap[family] || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop";

    // Upsert into database
    const familyData = {
      slug: family,
      engine: engine,
      nameEs: modelName,
      nameEn: modelName,
      descriptionEs: `${modelName} parametrico`,
      descriptionEn: `${modelName} parametric`,
      imageUrl: imageUrl,
      scadTemplate: cleanScad,
      parameters: paramDict,
      status: "active",
      priority: orderPriority
    };

    await prisma.aiStudioFamily.upsert({
      where: { slug: family },
      update: familyData,
      create: {
        id: family,
        ...familyData
      }
    });

    console.log(`✅ Seeded Family: ${family}`);
    orderPriority -= 10;
  }

  // Next, create some presets mapping to these families
  const seedPresets = [
    {
      slug: "preset-organizer-basic",
      familyId: "drawer-organizer-tray",
      labelEs: "Bandeja 3x2",
      labelEn: "Tray 3x2",
      promptEs: "Organizador rápido de tres divisiones.",
      promptEn: "Quick three division organizer.",
      overrideValues: { width: 150, depth: 100, cells_x: 3, cells_y: 2 },
      imageUrl: "https://images.unsplash.com/photo-1584820927498-cafe2c1c6e11?w=800&auto=format&fit=crop",
      priority: 10
    },
    {
      slug: "preset-planter-large",
      familyId: "planter-drip-system",
      labelEs: "Maceta Grande Drip",
      labelEn: "Large Drip Planter",
      promptEs: "Sistema de autoriego grande para interiores.",
      promptEn: "Large self-watering system for indoor.",
      overrideValues: { radius: 60, height: 120, water_level: 40 },
      imageUrl: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800&auto=format&fit=crop",
      priority: 20
    }
  ];

  for (const pr of seedPresets) {
    await prisma.aiStudioPreset.upsert({
      where: { slug: pr.slug },
      update: pr,
      create: pr
    });
    console.log(`✅ Seeded Preset: ${pr.slug}`);
  }

  console.log("Seed script finished successfully!");
}

main().catch(console.error).finally(() => prisma.$disconnect());

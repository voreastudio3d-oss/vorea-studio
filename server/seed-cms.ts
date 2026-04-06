import { PrismaClient } from "@prisma/client";
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

async function seedAiStudio() {
  console.log("Re-seeding AI Studio CMS data (Vorea Clean Seed)...");

  console.log("Upserting storage-box...");
  const boxFamily = await prisma.aiStudioFamily.upsert({
    where: { slug: 'storage-box' },
    update: {},
    create: {
      slug: 'storage-box',
      engine: 'fdm',
      nameEs: 'Caja Organizadora',
      nameEn: 'Storage Box',
      descriptionEs: 'Caja paramétrica modular abierta. Ideal para FDM.',
      descriptionEn: 'Parametric open modular box. Ideal for FDM.',
      imageUrl: "https://images.unsplash.com/photo-1622485541604-585aef970c67?w=800&auto=format&fit=crop",
      scadTemplate: `
module StorageBox() {
  difference() {
    translate([0,0, box_height/2]) cube([box_width, box_length, box_height], center=true);
    if (!solid_block) {
      translate([0,0, box_height/2 + wall_thickness]) 
        cube([box_width - wall_thickness*2, box_length - wall_thickness*2, box_height], center=true);
    }
  }
}
StorageBox();
`,
      parameters: [
        { name: "box_width", type: "number", min: 10, max: 200, defaultValue: 50, description: "Ancho de la caja" },
        { name: "box_length", type: "number", min: 10, max: 200, defaultValue: 50, description: "Largo de la caja" },
        { name: "box_height", type: "number", min: 5, max: 200, defaultValue: 40, description: "Alto de la caja" },
        { name: "wall_thickness", type: "number", min: 0.8, max: 5, step: 0.4, defaultValue: 1.2, description: "Grosor de pared" },
        { name: "solid_block", type: "bool", defaultValue: false, description: "Bloque sólido tapa" }
      ],
      priority: 100,
      status: 'active'
    }
  });

  await prisma.aiStudioPreset.upsert({
    where: { slug: 'storage-box-basic' },
    update: {},
    create: {
      familyId: boxFamily.id,
      slug: 'storage-box-basic',
      labelEs: 'Cajoncito Básico',
      labelEn: 'Basic Little Box',
      promptEs: 'Un cajoncito pequeño básico 30x30x20',
      promptEn: 'A basic small box',
      overrideValues: { box_width: 30, box_length: 30, box_height: 20 },
      priority: 10
    }
  });

  console.log("Upserting desk-planter...");
  const planterFamily = await prisma.aiStudioFamily.upsert({
    where: { slug: 'desk-planter' },
    update: {},
    create: {
      slug: 'desk-planter',
      engine: 'fdm',
      nameEs: 'Maceta Cilíndrica',
      nameEn: 'Cylindrical Planter',
      descriptionEs: 'Maceta cilíndrica con radio y altura editables',
      descriptionEn: 'Cylindrical planter with editable radius and height',
      imageUrl: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800&auto=format&fit=crop",
      scadTemplate: `
$fn = rounded_edges ? 60 : 30;

module Planter() {
  difference() {
    cylinder(h=height, r=radius, center=false);
    
    // Hueco interno
    translate([0,0, wall_thickness])
      cylinder(h=height, r=radius - wall_thickness, center=false);
      
    if (drainage_holes) {
      // agujeros de drenaje x4
      for (a = [0:90:270]) {
        rotate([0,0,a])
          translate([radius/2, 0, -1])
            cylinder(h=wall_thickness+2, r=2);
      }
    }
  }
}

Planter();
`,
      parameters: [
        { name: "height", type: "number", min: 20, max: 150, defaultValue: 60, description: "Altura" },
        { name: "radius", type: "number", min: 10, max: 100, defaultValue: 40, description: "Radio del vaso" },
        { name: "wall_thickness", type: "number", min: 1.2, max: 5, defaultValue: 2, description: "Grosor de Pared" },
        { name: "drainage_holes", type: "bool", defaultValue: true, description: "Perforar base" },
        { name: "rounded_edges", type: "bool", defaultValue: true, description: "Alta definición curva" }
      ],
      priority: 90,
      status: 'active'
    }
  });

  await prisma.aiStudioPreset.upsert({
    where: { slug: 'desk-planter-succulent' },
    update: {},
    create: {
      familyId: planterFamily.id,
      slug: 'desk-planter-succulent',
      labelEs: 'Para Suculentas (Baja)',
      labelEn: 'For Succulents (Low)',
      promptEs: 'Maceta chata ancha para suculentas',
      promptEn: 'Flat wide planter for succulents',
      overrideValues: { height: 30, radius: 55 },
      priority: 20
    }
  });

  console.log("Upserting text-sign...");
  const signFamily = await prisma.aiStudioFamily.upsert({
    where: { slug: 'text-sign' },
    update: {},
    create: {
      slug: 'text-sign',
      engine: 'fdm',
      nameEs: 'Letrero de Texto',
      nameEn: 'Text Sign',
      descriptionEs: 'Letrero 3D con texto en bajo relieve',
      descriptionEn: '3D Sign with extruded text',
      imageUrl: "https://images.unsplash.com/photo-1584820927498-cafe2c1c6e11?w=800&auto=format&fit=crop",
      scadTemplate: `
module TextSign() {
  difference() {
    // Base
    translate([0, 0, plate_thickness / 2])
      cube([sign_width, sign_height, plate_thickness], center=true);
    
    // Txt depth removal
    translate([0, 0, plate_thickness - text_depth + 0.1])
      linear_extrude(text_depth)
        text(sign_text, size=text_size, halign="center", valign="center", font=font_name);
  }
}
TextSign();
`,
      parameters: [
        { name: "sign_width", type: "number", min: 50, max: 300, defaultValue: 150, description: "Ancho placa" },
        { name: "sign_height", type: "number", min: 20, max: 200, defaultValue: 50, description: "Alto placa" },
        { name: "plate_thickness", type: "number", min: 1, max: 10, defaultValue: 3, description: "Grosor base" },
        { name: "text_depth", type: "number", min: 0.5, max: 5, defaultValue: 1, description: "Profundidad grabado" },
        { name: "text_size", type: "number", min: 5, max: 50, defaultValue: 20, description: "Tamaño letra" },
        { name: "sign_text", type: "text", defaultValue: "VOREA", description: "Texto a inscribir" },
        { name: "font_name", type: "text", defaultValue: "Liberation Sans:style=Bold", description: "Fuente" }
      ],
      priority: 80,
      status: 'active'
    }
  });

  await prisma.aiStudioPreset.upsert({
    where: { slug: 'text-sign-name' },
    update: {},
    create: {
      familyId: signFamily.id,
      slug: 'text-sign-name',
      labelEs: 'Cartel de Oficina',
      labelEn: 'Office Sign',
      promptEs: 'Un cartel con el texto STUDIO para la oficina',
      promptEn: 'A sign with text STUDIO',
      overrideValues: { sign_width: 200,  sign_height: 60, sign_text: "STUDIO", text_size: 30 },
      priority: 30
    }
  });


  console.log("Disconnecting...");
  await prisma.$disconnect();
  console.log("Seeding Done!");
}

seedAiStudio().catch(console.error);

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedAiStudio() {
  console.log("Re-seeding AI Studio CMS data...");

  // 1. Storage Box
  console.log("Upserting storage-box...");
  const boxFamily = await prisma.aiStudioFamily.upsert({
    where: { slug: 'storage-box' },
    update: {},
    create: {
      slug: 'storage-box',
      engine: 'fdm',
      nameEs: 'Caja Organizadora',
      nameEn: 'Storage Box',
      descriptionEs: 'Caja paramétrica con tapa opcional. Ideal para FDM.',
      descriptionEn: 'Parametric box with optional lid. Ideal for FDM.',
      scadTemplate: `
module StorageBox() {
  difference() {
    cube([box_width, box_length, box_height], center=true);
    if (!solid_block) {
      translate([0,0, wall_thickness]) 
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
        { name: "solid_block", type: "bool", defaultValue: false, description: "Bloque sólido (Tapa)" }
      ],
      priority: 100,
      status: 'active'
    }
  });

  // Basic presets for Storage Box
  await prisma.aiStudioPreset.upsert({
    where: { slug: 'storage-box-basic' },
    update: {},
    create: {
      familyId: boxFamily.id,
      slug: 'storage-box-basic',
      labelEs: 'Caja Cuadrada Pequeña',
      labelEn: 'Small Square Box',
      promptEs: 'Una caja cuadrada simple para guardar tornillos',
      promptEn: 'A simple square box for screws',
      overrideValues: { box_width: 30, box_length: 30, box_height: 20 },
      priority: 1
    }
  });

  // 2. Desk Planter
  console.log("Upserting desk-planter...");
  const planterFamily = await prisma.aiStudioFamily.upsert({
    where: { slug: 'desk-planter' },
    update: {},
    create: {
      slug: 'desk-planter',
      engine: 'fdm',
      nameEs: 'Maceta de Escritorio',
      nameEn: 'Desk Planter',
      descriptionEs: 'Maceta esférica cilíndrica minimalista',
      descriptionEn: 'Minimalist spherical/cylindrical planter',
      scadTemplate: `
$fn = rounded_edges ? 60 : 20;

module Planter() {
  difference() {
    cylinder(h=height, r1=base_radius, r2=top_radius, center=false);
    
    // Hueco interno
    translate([0,0, wall_thickness])
      cylinder(h=height, r1=base_radius - wall_thickness, r2=top_radius - wall_thickness, center=false);
      
    if (drainage_holes) {
      // agujeros de drenaje
      for (a = [0:90:270]) {
        rotate([0,0,a])
          translate([base_radius/2, 0, -1])
            cylinder(h=wall_thickness+2, r=2);
      }
    }
  }
}

Planter();
`,
      parameters: [
        { name: "height", type: "number", min: 20, max: 150, defaultValue: 60, description: "Altura" },
        { name: "base_radius", type: "number", min: 10, max: 100, defaultValue: 40, description: "Radio Inferior" },
        { name: "top_radius", type: "number", min: 10, max: 100, defaultValue: 50, description: "Radio Superior" },
        { name: "wall_thickness", type: "number", min: 1.2, max: 5, defaultValue: 2, description: "Grosor de Pared" },
        { name: "drainage_holes", type: "bool", defaultValue: true, description: "Con drenaje" },
        { name: "rounded_edges", type: "bool", defaultValue: true, description: "Alta definición (Suave)" }
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
      promptEs: 'Maceta chata para suculentas',
      promptEn: 'Flat planter for succulents',
      overrideValues: { height: 30, base_radius: 50, top_radius: 60 },
      priority: 2
    }
  });


  // 3. Text Sign
  console.log("Upserting text-sign...");
  const signFamily = await prisma.aiStudioFamily.upsert({
    where: { slug: 'text-sign' },
    update: {},
    create: {
      slug: 'text-sign',
      engine: 'fdm',
      nameEs: 'Letrero de Texto',
      nameEn: 'Text Sign',
      descriptionEs: 'Letrero 3D con texto en bajo/alto relieve',
      descriptionEn: '3D Sign with extruded text',
      scadTemplate: `
module TextSign() {
  union() {
    // Base
    translate([0, 0, plate_thickness / 2])
      cube([sign_width, sign_height, plate_thickness], center=true);
    
    // Txt
    translate([0, 0, plate_thickness + (text_depth/2)])
      linear_extrude(text_depth, center=true)
        text(sign_text, size=text_size, halign="center", valign="center", font=font_name);
  }
}
TextSign();
`,
      parameters: [
        { name: "sign_width", type: "number", min: 50, max: 300, defaultValue: 150, description: "Ancho base" },
        { name: "sign_height", type: "number", min: 20, max: 200, defaultValue: 50, description: "Alto base" },
        { name: "plate_thickness", type: "number", min: 1, max: 10, defaultValue: 2, description: "Grosor de placa" },
        { name: "text_depth", type: "number", min: 1, max: 20, defaultValue: 2, description: "Grosor texto" },
        { name: "text_size", type: "number", min: 5, max: 50, defaultValue: 20, description: "Tamaño fuente" },
        { name: "sign_text", type: "text", defaultValue: "Vorea", description: "Texto a inscribir" },
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
      labelEs: 'Cartel de Puerta',
      labelEn: 'Door Sign',
      promptEs: 'Un cartel chico con mi nombre para la puerta',
      promptEn: 'A small name sign for the door',
      overrideValues: { sign_width: 100,  sign_height: 40, sign_text: "Mi Cuarto", text_size: 15 },
      priority: 3
    }
  });


  console.log("Disconecting...");
  await prisma.$disconnect();
  console.log("Seeding Done!");
}

seedAiStudio().catch(console.error);

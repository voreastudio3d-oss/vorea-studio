import { parseArgs } from "util";

const args = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3001" },
  },
});

const API_URL = process.env.API_URL || args.values.url || "http://localhost:3001";
const ADMIN_EMAIL = "qa.admin@vorea.studio";
const ADMIN_PASSWORD = "qa_admin_d3d05B3!";
const NORMAL_EMAIL = "alex@vorea.studio";
const NORMAL_PASSWORD = "d3d05B3";

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to login as ${email}: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  if (!data.token) {
    throw new Error(`No token returned during login for ${email}`);
  }
  return data.token;
}

async function verifyAdminAccess(token: string): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(`${API_URL}/api/admin/kpi`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return { ok: res.ok, status: res.status };
}

async function runSmokeTests() {
  console.log(`\n🕵️‍♂️ Corriendo Smoke Test de Panel Administrador (Target: ${API_URL})\n`);
  
  let success = true;

  try {
    // 1. Acceso sin token
    console.log("Prueba 1: Acceso a endpoint protegido sin token auth...");
    const unauthTest = await fetch(`${API_URL}/api/admin/kpi`);
    if (unauthTest.status === 401 || unauthTest.status === 403) {
      console.log(`  ✅ Exitoso (Rechazado correctamente con ${unauthTest.status})`);
    } else {
      console.error(`  ❌ Falló: Se esperaba 401/403, obtuvo ${unauthTest.status}`);
      success = false;
    }

    // 2. Acceso como usuario normal
    console.log("\nPrueba 2: Acceso a endpoint de administrador con usuario NORMAL...");
    try {
      const normalToken = await login(NORMAL_EMAIL, NORMAL_PASSWORD);
      const normalTest = await verifyAdminAccess(normalToken);
      if (normalTest.status === 403) {
        console.log(`  ✅ Exitoso (Vedtado correctamente con 403)`);
      } else {
        console.error(`  ❌ Falló: Usuario normal recibió HTTP ${normalTest.status}`);
        success = false;
      }
    } catch (e: any) {
      console.error(`  ❌ Falló: Error en auth de usuario normal: ${e.message}`);
      success = false;
    }

    // 3. Acceso como admin de QA dedicado
    console.log("\nPrueba 3: Acceso a endpoint de administrador con cuenta QA (qa.admin@vorea.studio)...");
    try {
      const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
      const adminTest = await verifyAdminAccess(adminToken);
      if (adminTest.ok) {
        console.log(`  ✅ Exitoso (Acceso concedido con HTTP ${adminTest.status})`);
      } else {
        console.error(`  ❌ Falló: El admin fue rechazado con HTTP ${adminTest.status}`);
        success = false;
      }
    } catch (e: any) {
      console.error(`  ❌ Falló: Error en auth de usuario admin: ${e.message}`);
      success = false;
    }

  } catch (error) {
    console.error("❌ Error de ejecución en Smoke Tests:", error);
    success = false;
  }

  console.log("\n==================================");
  if (success) {
    console.log("🌟 RESULTADO: PASSED");
    process.exit(0);
  } else {
    console.log("💥 RESULTADO: FAILED");
    process.exit(1);
  }
}

runSmokeTests();

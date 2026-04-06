import "dotenv/config";
import * as kv from "../kv.js";
import { checkAIBudget } from "../app.js";

async function run() {
  console.log("=== Testing Circuit Breaker (Local Context) ===");

  // Respaldo de la configuración actual
  const original = await kv.get("admin:ai_budget");

  try {
    const testBudget = {
      globalMonthlyBudgetUsd: 5.0, // Presupuesto Global
      maxBudgetPercentOfRevenue: 100,
      circuitBreakerEnabled: true,
      perTierDailyLimits: { FREE: 1, PRO: 20, STUDIO_PRO: -1 },
      currentMonthSpentUsd: 0, // Aún no gastamos nada
      currentMonth: new Date().toISOString().slice(0, 7)
    };

    console.log("Configurando presupuesto restringido: 5 USD");
    await kv.set("admin:ai_budget", testBudget);

    // 1. Verificar si pasa inicialmente
    console.log("Verificando si permite operaciones...");
    let res = await checkAIBudget("FREE");
    if (!res.allowed) {
      throw new Error(`Falló prematuramente: ${res.reason}`);
    }
    console.log("Operacion permitida correctamente.");

    // 2. Facturar un exceso de presupuesto
    console.log("Simulando que ya gastamos 10 USD (por encima del límite)...");
    testBudget.currentMonthSpentUsd = 10.0;
    await kv.set("admin:ai_budget", testBudget);

    console.log("Verificando el Circuit Breaker...");
    res = await checkAIBudget("FREE");
    if (res.allowed) {
      throw new Error("❌ Error crítico: El Circuit Breaker no funcionó y permitió el gasto por encima del presupuesto global/revenue bound.");
    } else {
      console.log(`✅ ¡Éxito! Circuit Breaker detuvo la solicitud: "${res.reason}"`);
    }

  } finally {
    console.log("Restaurando configuración original...");
    if (original) {
      await kv.set("admin:ai_budget", original);
    } else {
      await kv.del("admin:ai_budget");
    }
  }
}

run().catch(e => {
  console.error("Test failed:", e.message);
  process.exit(1);
});

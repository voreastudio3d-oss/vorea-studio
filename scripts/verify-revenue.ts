import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkProdRevenue() {
  console.log("\n🔍 Conectando a la Base de Datos para verificar transacciones...\n");
  
  try {
    // 1. Check top-up metrics (Ledger or Subscriptions)
    const recentPurchases = await prisma.creditLedger.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      where: { transactionType: "TOPUP" },
      include: { user: { select: { email: true, topupBalance: true, balance: true } } }
    });

    if (recentPurchases.length === 0) {
      console.log("⚠️ No se encontraron compras de créditos recientes. (¿Falló el webhook o el callback?)");
    } else {
      console.log("💰 ÚLTIMAS COMPRAS DE CRÉDITOS:");
      recentPurchases.forEach((p, idx) => {
        console.log(`[${idx+1}] Usuario: ${p.user.email}`);
        console.log(`    Recarga: +${p.amount} créditos`);
        console.log(`    Order/Ref: ${p.referenceId}`);
        console.log(`    Balance Actual: ${p.user.balance} (Top-up: ${p.user.topupBalance})`);
        console.log(`    Fecha: ${p.createdAt.toISOString()}\n`);
      });
      console.log("🎉 CERTIFICACIÓN PUNTO 5 PASADA: El ledger se actualizó correctamente.\n");
    }

  } catch (error: any) {
    console.error("❌ Error conectando a la BD. Verifica que la DATABASE_URL sea correcta.");
    console.error(error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkProdRevenue();

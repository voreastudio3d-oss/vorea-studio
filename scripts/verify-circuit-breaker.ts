import "dotenv/config";

const DEFAULT_API_URL = "http://localhost:3001/api";

async function apiFetch<T>(baseUrl: string, pathname: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error || `${response.status} ${response.statusText}`);
  }
  return json as T;
}

async function apiFetchRaw(baseUrl: string, pathname: string, init: RequestInit = {}, token?: string): Promise<{ status: number; json: any }> {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
}

async function signin(baseUrl: string, email: string, password: string) {
  const json = await apiFetch<any>(baseUrl, "/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return {
    token: String(json.token || ""),
    userId: String(json.profile?.id || json.user?.id || ""),
  };
}

// Emulate testing logic for circuit-breaker
async function main() {
  const apiBase = process.env.MONETIZATION_SMOKE_API_URL || DEFAULT_API_URL;
  const adminEmail = process.env.MONETIZATION_SMOKE_ADMIN_EMAIL;
  const adminPassword = process.env.MONETIZATION_SMOKE_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error("Missing admin credentials! set MONETIZATION_SMOKE_ADMIN_EMAIL/PASSWORD");
  }

  console.log("Starting circuit-breaker validation...");
  const admin = await signin(apiBase, adminEmail, adminPassword);

  // 1. Get current config to reset later
  const { budget: originalBudget } = await apiFetch<any>(apiBase, "/admin/ai-budget", {}, admin.token);
  console.log("Loaded original budget config:", originalBudget.globalMonthlyBudgetUsd);

  // 2. We use maxBudgetPercentOfRevenue to strictly limit based on dummy revenue
  // We don't have direct access to "plans" from here without mocking, so we will use the global constraint:
  const testBudget = {
    ...originalBudget,
    globalMonthlyBudgetUsd: 1.0, // Hard restrict to $1.00 globally
    maxBudgetPercentOfRevenue: 100, // Still requires revenue!
    circuitBreakerEnabled: true,
    perTierDailyLimits: { FREE: 1, PRO: 20, STUDIO_PRO: -1 }
  };
  
  // Set test budget
  console.log("Setting test budget constraints: $1.0 global limit");
  await apiFetch<any>(apiBase, "/admin/ai-budget", {
    method: "PUT",
    body: JSON.stringify({ budget: testBudget }),
  }, admin.token);

  // 3. Check public budget status
  console.log("Checking /api/ai/budget-status...");
  const status1 = await apiFetch<any>(apiBase, "/api/ai/budget-status");
  console.log("Public status:", status1);
  if (status1.circuitBreakerTripped) {
    console.log("WARNING: Circuit Breaker was already tripped initially!");
  }

  // 4. Try spending past the budget!
  // Cost = $2.0, more than global cap
  console.log("Simulating AI action with cost = $2.0...");
  const trackResult = await apiFetchRaw(apiBase, "/api/ai/track-spend", {
    method: "POST",
    body: JSON.stringify({ costUsd: 2.0, actionId: "text_to_3d_complex" }),
  }, admin.token);
  
  // Wait, track-spend also validates tool allowance:
  if (trackResult.status === 403 || !trackResult.json.success) {
     console.log("Track spend rejected:", trackResult.json);
  } else {
     console.log("Track spend succeeded. Now spent:", trackResult.json.currentMonthSpentUsd);
  }

  // 5. Check public status again -> Should be tripped!!
  const status2 = await apiFetch<any>(apiBase, "/api/ai/budget-status");
  console.log("Public status AFTER spend:", status2);

  if (status2.circuitBreakerTripped && status2.budgetUtilization !== "0%") {
      console.log("✅ Circuit-breaker correctly tripped the limit!");
  } else {
      console.error("❌ Circuit-breaker failed to trip! Limits ignored?");
      process.exitCode = 1;
  }

  // Restore budget
  console.log("Restoring original budget...");
  await apiFetch<any>(apiBase, "/admin/ai-budget", {
    method: "PUT",
    body: JSON.stringify({ budget: originalBudget }),
  }, admin.token);
  
  console.log("Circuit Breaker certification complete.");
}

main().catch(err => {
  console.error("Script failed:", err.message);
  process.exit(1);
});

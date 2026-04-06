export interface CreditPackConfig {
  id: string;
  name: string;
  credits: number;
  price: number;
  pricePerCredit?: number;
  popular?: boolean;
}

const USD_EPSILON = 0.01;

export function normalizeUsdAmount(value: unknown): number | null {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Number(num.toFixed(2));
}

export function amountsMatchUsd(expected: number, actual: number): boolean {
  return Math.abs(expected - actual) < USD_EPSILON;
}

function normalizePack(raw: unknown): CreditPackConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  const id = String(candidate.id || "").trim();
  const name = String(candidate.name || "").trim();
  const credits = Number(candidate.credits);
  const price = normalizeUsdAmount(candidate.price);

  if (!id || !name) return null;
  if (!Number.isFinite(credits) || credits <= 0) return null;
  if (price === null) return null;

  return {
    id,
    name,
    credits: Math.trunc(credits),
    price,
    pricePerCredit: Number((price / credits).toFixed(2)),
    popular: Boolean(candidate.popular),
  };
}

export function sanitizeCreditPacks(
  rawPacks: unknown,
  fallbackPacks: CreditPackConfig[]
): CreditPackConfig[] {
  const source = Array.isArray(rawPacks) ? rawPacks : fallbackPacks;
  const normalized = source
    .map(normalizePack)
    .filter((pack): pack is CreditPackConfig => pack !== null);

  if (normalized.length > 0) return normalized;

  return fallbackPacks
    .map(normalizePack)
    .filter((pack): pack is CreditPackConfig => pack !== null);
}

export function findCreditPackById(
  packs: CreditPackConfig[],
  packId: string
): CreditPackConfig | null {
  const id = String(packId || "").trim();
  if (!id) return null;
  return packs.find((pack) => pack.id === id) || null;
}

export interface CapturePaymentInfo {
  amount: number | null;
  currency: string | null;
  captureId: string | null;
  status: string | null;
}

export function extractCapturePaymentInfo(payload: any): CapturePaymentInfo {
  const firstUnit = Array.isArray(payload?.purchase_units)
    ? payload.purchase_units[0]
    : null;
  const firstCapture = Array.isArray(firstUnit?.payments?.captures)
    ? firstUnit.payments.captures[0]
    : null;

  const amountRaw = firstCapture?.amount?.value ?? firstUnit?.amount?.value;
  const currencyRaw =
    firstCapture?.amount?.currency_code ?? firstUnit?.amount?.currency_code;

  const captureId = firstCapture?.id ? String(firstCapture.id) : null;
  const captureStatus = firstCapture?.status
    ? String(firstCapture.status).toUpperCase()
    : null;
  const topLevelStatus = payload?.status
    ? String(payload.status).toUpperCase()
    : null;

  return {
    amount: normalizeUsdAmount(amountRaw),
    currency: currencyRaw ? String(currencyRaw).toUpperCase() : null,
    captureId,
    status: captureStatus || topLevelStatus,
  };
}

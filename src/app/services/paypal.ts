/**
 * PayPal Payment Service – Handles universal top-up purchases via PayPal.
 * Uses PayPal Buttons SDK (client-side) + server-side order capture.
 *
 * Flow:
 * 1. Frontend creates a PayPal order via server (/paypal/create-order)
 * 2. User approves payment in PayPal popup
 * 3. Frontend captures the order via server (/paypal/capture-order)
 * 4. Server validates + adds credits to the universal balance
 */

import { apiUrl } from "../../../utils/config/info";
import { getCachedAccessToken } from "./api-client";

const BASE_URL = apiUrl;

async function fetchPaypal(path: string, body: Record<string, unknown>): Promise<any> {
  const token = getCachedAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "PayPal error");
  return json;
}

export const PayPalService = {
  /** Create a PayPal order for a universal top-up pack */
  async createOrder(packId: string, packName: string, price: number) {
    return fetchPaypal("/paypal/create-order", { packId, packName, price });
  },

  /** Capture a PayPal order after user approval */
  async captureOrder(orderId: string, packId: string) {
    return fetchPaypal("/paypal/capture-order", { orderId, packId });
  },

  /** Load the PayPal SDK script dynamically */
  loadScript(clientId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).paypal) {
        resolve();
        return;
      }

      const existing = document.querySelector('script[src*="paypal.com/sdk/js"]');
      if (existing) {
        existing.addEventListener("load", () => resolve());
        return;
      }

      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Error al cargar PayPal SDK"));
      document.head.appendChild(script);
    });
  },
};

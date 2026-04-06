import { toast } from "sonner";
import { ToolActionsApi } from "./api-client";

function isAuthErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("autenticación requerida") ||
    normalized.includes("autenticacion requerida") ||
    normalized.includes("no autenticado") ||
    normalized.includes("no autorizado") ||
    normalized.includes("inicia sesion") ||
    normalized.includes("inicia sesión") ||
    normalized.includes("debes iniciar sesion") ||
    normalized.includes("debes iniciar sesión")
  );
}

export async function consumeProtectedToolAction(input: {
  isLoggedIn: boolean;
  toolId: string;
  actionId: string;
  onAuthRequired: () => void;
  authMessage: string;
  deniedMessage?: string;
  onConsumed?: () => void | Promise<void>;
}): Promise<boolean> {
  if (!input.isLoggedIn) {
    toast(input.authMessage);
    input.onAuthRequired();
    return false;
  }

  try {
    await ToolActionsApi.consume(input.toolId, input.actionId);
    await input.onConsumed?.();
    return true;
  } catch (error: any) {
    const message = String(error?.message || "").trim();
    if (message && isAuthErrorMessage(message)) {
      toast(input.authMessage);
      input.onAuthRequired();
      return false;
    }
    toast.error(message || input.deniedMessage || "Acción no permitida por tu plan");
    return false;
  }
}

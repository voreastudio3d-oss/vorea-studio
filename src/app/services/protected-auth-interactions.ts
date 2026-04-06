import { toast } from "sonner";

export function requireLoggedInInteraction(input: {
  isLoggedIn: boolean;
  onAuthRequired: () => void;
  authMessage: string;
}): boolean {
  if (input.isLoggedIn) {
    return true;
  }

  toast(input.authMessage);
  input.onAuthRequired();
  return false;
}

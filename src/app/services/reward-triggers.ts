/**
 * Reward Triggers — fire-and-forget helpers for Vorea Rewards.
 *
 * Usage:  import { fireReward } from "../services/reward-triggers";
 *         fireReward("export_stl");   // ← non-blocking, shows XP toast
 *
 * Never throws or blocks. All errors are silently swallowed.
 */

import { toast } from "sonner";
import { RewardsApi } from "./api-client";

type RewardAction =
  | "first_model"
  | "publish_model"
  | "export_gcode"
  | "export_stl"
  | "ai_generation"
  | "community_like"
  | "receive_like"
  | "receive_download"
  | "daily_login"
  | "streak_7"
  | "streak_30"
  | "relief_export"
  | "feedback_sent"
  | "quick_fix_used";

/**
 * Fire a reward action. Non-blocking, shows a small toast on XP gain.
 * Silently swallows errors so it never interrupts the user flow.
 */
export function fireReward(action: RewardAction): void {
  void (async () => {
    try {
      const res = await RewardsApi.triggerAction("", action);
      if (!res.success) return;

      // XP gained toast
      if (res.xpAwarded > 0) {
        toast(`⚡ +${res.xpAwarded} XP`, {
          description: res.leveledUp
            ? `🎉 ¡Subiste a ${res.name}! ${res.badge}`
            : undefined,
          duration: 2500,
          position: "bottom-left",
        });
      }

      // Bonus credits on level-up
      if (res.bonusCredits > 0) {
        setTimeout(() => {
          toast(`🎁 +${res.bonusCredits} créditos bonus`, {
            duration: 3500,
            position: "bottom-left",
          });
        }, 800);
      }
    } catch {
      // Silent — rewards must never block user actions
    }
  })();
}

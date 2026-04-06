type ToolCreditStateLike = {
  balance?: number;
  topupBalance?: number;
  totalUsed?: number;
  [key: string]: unknown;
};

export interface ToolCreditPrechargeSnapshot {
  balanceBefore: number;
  topupBalanceBefore: number;
  totalUsedBefore: number;
  creditCost: number;
  creditsFromMonthly: number;
  creditsFromTopup: number;
}

export function applyToolCreditPrecharge<T extends ToolCreditStateLike>(
  state: T,
  creditCost: number
): { nextState: T; snapshot: ToolCreditPrechargeSnapshot } {
  const balanceBefore = Math.max(0, Number(state.balance ?? 0));
  const topupBalanceBefore = Math.max(0, Number(state.topupBalance ?? 0));
  const totalUsedBefore = Math.max(0, Number(state.totalUsed ?? 0));
  const normalizedCreditCost = Math.max(0, Number(creditCost || 0));
  const monthlyBalanceBefore = Math.max(0, balanceBefore - topupBalanceBefore);
  const creditsFromMonthly = Math.min(normalizedCreditCost, monthlyBalanceBefore);
  const creditsFromTopup = Math.max(0, normalizedCreditCost - creditsFromMonthly);

  return {
    nextState: {
      ...state,
      balance: Math.max(0, balanceBefore - normalizedCreditCost),
      topupBalance: Math.max(0, topupBalanceBefore - creditsFromTopup),
      totalUsed: totalUsedBefore + normalizedCreditCost,
    },
    snapshot: {
      balanceBefore,
      topupBalanceBefore,
      totalUsedBefore,
      creditCost: normalizedCreditCost,
      creditsFromMonthly,
      creditsFromTopup,
    },
  };
}

export function restoreToolCreditPrecharge<T extends ToolCreditStateLike>(
  state: T,
  snapshot: ToolCreditPrechargeSnapshot
): T {
  return {
    ...state,
    balance: snapshot.balanceBefore,
    topupBalance: snapshot.topupBalanceBefore,
    totalUsed: snapshot.totalUsedBefore,
  };
}

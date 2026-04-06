import { describe, expect, it } from "vitest";

import {
  applyToolCreditPrecharge,
  restoreToolCreditPrecharge,
} from "../tool-credit-state.js";

describe("tool credit state", () => {
  it("splits AI precharge across monthly and top-up balances", () => {
    const initialState = {
      balance: 8,
      topupBalance: 5,
      totalUsed: 11,
      monthlyAllocation: 6,
    };

    const { nextState, snapshot } = applyToolCreditPrecharge(initialState, 7);

    expect(snapshot).toMatchObject({
      balanceBefore: 8,
      topupBalanceBefore: 5,
      totalUsedBefore: 11,
      creditCost: 7,
      creditsFromMonthly: 3,
      creditsFromTopup: 4,
    });
    expect(nextState).toMatchObject({
      balance: 1,
      topupBalance: 1,
      totalUsed: 18,
      monthlyAllocation: 6,
    });
  });

  it("restores the exact original balances after a failed generation refund", () => {
    const initialState = {
      balance: 8,
      topupBalance: 5,
      totalUsed: 11,
      monthlyAllocation: 6,
    };

    const { nextState, snapshot } = applyToolCreditPrecharge(initialState, 7);
    const restoredState = restoreToolCreditPrecharge(nextState, snapshot);

    expect(restoredState).toEqual(initialState);
  });
});

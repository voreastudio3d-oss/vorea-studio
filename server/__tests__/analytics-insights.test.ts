/**
 * Analytics Insights types + prompt builder tests.
 */
import { describe, it, expect } from "vitest";
import type {
  InsightCategory,
  InsightPriority,
  AnalyticsInsight,
  AnalyticsInsightsResponse,
} from "../analytics-insights";

describe("analytics-insights types", () => {
  it("InsightCategory values are valid", () => {
    const categories: InsightCategory[] = [
      "activation", "conversion", "retention", "growth", "risk", "trend_discovery",
    ];
    expect(categories).toHaveLength(6);
  });

  it("InsightPriority values are valid", () => {
    const priorities: InsightPriority[] = ["high", "medium", "low"];
    expect(priorities).toHaveLength(3);
  });

  it("AnalyticsInsight shape is correct", () => {
    const insight: AnalyticsInsight = {
      category: "growth",
      priority: "high",
      title: "Test Insight",
      insight: "Description",
      action: "Do something",
      metric_reference: "sessions",
    };
    expect(insight.category).toBe("growth");
    expect(insight.priority).toBe("high");
  });

  it("AnalyticsInsightsResponse shape is correct", () => {
    const response: AnalyticsInsightsResponse = {
      period: "last_7_days",
      generatedAt: new Date().toISOString(),
      metrics: null,
      insights: [],
      cached: false,
      mock: true,
      configured: false,
      available: false,
      unavailableReason: "GA4 not configured",
    };
    expect(response.available).toBe(false);
    expect(response.insights).toHaveLength(0);
  });
});

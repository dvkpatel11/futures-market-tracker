import { BREAKOUT_CONFIG } from "../utils/constants";
import { BreakoutAlert, KlineData, MarketMetrics } from "../utils/types";

export class BreakoutDetector {
  private lastBreakoutAlerts: Record<string, BreakoutAlert> = {};

  detectBreakout(
    symbol: string,
    klines: KlineData[],
    marketMetrics: MarketMetrics,
    timeframe: string
  ): BreakoutAlert | null {
    const latestKline = klines[klines.length - 1];
    const baseKline = klines[0];

    // Calculate percentage move
    const percentageMove = Math.abs(((latestKline.close - baseKline.close) / baseKline.close) * 100);

    // Check against breakout thresholds
    const breakoutThreshold = this.getBreakoutThreshold(percentageMove);
    if (!breakoutThreshold) return null;

    // Check cooldown
    const lastAlert = this.lastBreakoutAlerts[symbol];
    if (lastAlert && Date.now() - lastAlert.timestamp < BREAKOUT_CONFIG.cooldown) {
      return null;
    }

    // Determine trend
    const trendAnalysis = this.analyzeTrend(marketMetrics);

    const breakoutAlert: BreakoutAlert = {
      symbol,
      timestamp: Date.now(),
      breakoutType: breakoutThreshold,
      currentPrice: latestKline.close,
      priceAtBreakout: baseKline.close,
      percentageMove,
      timeframe,
      trend: trendAnalysis.trend,
      volumeProfile: {
        current: latestKline.volume,
        trend: marketMetrics.volumeProfile.trend,
      },
      momentum: marketMetrics.momentum,
    };

    // Update last breakout alert
    this.lastBreakoutAlerts[symbol] = breakoutAlert;

    return breakoutAlert;
  }

  private getBreakoutThreshold(percentageMove: number): "short" | "medium" | "large" | "extreme" | null {
    const { thresholds } = BREAKOUT_CONFIG;

    if (percentageMove >= thresholds.extreme) return "extreme";
    if (percentageMove >= thresholds.large) return "large";
    if (percentageMove >= thresholds.medium) return "medium";
    if (percentageMove >= thresholds.short) return "short";

    return null;
  }

  private analyzeTrend(metrics: MarketMetrics): {
    trend: "bullish" | "bearish" | "neutral";
    reasons: string[];
  } {
    const trendFactors = [
      metrics.momentum.shortTerm > 70 ? 1 : metrics.momentum.shortTerm < 30 ? -1 : 0,
      metrics.momentum.mediumTerm > 70 ? 1 : metrics.momentum.mediumTerm < 30 ? -1 : 0,
      metrics.priceChange > 0 ? 1 : metrics.priceChange < 0 ? -1 : 0,
      metrics.volumeProfile.trend === "increasing" ? 1 : metrics.volumeProfile.trend === "decreasing" ? -1 : 0,
    ];

    const trendScore = trendFactors.reduce((sum, factor) => sum + factor, 0);

    return {
      trend: trendScore > 0 ? "bullish" : trendScore < 0 ? "bearish" : "neutral",
      reasons: [], // You can expand this with detailed reasoning
    };
  }
}

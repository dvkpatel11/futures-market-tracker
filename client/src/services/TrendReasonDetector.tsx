import { KlineData, MarketMetrics, TrendReason } from "../utils/types";

export class TrendReasonDetector {
  static detectBullishReasons(metrics: MarketMetrics, klines: KlineData[]): TrendReason[] {
    const reasons: TrendReason[] = [];

    // Momentum Indicators
    if (metrics.momentum.shortTerm > 70) {
      reasons.push("short_term_momentum");
      reasons.push("RSI_overbought");
    }
    if (metrics.momentum.mediumTerm > 65) {
      reasons.push("medium_term_momentum");
    }
    if (metrics.momentum.longTerm > 60) {
      reasons.push("long_term_momentum");
    }

    // Price Movement
    if (metrics.priceChange > 0) {
      reasons.push("price_increase");
      reasons.push("recent_price_change");

      if (Math.abs(metrics.priceChange) > 5) {
        reasons.push("significant_price_change");
      }
    }

    // Volume Analysis
    if (metrics.volumeProfile.trend === "increasing") {
      reasons.push("increasing_volume");
      reasons.push("strong_volume");
    }

    // Volatility Considerations
    if (metrics.volatility < 0.2) {
      reasons.push("low_volatility");
      reasons.push("uptrend_support");
    }

    // Drawdown Analysis
    if (metrics.drawdown < 0) {
      reasons.push("drawdown_low");
    }

    // Candlestick Pattern Detection (simplified)
    const lastCandle = klines[klines.length - 1];
    const prevCandle = klines[klines.length - 2];
    if (lastCandle.close > lastCandle.open && prevCandle.close < prevCandle.open) {
      reasons.push("bullish_candlestick");
    }

    // Momentum Shift
    if (metrics.momentum.shortTerm > metrics.momentum.mediumTerm) {
      reasons.push("momentum_shift");
    }

    // Trend Confirmation
    reasons.push("uptrend");

    return [...new Set(reasons)]; // Remove duplicates
  }

  static detectBearishReasons(metrics: MarketMetrics, klines: KlineData[]): TrendReason[] {
    const reasons: TrendReason[] = [];

    // Momentum Indicators
    if (metrics.momentum.shortTerm < 30) {
      reasons.push("short_term_momentum");
      reasons.push("RSI_oversold");
    }
    if (metrics.momentum.mediumTerm < 35) {
      reasons.push("momentum_shift");
    }
    if (metrics.momentum.longTerm < 40) {
      reasons.push("long_term_momentum");
    }

    // Price Movement
    if (metrics.priceChange < 0) {
      reasons.push("price_decrease");
      reasons.push("recent_price_change");

      if (Math.abs(metrics.priceChange) > 5) {
        reasons.push("significant_price_change");
      }
    }

    // Volume Analysis
    if (metrics.volumeProfile.trend === "decreasing") {
      reasons.push("decreasing_volume");
      reasons.push("weak_volume");
    }

    // Volatility Considerations
    if (metrics.volatility > 0.2) {
      reasons.push("high_volatility");
      reasons.push("downtrend_support");
    }

    // Drawdown Analysis
    if (metrics.drawdown > 0) {
      reasons.push("drawdown_high");
    }

    // Candlestick Pattern Detection (simplified)
    const lastCandle = klines[klines.length - 1];
    const prevCandle = klines[klines.length - 2];
    if (lastCandle.close < lastCandle.open && prevCandle.close > prevCandle.open) {
      reasons.push("bearish_candlestick");
    }

    // Trend Confirmation
    reasons.push("downtrend");

    return [...new Set(reasons)]; // Remove duplicates
  }

  static detectNeutralReasons(metrics: MarketMetrics): TrendReason[] {
    const reasons: TrendReason[] = [];

    // Momentum Stability
    if (metrics.momentum.shortTerm >= 40 && metrics.momentum.shortTerm <= 60) {
      reasons.push("RSI_stable");
      reasons.push("neutral_trend");
    }

    // Volume Stability
    if (metrics.volumeProfile.trend === "stable") {
      reasons.push("stable_volume");
    }

    // Price Stability
    if (Math.abs(metrics.priceChange) < 1) {
      reasons.push("sideways_trend");
    }

    return reasons;
  }
}

import { CONFIG } from "../utils/constants";
import { KlineData, MarketSignal, TickerData, TimeframeConfig, TimeframeSignal } from "../utils/types";
import { MarketMetricsCalculator } from "./MarketMetricsCalculator";

export class MarketSignalDetector {
  static detectBullishSignals(
    klines: KlineData[],
    config: TimeframeConfig,
    tickerData?: TickerData
  ): TimeframeSignal | null {
    const closes = klines.map((k) => k.close);

    const metrics = MarketMetricsCalculator.calculateMarketMetrics(klines, config);
    const isBullish =
      metrics.priceChange > config.threshold &&
      metrics.momentum.shortTerm > 60 &&
      metrics.momentum.mediumTerm > 55 &&
      metrics.volatility < config.volatilityThreshold;

    return isBullish
      ? {
          timeframe: config.interval,
          strength: metrics.priceChange,
          confirmedAt: Date.now(),
          priceAtSignal: klines[klines.length - 1].close,
          components: {
            price: metrics.priceChange,
            volume: klines[klines.length - 1].volume,
            trend: {
              trend: "bullish",
              reasons: [
                `Price change of ${metrics.priceChange.toFixed(2)} exceeds threshold.`,
                `Short-term RSI at ${metrics.m``.shortTerm} indicates strong buying pressure.`,
                `Medium-term RSI at ${metrics.m``.mediumTerm} supports upward momentum.`,
                `Volatility at ${metrics.volatility} is below the threshold, suggesting stability.`,
              ],
            },
            priceChangePercent: metrics.priceChangePercent,
          },
        }
      : null;
  }

  static analyzeBullishSignals(signals: TimeframeSignal[]): MarketSignal | null {
    if (signals.length === 0) return null;

    const overallStrength = signals.reduce((sum, signal) => sum + signal.strength, 0);
    const validSignals = signals.filter((signal) => signal.components.trend.trend === "bullish");

    return {
      symbol: "SYMBOL", // Replace with actual symbol
      timestamp: Date.now(),
      signals: validSignals,
      overallStrength,
      isValid: validSignals.length >= 2,
      volatilityProfile: this.determineVolatilityProfile(overallStrength),
    };
  }

  // Modify volatility profile determination
  public static determineVolatilityProfile(strength: number): MarketSignal["volatilityProfile"] {
    const { LOW, MEDIUM, HIGH } = CONFIG.VOLATILITY_PROFILES;

    if (strength < LOW) return "low";
    if (strength < MEDIUM) return "medium";
    if (strength < HIGH) return "high";
    return "extreme";
  }
}

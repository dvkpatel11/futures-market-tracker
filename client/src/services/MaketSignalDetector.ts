import { KlineData, MarketSignal, TickerData, TimeframeConfig, TimeframeSignal } from "../utils/types";
import { MarketMetricsCalculator } from "./MarketMetricsCalculator";

export class MarketSignalDetector {
  static detectBullishSignals(
    klines: KlineData[],
    config: TimeframeConfig,
    tickerData?: TickerData
  ): TimeframeSignal | null {
    const closes = klines.map((k) => k.close);

    const metrics = {
      priceChange: MarketMetricsCalculator.calculatePriceChange(klines),
      volatility: MarketMetricsCalculator.calculateVolatility(klines),
      rsi: {
        shortTerm: MarketMetricsCalculator.calculateRSI(closes, 14),
        mediumTerm: MarketMetricsCalculator.calculateRSI(closes, 30),
      },
      // Include additional data from ticker if available
      priceChangePercent: tickerData?.priceChangePercent || 0,
    };

    const isBullish =
      metrics.priceChange > config.threshold &&
      metrics.rsi.shortTerm > 60 &&
      metrics.rsi.mediumTerm > 55 &&
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
                `Short-term RSI at ${metrics.rsi.shortTerm} indicates strong buying pressure.`,
                `Medium-term RSI at ${metrics.rsi.mediumTerm} supports upward momentum.`,
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

  private static determineVolatilityProfile(strength: number): "low" | "medium" | "high" | "extreme" {
    if (strength < 0.2) return "low";
    if (strength < 0.5) return "medium";
    if (strength < 0.8) return "high";
    return "extreme";
  }
}

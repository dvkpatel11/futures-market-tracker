import { BREAKOUT_CONFIG, CONFIG } from "../utils/constants";
import { BreakoutAlert, KlineData, MarketMetrics } from "../utils/types";
import { MarketDataService } from "./MarketDataService";

export class BreakoutDetector {
  private lastBreakoutAlerts: Record<string, BreakoutAlert> = {};

  detectBreakout(
    symbol: string,
    klines: KlineData[],
    marketMetrics: MarketMetrics,
    timeframe: string
  ): BreakoutAlert | null {
    const latestKline = klines[klines.length - 1];
    const closes = klines.map((k) => k.close);
    const volumes = klines.map((k) => k.volume);

    // Check cooldown for last breakout alert
    const lastAlert = this.lastBreakoutAlerts[symbol];
    if (lastAlert && Date.now() - lastAlert.timestamp < BREAKOUT_CONFIG.cooldown) {
      return null; // Cooldown period not yet expired
    }

    // Calculate Bollinger Bands
    const { upper, lower } = this.calculateBollingerBands(closes);

    const currentPrice = closes[closes.length - 1];
    const previousPrice = closes[closes.length - 2];
    const volumeMA = this.calculateSMA(volumes.slice(-CONFIG.MARKET_ANALYSIS.INDICATOR_THRESHOLDS.VOLUME_MA_PERIOD));
    const currentVolume = volumes[volumes.length - 1];

    // Breakout Detection Logic
    const isBreakingUp = currentPrice > upper && previousPrice <= upper;
    const isBreakingDown = currentPrice < lower && previousPrice >= lower;
    const hasVolumeConfirmation = currentVolume > volumeMA * 1.5;

    if ((isBreakingUp || isBreakingDown) && hasVolumeConfirmation) {
      const percentageMove = Math.abs(((currentPrice - previousPrice) / previousPrice) * 100);
      const breakoutType = this.getBreakoutThreshold(percentageMove);

      // Create and store the new breakout alert
      const breakoutAlert: BreakoutAlert = {
        timestamp: Date.now(),
        breakoutType,
        currentPrice,
        priceAtBreakout: previousPrice,
        percentageMove,
        timeframe: "current",
        trend: MarketDataService.determineTrend(marketMetrics),
        volumeProfile: {
          current: currentVolume,
          trend: marketMetrics.volumeProfile.trend,
        },
        momentum: marketMetrics.momentum,
        symbol, // Set this from the parameter in your actual implementation
      };

      // Update last breakout alert
      this.lastBreakoutAlerts[symbol] = breakoutAlert;

      return breakoutAlert;
    }

    return null; // No breakout detected
  }

  private getBreakoutThreshold(percentageMove: number): "short" | "medium" | "large" | "extreme" | null {
    const { thresholds } = BREAKOUT_CONFIG;

    if (percentageMove >= thresholds.extreme) return "extreme";
    if (percentageMove >= thresholds.large) return "large";
    if (percentageMove >= thresholds.medium) return "medium";
    if (percentageMove >= thresholds.short) return "short";

    return null;
  }

  private calculateSMA(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private calculateBollingerBands(values: number[]) {
    const sma = this.calculateSMA(values.slice(-CONFIG.MARKET_ANALYSIS.INDICATOR_THRESHOLDS.BOLLINGER_PERIOD));
    const std = Math.sqrt(
      values.slice(-CONFIG.MARKET_ANALYSIS.INDICATOR_THRESHOLDS.BOLLINGER_PERIOD).reduce((sum, value) => sum + Math.pow(value - sma, 2), 0) /
      CONFIG.MARKET_ANALYSIS.INDICATOR_THRESHOLDS.BOLLINGER_PERIOD
    );

    return {
      upper: sma + CONFIG.MARKET_ANALYSIS.INDICATOR_THRESHOLDS.BOLLINGER_STD * std,
      middle: sma,
      lower: sma - CONFIG.MARKET_ANALYSIS.INDICATOR_THRESHOLDS.BOLLINGER_STD * std,
    };
  }
}

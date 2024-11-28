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
    // Validate input data
    if (!klines || klines.length < CONFIG.MARKET_ANALYSIS.INDICATOR_THRESHOLDS.BOLLINGER_PERIOD + 2) {
      console.warn(`Insufficient data for breakout detection on ${symbol}`);
      return null;
    }

    const closes = klines.map((k) => k.close);
    const volumes = klines.map((k) => k.volume);
    const highs = klines.map((k) => k.high);
    const lows = klines.map((k) => k.low);

    // Check cooldown for last breakout alert
    const lastAlert = this.lastBreakoutAlerts[symbol];
    if (lastAlert && Date.now() - lastAlert.timestamp < BREAKOUT_CONFIG.cooldown) {
      return null; // Cooldown period not yet expired
    }

    // Enhanced Breakout Calculation
    const { upper, lower } = this.calculateBollingerBands(closes);

    const currentPrice = closes[closes.length - 1];
    const previousPrice = closes[closes.length - 2];

    // Volume Analysis
    const volumeSlice = volumes.slice(-CONFIG.MARKET_ANALYSIS.INDICATOR_THRESHOLDS.VOLUME_MA_PERIOD);
    const volumeMA = this.calculateSMA(volumeSlice);
    const currentVolume = volumes[volumes.length - 1];
    const trend = MarketDataService.determineTrend(marketMetrics);
    // Advanced Breakout Detection with Multiple Confirmations
    const conditions = {
      priceBreakout: {
        up: currentPrice > upper && previousPrice <= upper,
        down: currentPrice < lower && previousPrice >= lower,
      },
      volumeConfirmation: currentVolume > volumeMA * BREAKOUT_CONFIG.volumeMultiplier,
      trendConfirmation: this.confirmTrendAlignment(highs, lows, upper, lower, trend.trend),
      volatilityConfirmation: this.checkVolatilityExpansion(closes),
    };

    // Comprehensive Breakout Validation
    const isValidBreakout =
      (conditions.priceBreakout.up || conditions.priceBreakout.down) &&
      conditions.volumeConfirmation &&
      conditions.trendConfirmation &&
      conditions.volatilityConfirmation;

    if (isValidBreakout) {
      const breakoutDirection = conditions.priceBreakout.up ? "bullish" : "bearish";
      const percentageMove = Math.abs(((currentPrice - previousPrice) / previousPrice) * 100);

      const breakoutAlert: BreakoutAlert = {
        timestamp: Date.now(),
        breakoutType: this.getBreakoutThreshold(percentageMove),
        currentPrice,
        priceAtBreakout: previousPrice,
        percentageMove,
        timeframe,
        direction: breakoutDirection,
        trend: trend,
        volumeProfile: {
          current: currentVolume,
          trend: marketMetrics.volumeProfile.trend,
        },
        momentum: marketMetrics.momentum,
        symbol,
      };

      // Update last breakout alert
      this.lastBreakoutAlerts[symbol] = breakoutAlert;

      return breakoutAlert;
    }

    return null; // No breakout detected
  }

  private confirmTrendAlignment(
    highs: number[],
    lows: number[],
    upperBand: number,
    lowerBand: number,
    trend: "bullish" | "bearish" | "neutral"
  ): boolean {
    const recentHigh = Math.max(...highs.slice(-5));
    const recentLow = Math.min(...lows.slice(-5));

    // Trend-independent breakout confirmations
    const breakoutConfirmations = {
      bullish: recentHigh > upperBand,
      bearish: recentLow < lowerBand,
    };

    // Trend-aligned nuances
    switch (trend) {
      case "bullish":
        return breakoutConfirmations.bullish;
      case "bearish":
        return breakoutConfirmations.bearish;
      case "neutral":
        return breakoutConfirmations.bullish || breakoutConfirmations.bearish;
      default:
        return false;
    }
  }

  private checkVolatilityExpansion(closes: number[]): boolean {
    const recentCloses = closes.slice(-5);
    const volatilityRatio = Math.max(...recentCloses) / Math.min(...recentCloses);

    return volatilityRatio > BREAKOUT_CONFIG.volatilityExpansionThreshold;
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
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private calculateBollingerBands(values: number[]) {
    const period = CONFIG.MARKET_ANALYSIS.INDICATOR_THRESHOLDS.BOLLINGER_PERIOD;
    const recentValues = values.slice(-period);

    if (recentValues.length < period) {
      throw new Error("Insufficient data for Bollinger Bands calculation");
    }

    const sma = this.calculateSMA(recentValues);
    const std = Math.sqrt(recentValues.reduce((sum, value) => sum + Math.pow(value - sma, 2), 0) / period);

    return {
      upper: sma + CONFIG.MARKET_ANALYSIS.INDICATOR_THRESHOLDS.BOLLINGER_STD * std,
      middle: sma,
      lower: sma - CONFIG.MARKET_ANALYSIS.INDICATOR_THRESHOLDS.BOLLINGER_STD * std,
    };
  }
}

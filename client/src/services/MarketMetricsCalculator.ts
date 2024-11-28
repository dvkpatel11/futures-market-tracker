import { KlineData, MarketMetrics, TimeframeConfig } from "../utils/types";

export class MarketMetricsCalculator {
  static calculatePriceChange(klines: KlineData[]): number {
    if (klines.length < 2) return 0;
    const startPrice = klines[0].close;
    const endPrice = klines[klines.length - 1].close;
    return ((endPrice - startPrice) / startPrice) * 100;
  }

  static calculateVolatility(klines: KlineData[], timeframeConfig: TimeframeConfig): number {
    if (klines.length < 2) return 0;

    const returns = klines.slice(1).map((kline, i) => {
      const prevClose = klines[i].close;
      if (prevClose === 0) return 0;
      return Math.log(kline.close / prevClose);
    });

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

    // Annualization factor based on timeframe
    const periodsPerYear = (365 * 24 * 60 * 60) / timeframeConfig.seconds;
    return Math.sqrt(variance) * Math.sqrt(periodsPerYear) * 100;
  }

  static calculateRSI(prices: number[], period: number = 14): number {
    const changes = prices.slice(1).map((price, i) => price - prices[i]);
    const gains = changes.map((change) => (change > 0 ? change : 0));
    const losses = changes.map((change) => (change < 0 ? -change : 0));

    const avgGain = this.calculateMovingAverage(gains, period).pop() || 0;
    const avgLoss = this.calculateMovingAverage(losses, period).pop() || 0;

    if (avgLoss === 0) return 100;
    const RS = avgGain / avgLoss;
    return 100 - 100 / (1 + RS);
  }

  static calculateVolumeProfile(
    klines: KlineData[],
    timeframeConfig: TimeframeConfig
  ): { value: number; trend: "increasing" | "decreasing" | "stable" } {
    // Adjust lookback based on timeframe
    const periodsToAnalyze = this.getVolumeLookbackPeriods(timeframeConfig.interval);
    const recentVolumes = klines.slice(-periodsToAnalyze).map((k) => k.volume);

    if (recentVolumes.length < 2) {
      return { value: recentVolumes[0] || 0, trend: "stable" };
    }

    const avgVolume = this.calculateMovingAverage(recentVolumes, recentVolumes.length)[0];
    const volumeChange = ((recentVolumes[recentVolumes.length - 1] - recentVolumes[0]) / recentVolumes[0]) * 100;

    // Adjust threshold based on timeframe volatility multiplier
    const changeThreshold = 5 * timeframeConfig.volatilityMultiplier;

    return {
      value: avgVolume,
      trend: volumeChange > changeThreshold ? "increasing" : volumeChange < -changeThreshold ? "decreasing" : "stable",
    };
  }

  private static getVolumeLookbackPeriods(timeframe: string): number {
    switch (timeframe) {
      case "5m":
        return 12; // 1 hour of data
      case "1h":
        return 6; // 6 hours of data
      case "4h":
        return 6; // 24 hours of data
      case "1d":
        return 5; // 5 days of data
      default:
        return 5;
    }
  }

  static calculateMomentum(
    klines: KlineData[],
    timeframeConfig: TimeframeConfig
  ): {
    shortTerm: number;
    mediumTerm: number;
    longTerm: number;
  } {
    const prices = klines.map((k) => k.close);
    const basePeriod = this.getRSIPeriod(timeframeConfig.interval);

    return {
      shortTerm: this.calculateRSI(prices, 14),
      mediumTerm: this.calculateRSI(prices.slice(-basePeriod * 2), 30),
      longTerm: this.calculateRSI(prices.slice(-basePeriod * 4), 50),
    };
  }

  private static getRSIPeriod(timeframe: string): number {
    // Adjust RSI periods based on timeframe
    switch (timeframe) {
      case "5m":
        return 24; // 2 hours worth of 5m candles
      case "1h":
        return 14; // 14 hours
      case "4h":
        return 14; // 56 hours
      case "1d":
        return 14; // 14 days
      default:
        return 14;
    }
  }

  static calculateMovingAverage(data: number[], period: number): number[] {
    if (period <= 0 || data.length === 0) return [];

    const result: number[] = [];
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / period);
    }
    return result;
  }

  static calculateDrawdown(klines: KlineData[]): number {
    if (klines.length < 2) return 0;

    let maxPrice = klines[0].high;
    let maxDrawdown = 0;

    for (const kline of klines) {
      maxPrice = Math.max(maxPrice, kline.high);
      const currentDrawdown = ((maxPrice - kline.low) / maxPrice) * 100;
      maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
    }

    return maxDrawdown;
  }

  static calculateMarketMetrics(klines: KlineData[], config: TimeframeConfig): MarketMetrics {
    // Extract necessary data
    const closes = klines.map((kline) => kline.close);

    // Calculate comprehensive market metrics
    const priceChange = MarketMetricsCalculator.calculatePriceChange(klines);
    const volatility = MarketMetricsCalculator.calculateVolatility(klines, config);
    const drawdown = MarketMetricsCalculator.calculateDrawdown(klines);
    const momentum = {
      shortTerm: MarketMetricsCalculator.calculateRSI(closes, 14),
      mediumTerm: MarketMetricsCalculator.calculateRSI(closes, 30),
      longTerm: MarketMetricsCalculator.calculateRSI(closes, 50),
    };
    const volumeProfile = MarketMetricsCalculator.calculateVolumeProfile(klines, config);

    return {
      lastUpdate: Date.now(),
      priceChange,
      volatility,
      drawdown,
      volumeProfile,
      momentum,
    };
  }
}

import { CONFIG } from "../utils/constants";
import {
  KlineData,
  MarketMetrics,
  MarketSignal,
  TimeframeConfig,
  TimeframeSignal,
  Trend,
  TrendReason,
} from "../utils/types";
import { MarketMetricsCalculator } from "./MarketMetricsCalculator";
import { TrendReasonDetector } from "./TrendReasonDetector"; // Assuming previous implementation

// constructor(s: string[]) {
//   this.dataFetcher = new MarketDataFetcher();
//   this.symbols = s;
//   this.alertService = new AlertService(this.breakoutDetector);
// }

// // In the analyzeSymbol method, replace the breakout alert logic with:
// this.alertService.handleAlerts(
//   symbol,
//   klines,
//   symbolMetrics[timeframe],
//   { lastPrice: marketData.lastPrice, marketCap: marketData.marketCap },
//   CRYPTO_MARKET_CONFIG.timeframes[timeframe]
// );

export class MarketSignalDetector {
  static detectSignal(klines: KlineData[], config: TimeframeConfig): TimeframeSignal {
    const metrics = MarketMetricsCalculator.calculateMarketMetrics(klines, config);
    const trend = this.scoreTrend(metrics, klines);
    switch (trend.trend) {
      case "bullish":
        return this.createBullishSignal(metrics, config, trend);
      case "bearish":
        return this.createBearishSignal(metrics, config, trend);
      case "neutral":
        return this.createNeutralSignal(metrics, config, trend);
    }
  }

  // Advanced Candlestick Pattern Recognition
  private static detectCandlestickPatterns(klines: KlineData[]): TrendReason[] {
    const patterns: TrendReason[] = [];
    const last = klines[klines.length - 1];
    const prev = klines[klines.length - 2];

    const isBullishEngulfing = prev.close < prev.open && last.close > prev.open && last.open < prev.close;

    const isMorningStar =
      klines.length >= 3 &&
      klines[klines.length - 3].close < klines[klines.length - 3].open &&
      klines[klines.length - 2].close < klines[klines.length - 2].open &&
      last.close > last.open;

    const isBearishEngulfing = prev.close > prev.open && last.close < prev.open && last.open > prev.close;

    const isEveningStar =
      klines.length >= 3 &&
      klines[klines.length - 3].close > klines[klines.length - 3].open &&
      klines[klines.length - 2].close > klines[klines.length - 2].open &&
      last.close < last.open;

    if (isBullishEngulfing) patterns.push("bullish_candlestick");
    if (isMorningStar) patterns.push("bullish_candlestick");
    if (isBearishEngulfing) patterns.push("bearish_candlestick");
    if (isEveningStar) patterns.push("bearish_candlestick");

    return patterns;
  }

  static scoreTrend(metrics: MarketMetrics, klines: KlineData[]): Trend {
    const trendScores = {
      bullish: 0,
      bearish: 0,
      neutral: 0,
    };

    // Momentum Scoring (Weighted)
    const momentumWeights = {
      shortTerm: 3, // Most responsive
      mediumTerm: 2, // Intermediate confidence
      longTerm: 1, // Least responsive
    };

    // Short-Term Momentum
    if (metrics.momentum.shortTerm > 70) trendScores.bullish += momentumWeights.shortTerm;
    if (metrics.momentum.shortTerm < 30) trendScores.bearish += momentumWeights.shortTerm;

    // Medium-Term Momentum
    if (metrics.momentum.mediumTerm > 65) trendScores.bullish += momentumWeights.mediumTerm;
    if (metrics.momentum.mediumTerm < 35) trendScores.bearish += momentumWeights.mediumTerm;

    // Long-Term Momentum
    if (metrics.momentum.longTerm > 60) trendScores.bullish += momentumWeights.longTerm;
    if (metrics.momentum.longTerm < 40) trendScores.bearish += momentumWeights.longTerm;

    // Volume Profile Scoring
    if (metrics.volumeProfile.trend === "increasing") trendScores.bullish += 2;
    if (metrics.volumeProfile.trend === "decreasing") trendScores.bearish += 2;

    // Price Change Scoring
    const priceChangeScore = Math.abs(metrics.priceChange);
    if (metrics.priceChange > 0) trendScores.bullish += priceChangeScore;
    if (metrics.priceChange < 0) trendScores.bearish += priceChangeScore;

    // Volatility Impact
    const volatilityPenalty = metrics.volatility > 0.2 ? 1 : 0;
    trendScores.bullish -= volatilityPenalty;
    trendScores.bearish -= volatilityPenalty;

    // Candlestick Pattern Impact
    const candlestickPatterns = this.detectCandlestickPatterns(klines);
    if (candlestickPatterns.includes("bullish_candlestick")) trendScores.bullish += 2;
    if (candlestickPatterns.includes("bearish_candlestick")) trendScores.bearish += 2;

    // Determine Trend
    const { bullish, bearish, neutral } = trendScores;
    const maxScore = Math.max(bullish, bearish, neutral);

    if (bullish === maxScore && bullish > 3) {
      return {
        trend: "bullish",
        reasons: [...TrendReasonDetector.detectBullishReasons(metrics, klines), ...candlestickPatterns],
      };
    } else if (bearish === maxScore && bearish > 3) {
      return {
        trend: "bearish",
        reasons: [...TrendReasonDetector.detectBearishReasons(metrics, klines), ...candlestickPatterns],
      };
    } else {
      return {
        trend: "neutral",
        reasons: TrendReasonDetector.detectNeutralReasons(metrics),
      };
    }
  }

  private static createBullishSignal(metrics: MarketMetrics, config: TimeframeConfig, trend: Trend): TimeframeSignal {
    return {
      timeframe: config.interval,
      strength: metrics.priceChange,
      confirmedAt: Date.now(),
      priceAtSignal: metrics.priceChange,
      components: {
        price: metrics.priceChange,
        volume: metrics.volumeProfile.value,
        trend,
        priceChangePercent: metrics.priceChange,
      },
    };
  }

  private static createBearishSignal(metrics: MarketMetrics, config: TimeframeConfig, trend: Trend): TimeframeSignal {
    return {
      timeframe: config.interval,
      strength: Math.abs(metrics.priceChange),
      confirmedAt: Date.now(),
      priceAtSignal: metrics.priceChange,
      components: {
        price: metrics.priceChange,
        volume: metrics.volumeProfile.value,
        trend,
        priceChangePercent: metrics.priceChange,
      },
    };
  }

  private static createNeutralSignal(metrics: MarketMetrics, config: TimeframeConfig, trend: Trend): TimeframeSignal {
    return {
      timeframe: config.interval,
      strength: 0,
      confirmedAt: Date.now(),
      priceAtSignal: metrics.priceChange,
      components: {
        price: metrics.priceChange,
        volume: metrics.volumeProfile.value,
        trend,
        priceChangePercent: metrics.priceChange,
      },
    };
  }

  static generateMarketSignal(signals: TimeframeSignal[], symbol: string): MarketSignal | null {
    if (signals.length === 0) return null;

    const signalAnalysis = signals.reduce(
      (
        analysis: {
          bullish: TimeframeSignal[];
          bearish: TimeframeSignal[];
          neutral: TimeframeSignal[];
        },
        signal
      ) => {
        const trendType = signal.components.trend.trend;
        if (trendType in analysis) {
          analysis[trendType].push(signal);
        }
        return analysis;
      },
      {
        bullish: [],
        bearish: [],
        neutral: [],
      }
    );

    const strengthCalculator = {
      bullish: (signals: TimeframeSignal[]) => signals.reduce((sum, signal) => sum + signal.strength, 0),
      bearish: (signals: TimeframeSignal[]) => signals.reduce((sum, signal) => sum + Math.abs(signal.strength), 0),
      neutral: () => 0,
    };

    const overallStrength =
      strengthCalculator.bullish(signalAnalysis.bullish) - strengthCalculator.bearish(signalAnalysis.bearish);

    const trendConfidence = this.calculateTrendConfidence(signalAnalysis.bullish, signalAnalysis.bearish);

    const overallTrend = this.determineOverallTrend(signalAnalysis);

    return {
      symbol: symbol,
      timestamp: Date.now(),
      signals,
      overallStrength,
      isValid: trendConfidence > 0.5,
      volatilityProfile: this.determineVolatilityProfile(Math.abs(overallStrength)),
      trendConsistency: trendConfidence,
      overallTrend,
    };
  }

  private static determineOverallTrend(signalAnalysis: {
    bullish: TimeframeSignal[];
    bearish: TimeframeSignal[];
    neutral: TimeframeSignal[];
  }): Trend["trend"] {
    const trendCounts = {
      bullish: signalAnalysis.bullish.length,
      bearish: signalAnalysis.bearish.length,
      neutral: signalAnalysis.neutral.length,
    };

    if (trendCounts.bullish > trendCounts.bearish && trendCounts.bullish > trendCounts.neutral) return "bullish";
    if (trendCounts.bearish > trendCounts.bullish && trendCounts.bearish > trendCounts.neutral) return "bearish";
    return "neutral";
  }

  private static calculateTrendConfidence(
    bullishSignals: TimeframeSignal[],
    bearishSignals: TimeframeSignal[]
  ): number {
    const totalSignals = bullishSignals.length + bearishSignals.length;
    const bullishRatio = bullishSignals.length / totalSignals;

    return bullishRatio > 0.5 ? bullishRatio : 1 - bullishRatio;
  }

  static determineVolatilityProfile(strength: number): MarketSignal["volatilityProfile"] {
    const { LOW, MEDIUM, HIGH } = CONFIG.VOLATILITY_PROFILES;

    if (strength < LOW) return "low";
    if (strength < MEDIUM) return "medium";
    if (strength < HIGH) return "high";
    return "extreme";
  }
}

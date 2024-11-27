import { BehaviorSubject, catchError, from, interval, switchMap } from "rxjs";
import { CONFIG, CRYPTO_MARKET_CONFIG } from "../utils/constants";
import {
  BreakoutAlert,
  KlineData,
  MarketMetrics,
  MarketSignal,
  TimeframeConfig,
  TimeframeSignal,
} from "../utils/types";
import { BreakoutDetector } from "./BreakoutDetector";
import { MarketDataFetcher } from "./MarketDataFetcher";
import { MarketMetricsCalculator } from "./MarketMetricsCalculator";
import { marketState$ } from "./WebSocketService";

export class MarketDataService {
  private destroy$ = new BehaviorSubject<void>(undefined);
  private marketSignals$ = new BehaviorSubject<MarketSignal | null>(null);
  private dataFetcher: MarketDataFetcher;
  private symbols: string[];
  private breakoutDetector = new BreakoutDetector();
  private breakoutAlerts$ = new BehaviorSubject<BreakoutAlert[]>([]);

  constructor(private s: string[]) {
    this.dataFetcher = new MarketDataFetcher();
    this.symbols = s;
  }

  startAnalysis() {
    this.symbols.forEach((symbol) => {
      interval(CONFIG.MARKET_ANALYSIS.UPDATE_FREQUENCY)
        .pipe(
          switchMap(() => {
            return from(this.analyzeSymbol(symbol));
          }),
          catchError((error) => {
            return [];
          })
        )
        .subscribe({
          complete: () => {
            console.log(`🏁 Completed analysis stream for ${symbol}`);
          },
          error: (error) => {
            console.error(`💥 Error in analysis stream for ${symbol}:`, error);
          },
        });
    });
  }

  private async analyzeSymbol(symbol: string): Promise<void> {
    const breakoutAlerts: BreakoutAlert[] = [];
    const symbolMetrics: Record<string, MarketMetrics> = {};

    for (const [timeframe, config] of Object.entries(CRYPTO_MARKET_CONFIG.timeframes)) {
      try {
        const marketData = await this.dataFetcher.fetchMarketData(symbol, config.interval, 100); // Adjust limit as needed

        const klines = marketData.klines;
        const closes = klines.map((k) => k.close);
        const volumes = klines.map((k) => k.volume);

        // Calculate comprehensive market metrics
        const priceChange = MarketMetricsCalculator.calculatePriceChange(klines);
        const volatility = MarketMetricsCalculator.calculateVolatility(klines);

        // Calculate drawdown
        const drawdown = this.calculateDrawdown(klines);

        // Calculate momentum across different time horizons
        const momentum = {
          shortTerm: MarketMetricsCalculator.calculateRSI(closes, 14),
          mediumTerm: MarketMetricsCalculator.calculateRSI(closes, 30),
          longTerm: MarketMetricsCalculator.calculateRSI(closes, 90),
        };

        // Volume profile analysis
        const volumeTrend = this.analyzeVolumeTrend(volumes);

        // Bullish signal detection
        const bullishResult = this.detectBullishConditions({
          priceChange,
          volatility,
          momentum,
          closes,
          config,
        });

        // Construct market metrics for this timeframe
        const marketMetrics: MarketMetrics = {
          lastUpdate: Date.now(),
          priceChange,
          volatility,
          drawdown,
          isBullish: bullishResult.isBullish,
          bullishReasons: bullishResult.reasons,
          volumeProfile: {
            value: volumes[volumes.length - 1],
            trend: volumeTrend,
          },
          momentum,
        };

        // Store metrics for the timeframe
        symbolMetrics[timeframe] = marketMetrics;

        // Update global market state
        const currentState = marketState$.getValue();
        marketState$.next({
          ...currentState,
          [symbol]: {
            ...currentState[symbol],
            symbol,
            price: marketData.lastPrice,
            marketCap: marketData.marketCap,
            metrics: {
              ...currentState[symbol]?.metrics,
              [timeframe]: marketMetrics,
            },
          },
        });
      } catch (error) {
        console.error(`Analysis failed for ${symbol} - ${timeframe}:`, error);
      }
    }

    const marketSignal = this.generateOverallMarketSignal(symbol, symbolMetrics);

    if (marketSignal && marketSignal.isValid) {
      this.marketSignals$.next(marketSignal);
    }

    for (const [timeframe, config] of Object.entries(CRYPTO_MARKET_CONFIG.timeframes)) {
      try {
        const marketData = await this.dataFetcher.fetchMarketData(symbol, config.interval, 100);
        const klines = marketData.klines;
        const metrics = symbolMetrics[timeframe];

        // Breakout Detection
        const breakoutAlert = this.breakoutDetector.detectBreakout(symbol, klines, metrics, timeframe);

        if (breakoutAlert) {
          breakoutAlerts.push(breakoutAlert);

          // Trigger custom alert logic
          this.triggerBreakoutAlert(breakoutAlert);
        }
      } catch (error) {
        console.error(`Breakout analysis failed for ${symbol} - ${timeframe}:`, error);
      }
    }

    if (breakoutAlerts.length > 0) {
      const currentAlerts = this.breakoutAlerts$.getValue();
      this.breakoutAlerts$.next([...currentAlerts, ...breakoutAlerts]);
    }
  }

  private triggerBreakoutAlert(alert: BreakoutAlert) {
    console.log(`🚨 Breakout Alert: ${alert.symbol}`, alert);

    // Example of sending to an external service
    this.sendBreakoutAlertToExternalService(alert);
  }

  private async sendBreakoutAlertToExternalService(alert: BreakoutAlert) {
    try {
      await fetch("/api/alerts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(alert),
      });
    } catch (error) {
      console.error("Failed to send breakout alert:", error);
    }
  }

  getBreakoutAlerts$() {
    return this.breakoutAlerts$.asObservable();
  }

  // Helper method to calculate drawdown
  private calculateDrawdown(klines: KlineData[]): number {
    let maxPrice = -Infinity;
    let maxDrawdown = 0;

    for (const kline of klines) {
      maxPrice = Math.max(maxPrice, kline.high);
      const drawdown = ((maxPrice - kline.close) / maxPrice) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    return maxDrawdown;
  }

  // Analyze volume trend
  private analyzeVolumeTrend(volumes: number[]): "increasing" | "decreasing" | "stable" {
    if (volumes.length < 2) return "stable";

    const volumeChanges = volumes.slice(1).map((vol, i) => vol - volumes[i]);
    const avgChange = volumeChanges.reduce((sum, change) => sum + change, 0) / volumeChanges.length;

    const changeThreshold = volumes[0] * 0.05; // 5% threshold

    if (avgChange > changeThreshold) return "increasing";
    if (avgChange < -changeThreshold) return "decreasing";
    return "stable";
  }

  private detectBullishConditions(params: {
    priceChange: number;
    volatility: number;
    momentum: {
      shortTerm: number;
      mediumTerm: number;
      longTerm: number;
    };
    closes: number[];
    config: TimeframeConfig;
  }): {
    isBullish: boolean;
    reasons: string[];
  } {
    const { priceChange, volatility, momentum, config } = params;
    const reasons: string[] = [];

    // Price Change Check
    const isPricePositive = priceChange > config.threshold;
    if (isPricePositive)
      reasons.push(`Price change (${priceChange.toFixed(2)}%) exceeds threshold (${config.threshold}%)`);

    // Volatility Check
    const isLowVolatility = volatility < config.volatilityThreshold;
    if (isLowVolatility)
      reasons.push(`Volatility (${volatility.toFixed(2)}%) below threshold (${config.volatilityThreshold}%)`);

    // Momentum Checks with Detailed Logging
    const momentumChecks = [
      {
        name: "Short-Term",
        value: momentum.shortTerm,
        threshold: CONFIG.MARKET_ANALYSIS.MOMENTUM.SHORT_TERM_RSI_THRESHOLD,
      },
      {
        name: "Medium-Term",
        value: momentum.mediumTerm,
        threshold: CONFIG.MARKET_ANALYSIS.MOMENTUM.MEDIUM_TERM_RSI_THRESHOLD,
      },
      {
        name: "Long-Term",
        value: momentum.longTerm,
        threshold: CONFIG.MARKET_ANALYSIS.MOMENTUM.LONG_TERM_RSI_THRESHOLD,
      },
    ];

    const passedMomentumChecks = momentumChecks.filter((check) => check.value > check.threshold);

    passedMomentumChecks.forEach((check) =>
      reasons.push(`${check.name} Momentum (${check.value.toFixed(2)}) above threshold (${check.threshold})`)
    );

    const momentumConditions = passedMomentumChecks.length >= 2;
    const trendConfirmation = momentumConditions && isPricePositive;
    const riskManagement = isLowVolatility;

    return {
      isBullish: trendConfirmation && riskManagement,
      reasons,
    };
  }

  // Modify volatility profile determination
  private determineVolatilityProfile(strength: number): MarketSignal["volatilityProfile"] {
    const { LOW, MEDIUM, HIGH } = CONFIG.VOLATILITY_PROFILES;

    if (strength < LOW) return "low";
    if (strength < MEDIUM) return "medium";
    if (strength < HIGH) return "high";
    return "extreme";
  }

  private determineTrend(metrics: MarketMetrics): {
    trend: "bullish" | "bearish" | "neutral";
    reasons: string[];
  } {
    // Define detailed trend factors with explicit reasoning
    const trendFactors = [
      // Momentum Checks with Detailed Reasoning
      {
        factor: metrics.momentum.shortTerm > 70 ? 1 : metrics.momentum.shortTerm < 30 ? -1 : 0,
        reason:
          metrics.momentum.shortTerm > 70
            ? `Strong Short-Term Bullish Momentum (RSI: ${metrics.momentum.shortTerm.toFixed(2)})`
            : metrics.momentum.shortTerm < 30
            ? `Weak Short-Term Momentum (RSI: ${metrics.momentum.shortTerm.toFixed(2)})`
            : "Neutral Short-Term Momentum",
      },
      {
        factor: metrics.momentum.mediumTerm > 70 ? 1 : metrics.momentum.mediumTerm < 30 ? -1 : 0,
        reason:
          metrics.momentum.mediumTerm > 70
            ? `Strong Medium-Term Bullish Momentum (RSI: ${metrics.momentum.mediumTerm.toFixed(2)})`
            : metrics.momentum.mediumTerm < 30
            ? `Weak Medium-Term Momentum (RSI: ${metrics.momentum.mediumTerm.toFixed(2)})`
            : "Neutral Medium-Term Momentum",
      },
      {
        factor: metrics.momentum.longTerm > 70 ? 1 : metrics.momentum.longTerm < 30 ? -1 : 0,
        reason:
          metrics.momentum.longTerm > 70
            ? `Strong Long-Term Bullish Momentum (RSI: ${metrics.momentum.longTerm.toFixed(2)})`
            : metrics.momentum.longTerm < 30
            ? `Weak Long-Term Momentum (RSI: ${metrics.momentum.longTerm.toFixed(2)})`
            : "Neutral Long-Term Momentum",
      },

      // Price Change Analysis
      {
        factor: metrics.priceChange > 0 ? 1 : metrics.priceChange < 0 ? -1 : 0,
        reason:
          metrics.priceChange > 0
            ? `Positive Price Change (${(metrics.priceChange * 100).toFixed(2)}%)`
            : metrics.priceChange < 0
            ? `Negative Price Change (${(metrics.priceChange * 100).toFixed(2)}%)`
            : "Neutral Price Movement",
      },

      // Volume Profile Trend
      {
        factor:
          metrics.volumeProfile?.trend === "increasing" ? 1 : metrics.volumeProfile?.trend === "decreasing" ? -1 : 0,
        reason:
          metrics.volumeProfile?.trend === "increasing"
            ? "Increasing Trading Volume (Bullish Signal)"
            : metrics.volumeProfile?.trend === "decreasing"
            ? "Decreasing Trading Volume (Bearish Signal)"
            : "Stable Trading Volume",
      },

      // Bullish Flag Contribution
      {
        factor: metrics.isBullish ? 1 : -1,
        reason: metrics.isBullish
          ? "Overall Market Conditions Indicate Bullish Sentiment"
          : "Overall Market Conditions Suggest Caution",
      },

      // Volatility Consideration
      {
        factor: metrics.volatility < 0.05 ? 1 : metrics.volatility > 0.2 ? -1 : 0,
        reason:
          metrics.volatility < 0.05
            ? `Low Volatility (${(metrics.volatility * 100).toFixed(2)}%) - Stable Market`
            : metrics.volatility > 0.2
            ? `High Volatility (${(metrics.volatility * 100).toFixed(2)}%) - Market Uncertainty`
            : "Moderate Market Volatility",
      },

      // Drawdown Analysis
      {
        factor: metrics.drawdown < 5 ? 1 : metrics.drawdown > 20 ? -1 : 0,
        reason:
          metrics.drawdown < 5
            ? `Low Drawdown (${metrics.drawdown.toFixed(2)}%) - Strong Market Resilience`
            : metrics.drawdown > 20
            ? `Significant Drawdown (${metrics.drawdown.toFixed(2)}%) - Potential Market Weakness`
            : "Moderate Market Drawdown",
      },
    ];

    // Calculate trend score and collect reasons
    const trendAnalysis = trendFactors.reduce(
      (analysis, factor) => {
        analysis.score += factor.factor;
        if (factor.factor !== 0) {
          analysis.reasons.push(factor.reason);
        }
        return analysis;
      },
      { score: 0, reasons: [] as string[] }
    );

    // Determine trend based on score
    let trend: "bullish" | "bearish" | "neutral";
    if (trendAnalysis.score >= 3) {
      trend = "bullish";
    } else if (trendAnalysis.score <= -3) {
      trend = "bearish";
    } else {
      trend = "neutral";
    }

    return {
      trend,
      reasons: trendAnalysis.reasons,
    };
  }

  // In generateOverallMarketSignal method
  private generateOverallMarketSignal(
    symbol: string,
    symbolMetrics: Record<string, MarketMetrics>
  ): MarketSignal | null {
    const bullishTimeframes = Object.entries(symbolMetrics)
      .filter(([_, metrics]) => metrics.isBullish)
      .map(([timeframe, metrics]) => {
        const trend = this.determineTrend(metrics);

        const signal: TimeframeSignal = {
          timeframe,
          strength: metrics.priceChange,
          confirmedAt: metrics.lastUpdate,
          priceAtSignal: metrics.priceChange, // Using priceChange as price at signal
          components: {
            price: metrics.priceChange, // Again, using priceChange as price
            volume: metrics.volumeProfile.value,
            trend,
            priceChangePercent: metrics.priceChange,
          },
        };
        return signal;
      });

    if (bullishTimeframes.length < CONFIG.MARKET_ANALYSIS.TREND_DETECTION.DEFAULT_TIMEFRAMES_FOR_CONFIRMATION)
      return null;

    const overallStrength = bullishTimeframes.reduce((sum, signal) => sum + signal.strength, 0);

    return {
      symbol,
      timestamp: Date.now(),
      signals: bullishTimeframes,
      overallStrength,
      isValid: bullishTimeframes.length >= 2,
      volatilityProfile: this.determineVolatilityProfile(overallStrength),
    };
  }

  getMarketSignals$() {
    return this.marketSignals$.asObservable();
  }

  cleanup() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

import { BehaviorSubject, catchError, from, interval, switchMap } from "rxjs";
import { CONFIG, CRYPTO_MARKET_CONFIG } from "../utils/constants";
import { BreakoutAlert, MarketMetrics, MarketSignal, TimeframeSignal, Trend, TrendReason } from "../utils/types";
import { BreakoutDetector } from "./BreakoutDetector";
import { MarketDataFetcher } from "./MarketDataFetcher";
import { MarketMetricsCalculator } from "./MarketMetricsCalculator";
import { marketState$ } from "./WebSocketService";
import { MarketSignalDetector } from "./MaketSignalDetector";

export class MarketDataService {
  private destroy$ = new BehaviorSubject<void>(undefined);
  private marketSignals$ = new BehaviorSubject<MarketSignal | null>(null);
  private dataFetcher: MarketDataFetcher;
  private symbols: string[];
  private breakoutDetector = new BreakoutDetector();
  private breakoutAlerts$ = new BehaviorSubject<BreakoutAlert[]>([]);

  constructor(s: string[]) {
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

        // Construct market metrics for this timeframe
        const marketMetrics: MarketMetrics = MarketMetricsCalculator.calculateMarketMetrics(klines, config);

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

  static determineTrend(metrics: MarketMetrics): Trend {
    const trendScores = {
      bullish: 0,
      bearish: 0,
    };

    // Momentum Analysis
    if (metrics.momentum.shortTerm > 70) trendScores.bullish += 1;
    if (metrics.momentum.shortTerm < 30) trendScores.bearish += 1;
    if (metrics.momentum.mediumTerm > 70) trendScores.bullish += 1.5;
    if (metrics.momentum.mediumTerm < 30) trendScores.bearish += 1.5;
    if (metrics.momentum.longTerm > 70) trendScores.bullish += 2;
    if (metrics.momentum.longTerm < 30) trendScores.bearish += 2;

    // Volume Profile Analysis
    if (metrics.volumeProfile.trend === "increasing") trendScores.bullish += 1;
    if (metrics.volumeProfile.trend === "decreasing") trendScores.bearish += 1;

    // Price Change Analysis
    if (metrics.priceChange > 0) trendScores.bullish += Math.min(2, metrics.priceChange);
    if (metrics.priceChange < 0) trendScores.bearish += Math.min(2, Math.abs(metrics.priceChange));

    // Volatility Impact
    const volatilityPenalty = metrics.volatility > 0.2 ? 0.5 : 0;
    trendScores.bullish -= volatilityPenalty;
    trendScores.bearish -= volatilityPenalty;

    // Determine Final Trend
    const netScore = trendScores.bullish - trendScores.bearish;
    const reasons: TrendReason[] = [];

    if (netScore > 2) {
      reasons.push("uptrend");
      if (metrics.volumeProfile.trend === "increasing") reasons.push("increasing_volume");
      if (metrics.momentum.shortTerm > 70) reasons.push("short_term_momentum");
      if (metrics.momentum.mediumTerm > 70) reasons.push("medium_term_momentum");
      if (metrics.momentum.longTerm > 70) reasons.push("long_term_momentum");
      return { trend: "bullish", reasons };
    } else if (netScore < -2) {
      reasons.push("downtrend");
      if (metrics.volumeProfile.trend === "decreasing") reasons.push("decreasing_volume");
      if (metrics.momentum.shortTerm < 30) reasons.push("RSI_oversold");
      return { trend: "bearish", reasons };
    } else {
      reasons.push("neutral_trend");
      reasons.push("stable_volume");
      return { trend: "neutral", reasons };
    }
  }

  private generateOverallMarketSignal(
    symbol: string,
    symbolMetrics: Record<string, MarketMetrics>
  ): MarketSignal | null {
    const bullishTimeframes = Object.entries(symbolMetrics)
      .filter(([_, metrics]) => metrics.isBullish)
      .map(([timeframe, metrics]) => {
        const trend = MarketDataService.determineTrend(metrics);

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
      volatilityProfile: MarketSignalDetector.determineVolatilityProfile(overallStrength),
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

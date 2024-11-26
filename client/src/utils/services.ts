import { BehaviorSubject, from, interval } from "rxjs";
import { catchError, switchMap } from "rxjs/operators";
import { BREAKOUT_CONFIG, CONFIG, CRYPTO_MARKET_CONFIG, FUTURES_COINS } from "./constants";
import {
  BreakoutAlert,
  KlineData,
  MarketDataResponse,
  MarketMetrics,
  MarketSignal,
  MarketState,
  TickerData,
  TimeframeConfig,
  TimeframeSignal,
} from "./types";

// Stream subjects
export const connectionStatus$ = new BehaviorSubject<boolean>(false);
export const marketState$ = new BehaviorSubject<Record<string, MarketState>>({});
export const alertStream$ = new BehaviorSubject<any>(null);

// WebSocket Service
export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = CONFIG.WS.MAX_RECONNECT_ATTEMPTS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageQueue: Set<string> = new Set();
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.handleWebSocketMessage = this.handleWebSocketMessage.bind(this);
    this.setupMessageProcessor();
  }

  private setupMessageProcessor() {
    this.processingInterval = setInterval(() => {
      if (this.messageQueue.size > 0) {
        const messages = Array.from(this.messageQueue);
        this.messageQueue.clear();
        messages.forEach((msg) => this.processMessage(JSON.parse(msg)));
      }
    }, CONFIG.MARKET_ANALYSIS.MESSAGE_PROCESSOR_INTERVAL);
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(CONFIG.WS.BASE_URL);

    this.ws.onopen = () => {
      console.log("WebSocket connected");
      connectionStatus$.next(true);
      this.reconnectAttempts = 0;

      // Subscribe to market data streams
      this.subscribe(FUTURES_COINS.map((symbol) => `${symbol.toLowerCase()}@aggTrade`));
    };

    this.ws.onclose = () => {
      console.log("WebSocket disconnected");
      connectionStatus$.next(false);
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.ws?.close();
    };

    this.ws.onmessage = this.handleWebSocketMessage;
  }

  private handleWebSocketMessage(event: MessageEvent) {
    try {
      this.messageQueue.add(event.data);
    } catch (error) {
      console.error("Error queuing WebSocket message:", error);
    }
  }

  private processMessage(data: any) {
    try {
      if (data.error) {
        console.error("WebSocket error:", data.error);
        return;
      }

      const currentState = marketState$.getValue();
      const symbol = data.symbol;

      if (symbol) {
        const updatedState: MarketState = {
          ...currentState[symbol],
          symbol,
          price: parseFloat(data.price),
          volume: parseFloat(data.volume) || currentState[symbol]?.volume || 0,
          metrics: currentState[symbol]?.metrics || {},
        };

        marketState$.next({
          ...currentState,
          [symbol]: updatedState,
        });
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = CONFIG.WS.RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1);

      this.reconnectTimer = setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }, delay);
    }
  }

  subscribe(streams: string[]) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          method: "SUBSCRIBE",
          params: streams,
          id: Date.now(),
        })
      );
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// metrics-calculator.ts
export class MarketMetricsCalculator {
  static calculatePriceChange(klines: KlineData[]): number {
    if (klines.length < 2) return 0;
    const startPrice = klines[0].close;
    const endPrice = klines[klines.length - 1].close;
    return ((endPrice - startPrice) / startPrice) * 100;
  }

  static calculateVolatility(klines: KlineData[]): number {
    const returns = klines.slice(1).map((kline, i) => Math.log(kline.close / klines[i].close));

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

    return Math.sqrt(variance) * Math.sqrt(365) * 100;
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

  static calculateMovingAverage(data: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / period);
    }
    return result;
  }
}

// signal-detector.ts
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

export class MarketDataFetcher {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.REACT_APP_API_BASE_URL || "http://localhost:8080") {
    this.baseUrl = baseUrl;
  }

  private async fetchWithErrorHandling(
    endpoint: string,
    params: Record<string, string | number>
  ): Promise<MarketDataResponse> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value.toString()));

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
      }

      return (await response.json()) as MarketDataResponse;
    } catch (error) {
      console.error("Fetch error:", error);
      throw error;
    }
  }

  async fetchMarketData(symbol: string, interval: string, limit: number = 100): Promise<MarketDataResponse> {
    try {
      const data = await this.fetchWithErrorHandling("/api/klines", {
        symbol: symbol.toUpperCase(),
        interval,
        limit,
      });

      if (!data.klines || !Array.isArray(data.klines)) {
        throw new Error("Invalid klines data received");
      }

      if (typeof data.lastPrice !== "number" || typeof data.marketCap !== "number") {
        throw new Error("Invalid market data received");
      }

      return data;
    } catch (error) {
      console.error(`Failed to fetch market data for ${symbol}:`, error);
      throw error;
    }
  }
  async fetchKlineData(symbol: string, interval: string, limit: number = 100): Promise<KlineData[]> {
    const marketData = await this.fetchMarketData(symbol, interval, limit);
    return marketData.klines;
  }

  async fetchCurrentPrice(symbol: string): Promise<number> {
    const marketData = await this.fetchMarketData(symbol, "1h", 1);
    return marketData.lastPrice;
  }

  async fetchMarketCap(symbol: string): Promise<number> {
    const marketData = await this.fetchMarketData(symbol, "1h", 1);
    return marketData.marketCap;
  }
}

export class AlertService {
  private lastAlerts: Record<string, BreakoutAlert> = {}; // Store last alerts per symbol
  private readonly alertCooldown = BREAKOUT_CONFIG.cooldown; // Alert cooldown in milliseconds

  constructor(private breakoutDetector: BreakoutDetector) {}
  handleAlerts(
    symbol: string,
    klines: KlineData[],
    marketMetrics: MarketMetrics,
    tickerData: TickerData,
    config: TimeframeConfig
  ) {
    // Check if we need to skip alerting based on cooldown
    const lastAlert = this.lastAlerts[symbol];
    const currentTime = Date.now();

    if (lastAlert && currentTime - lastAlert.timestamp < this.alertCooldown) {
      // Skip alert if it's within cooldown period
      return;
    }

    // Check for Breakout Alerts
    const breakoutAlert = this.breakoutDetector.detectBreakout(symbol, klines, marketMetrics, config.interval);
    if (breakoutAlert) {
      this.emitAlert(breakoutAlert);
      return;
    }

    // Check for Bullish Signals if no breakout alert is detected
    const bullishSignal = MarketSignalDetector.detectBullishSignals(klines, config);
    if (bullishSignal) {
      this.emitAlert({
        symbol,
        timestamp: Date.now(),
        breakoutType: "short", // Default to "short" for bullish signals (or adjust as needed)
        currentPrice: tickerData.lastPrice,
        priceAtBreakout: tickerData.lastPrice, // Replace with logic for price at breakout
        percentageMove: bullishSignal.strength, // Use bullish signal strength as percentage
        timeframe: config.interval,
        trend: bullishSignal.strength > 0 ? "bullish" : "bearish", // Assuming positive strength indicates bullish trend
        volumeProfile: {
          current: marketMetrics.volumeProfile.value, // Assuming volume is part of market metrics
          trend: marketMetrics.volumeProfile.trend, // Add volume trend to market metrics
        },
        momentum: {
          shortTerm: marketMetrics.momentum.shortTerm,
          mediumTerm: marketMetrics.momentum.mediumTerm,
          longTerm: marketMetrics.momentum.longTerm,
        },
      });
      return;
    }
  }

  /**
   * Emits the breakout or bullish signal alert to the alert stream.
   * @param alert The alert object to emit.
   */
  private emitAlert(alert: BreakoutAlert | MarketSignal) {
    if ("breakoutType" in alert) {
      // Ensure alert has the correct structure as a BreakoutAlert
      this.lastAlerts[alert.symbol] = alert;
    }
    alertStream$.next(alert);
  }
}

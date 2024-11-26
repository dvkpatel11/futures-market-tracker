import { BehaviorSubject, interval } from "rxjs";
import { catchError, switchMap, takeUntil } from "rxjs/operators";
import { CONFIG, CRYPTO_MARKET_CONFIG, FUTURES_COINS } from "./constants";
import {
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
            trend: "positive",
            priceChangePercent: metrics.priceChangePercent,
          },
        }
      : null;
  }

  static analyzeBullishSignals(signals: TimeframeSignal[]): MarketSignal | null {
    if (signals.length === 0) return null;

    const overallStrength = signals.reduce((sum, signal) => sum + signal.strength, 0);
    const validSignals = signals.filter((signal) => signal.components.trend === "positive");

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

export class MarketDataService {
  private destroy$ = new BehaviorSubject<void>(undefined);
  private marketSignals$ = new BehaviorSubject<MarketSignal | null>(null);
  private dataFetcher: MarketDataFetcher;

  constructor(private symbols: string[], dataFetcher?: MarketDataFetcher) {
    this.dataFetcher = dataFetcher || new MarketDataFetcher();
  }

  startAnalysis() {
    this.symbols.forEach((symbol) => {
      interval(CONFIG.MARKET_ANALYSIS.UPDATE_FREQUENCY)
        .pipe(
          takeUntil(this.destroy$),
          switchMap(() => this.analyzeSymbol(symbol)),
          catchError((error) => {
            console.error(`Analysis error for ${symbol}:`, error);
            return [];
          })
        )
        .subscribe();
    });
  }

  private async analyzeSymbol(symbol: string): Promise<void> {
    const symbolMetrics: Record<string, MarketMetrics> = {};

    for (const [timeframe, config] of Object.entries(CRYPTO_MARKET_CONFIG.timeframes)) {
      try {
        // Fetch market data for the current timeframe
        const marketData = await this.dataFetcher.fetchMarketData(
          symbol,
          config.interval,
          100 // Adjust limit as needed
        );

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
        const isBullish = this.detectBullishConditions({
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
          isBullish,
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

    // Comprehensive market signal generation
    const marketSignal = this.generateOverallMarketSignal(symbol, symbolMetrics);

    if (marketSignal && marketSignal.isValid) {
      this.marketSignals$.next(marketSignal);
    }
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

  // Modify method to use CONFIG constants
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
  }): boolean {
    const { priceChange, volatility, momentum, config } = params;

    const isPricePositive = priceChange > config.threshold;
    const isLowVolatility = volatility < config.volatilityThreshold;

    const momentumConditions =
      momentum.shortTerm > CONFIG.MARKET_ANALYSIS.MOMENTUM.SHORT_TERM_RSI_THRESHOLD &&
      momentum.mediumTerm > CONFIG.MARKET_ANALYSIS.MOMENTUM.MEDIUM_TERM_RSI_THRESHOLD &&
      momentum.longTerm > CONFIG.MARKET_ANALYSIS.MOMENTUM.LONG_TERM_RSI_THRESHOLD;

    const trendConfirmation = momentumConditions && isPricePositive;
    const riskManagement = isLowVolatility;

    return trendConfirmation && riskManagement;
  }

  // Modify volatility profile determination
  private determineVolatilityProfile(strength: number): MarketSignal["volatilityProfile"] {
    const { LOW, MEDIUM, HIGH } = CONFIG.VOLATILITY_PROFILES;

    if (strength < LOW) return "low";
    if (strength < MEDIUM) return "medium";
    if (strength < HIGH) return "high";
    return "extreme";
  }

  private determineTrend(metrics: MarketMetrics): "bullish" | "bearish" | "neutral" {
    const trendFactors = [
      // Price momentum across different time horizons
      metrics.momentum.shortTerm > 70 ? 1 : metrics.momentum.shortTerm < 30 ? -1 : 0,
      metrics.momentum.mediumTerm > 70 ? 1 : metrics.momentum.mediumTerm < 30 ? -1 : 0,
      metrics.momentum.longTerm > 70 ? 1 : metrics.momentum.longTerm < 30 ? -1 : 0,

      // Price change direction
      metrics.priceChange > 0 ? 1 : metrics.priceChange < 0 ? -1 : 0,

      // Volume trend contribution
      metrics.volumeProfile.trend === "increasing" ? 1 : metrics.volumeProfile.trend === "decreasing" ? -1 : 0,

      // Directional bias from isBullish flag
      metrics.isBullish ? 1 : -1,

      // Volatility and drawdown considerations
      metrics.volatility < 0.05 ? 1 : metrics.volatility > 0.2 ? -1 : 0,
      metrics.drawdown < 5 ? 1 : metrics.drawdown > 20 ? -1 : 0,
    ];

    // Calculate trend score
    const trendScore = trendFactors.reduce((sum, factor) => sum + factor, 0);

    // Determine trend based on score
    if (trendScore >= 3) return "bullish";
    if (trendScore <= -3) return "bearish";
    return "neutral";
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

  constructor(baseUrl: string = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000") {
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

      // Comprehensive validation of returned data
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

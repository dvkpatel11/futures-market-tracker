import { BehaviorSubject, interval } from "rxjs";
import { catchError, switchMap, takeUntil } from "rxjs/operators";
import { CRYPTO_MARKET_CONFIG, FUTURES_COINS } from "./constants";
import { KlineData, MarketSignal, MarketState, TimeframeConfig, TimeframeSignal } from "./types";

// Stream subjects
export const connectionStatus$ = new BehaviorSubject<boolean>(false);
export const marketState$ = new BehaviorSubject<Record<string, MarketState>>({});
export const alertStream$ = new BehaviorSubject<any>(null);

// Constants
const WS_RECONNECT_DELAY = 1000;
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const WS_BASE_URL = process.env.REACT_APP_WS_BASE_URL || "ws://localhost:5000";

// WebSocket Service
export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
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
    }, 100); // Process messages every 100ms
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(WS_BASE_URL);

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
      const delay = WS_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1);

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
  static detectBullishSignals(klines: KlineData[], config: TimeframeConfig): TimeframeSignal | null {
    const closes = klines.map((k) => k.close);

    const metrics = {
      priceChange: MarketMetricsCalculator.calculatePriceChange(klines),
      volatility: MarketMetricsCalculator.calculateVolatility(klines),
      rsi: {
        shortTerm: MarketMetricsCalculator.calculateRSI(closes, 14),
        mediumTerm: MarketMetricsCalculator.calculateRSI(closes, 30),
      },
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

  constructor(
    private symbols: string[],
    private dataFetcher: (symbol: string, interval: string) => Promise<KlineData[]>
  ) {}

  startAnalysis() {
    this.symbols.forEach((symbol) => {
      interval(CRYPTO_MARKET_CONFIG.environment.updateFrequency)
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
    const bullishSignals: TimeframeSignal[] = [];

    for (const [timeframe, config] of Object.entries(CRYPTO_MARKET_CONFIG.timeframes)) {
      try {
        const klines = await this.dataFetcher(symbol, config.interval);
        const signal = MarketSignalDetector.detectBullishSignals(klines, config);

        if (signal) {
          bullishSignals.push(signal);
        }
      } catch (error) {
        console.error(`Analysis failed for ${symbol} - ${timeframe}:`, error);
      }
    }

    const marketSignal = MarketSignalDetector.analyzeBullishSignals(bullishSignals);

    if (marketSignal && marketSignal.isValid) {
      this.marketSignals$.next(marketSignal);
    }
  }

  getMarketSignals$() {
    return this.marketSignals$.asObservable();
  }

  cleanup() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

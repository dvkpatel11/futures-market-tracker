import axios from "axios";
import { BehaviorSubject } from "rxjs";
import { CRYPTO_MARKET_CONFIG, FUTURES_COINS, TIMEFRAMES } from "./constants";
import { KlineData, MarketMetrics, MarketSignal, MarketState, TimeframeSignal } from "./types";

export const connectionStatus$ = new BehaviorSubject<boolean>(false);
export const marketState$ = new BehaviorSubject<Record<string, MarketState>>({});

export class MarketDataManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private updateIntervals: NodeJS.Timeout[] = [];

  private readonly WS_URL = process.env.REACT_APP_WS_URL || "ws://localhost:5000";
  private readonly RECONNECT_DELAY = 1000;

  constructor() {
    this.initialize();
  }

  initialize(): void {
    this.connectWebSocket();
    this.setupMetricsUpdates();
    this.setupMomentumDetection();
  }

  private connectWebSocket(): void {
    this.ws = new WebSocket(this.WS_URL);

    this.ws.onopen = () => {
      connectionStatus$.next(true);
      this.subscribeToMarkets(FUTURES_COINS);
    };

    this.ws.onclose = () => {
      connectionStatus$.next(false);
      this.handleReconnect();
    };

    this.ws.onmessage = this.processWebSocketMessage.bind(this);
  }

  private subscribeToMarkets(symbols: string[]): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      symbols.forEach((symbol) => {
        const stream = `${symbol.toLowerCase()}@ticker`;
        this.ws?.send(
          JSON.stringify({
            method: "SUBSCRIBE",
            params: [stream],
            id: Date.now(),
          })
        );
      });
    }
  }

  private processWebSocketMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      this.updateMarketState(data);
    } catch (error) {
      console.error("WebSocket message processing error:", error);
    }
  }

  private updateMarketState(tickerData: any): void {
    const currentState = marketState$.value;
    const symbol = tickerData.s;

    if (symbol) {
      const updatedState: Record<string, MarketState> = {
        ...currentState,
        [symbol]: {
          ...(currentState[symbol] || {}),
          symbol,
          price: parseFloat(tickerData.c),
          volume: parseFloat(tickerData.v),
          marketCap: 0, // You'll need to fetch this separately
        },
      };

      marketState$.next(updatedState);
    }
  }

  private setupMetricsUpdates(): void {
    FUTURES_COINS.forEach((symbol) => {
      Object.keys(TIMEFRAMES).forEach(async (timeframe) => {
        const updateInterval = setInterval(async () => {
          try {
            const metrics = await this.updateMarketMetrics(symbol, timeframe);
            const currentState = marketState$.value;

            marketState$.next({
              ...currentState,
              [symbol]: {
                ...currentState[symbol],
                metrics: {
                  ...(currentState[symbol]?.metrics || {}),
                  [timeframe]: metrics,
                },
              },
            });
          } catch (error) {
            console.error(`Metrics update failed for ${symbol} - ${timeframe}:`, error);
          }
        }, TIMEFRAMES[timeframe].seconds * 1000);

        this.updateIntervals.push(updateInterval);
      });
    });
  }

  private setupMomentumDetection(): void {
    FUTURES_COINS.forEach((symbol) => {
      const detectionInterval = setInterval(async () => {
        try {
          const marketSignal = await this.detectMarketSignals(symbol);
          // You can add additional logic for alerts or signal processing here
        } catch (error) {
          console.error(`Momentum detection failed for ${symbol}:`, error);
        }
      }, CRYPTO_MARKET_CONFIG.environment.updateFrequency);

      this.updateIntervals.push(detectionInterval);
    });
  }

  private async updateMarketMetrics(symbol: string, timeframe: string): Promise<MarketMetrics> {
    const config = TIMEFRAMES[timeframe];
    const klines = await this.fetchKlineData(symbol, config.interval, config.seconds);

    return this.calculateMetrics(klines, config);
  }

  private async fetchKlineData(symbol: string, interval: string, limit: number = 100): Promise<KlineData[]> {
    try {
      const response = await axios.get(`/api/klines`, {
        params: { symbol, interval, limit },
      });

      return response.data.map((kline: any) => ({
        timestamp: kline.timestamp,
        open: parseFloat(kline.open),
        high: parseFloat(kline.high),
        low: parseFloat(kline.low),
        close: parseFloat(kline.close),
        volume: parseFloat(kline.volume),
        price: parseFloat(kline.close),
        marketCap: 0, // Fetch separately if needed
      }));
    } catch (error) {
      console.error(`Failed to fetch klines for ${symbol}:`, error);
      return [];
    }
  }

  private async detectMarketSignals(symbol: string): Promise<MarketSignal> {
    const signals: TimeframeSignal[] = [];
    let overallStrength = 0;

    for (const [timeframe, config] of Object.entries(TIMEFRAMES)) {
      const klines = await this.fetchKlineData(symbol, config.interval, config.seconds);

      const signal = this.analyzeTimeframeSignal(timeframe, klines, config);

      if (signal) {
        signals.push(signal);
        overallStrength += signal.strength * config.volatilityMultiplier;
      }
    }

    return {
      symbol,
      timestamp: Date.now(),
      signals,
      overallStrength,
      isValid: signals.length > 0,
      volatilityProfile: this.determineVolatilityProfile(overallStrength),
    };
  }

  private analyzeTimeframeSignal(timeframe: string, klines: KlineData[], config: any): TimeframeSignal | null {
    const metrics = this.calculateMetrics(klines, config);

    if (metrics.priceChange > config.threshold) {
      return {
        timeframe,
        strength: metrics.priceChange,
        confirmedAt: Date.now(),
        priceAtSignal: klines[klines.length - 1].close,
        components: {
          price: metrics.priceChange,
          volume: metrics.volumeProfile.value,
          trend: metrics.isBullish ? "positive" : "negative",
        },
      };
    }

    return null;
  }

  private calculateMetrics(klines: KlineData[], config: any): MarketMetrics {
    if (!klines.length) {
      return this.getDefaultMetrics();
    }

    const priceChange = this.calculatePriceChange(klines);
    const volatility = this.calculateVolatility(klines);
    const drawdown = this.calculateDrawdown(klines);
    const volumeProfile = this.calculateVolumeProfile(klines);
    const momentum = this.calculateMomentum(klines);

    return {
      lastUpdate: Date.now(),
      priceChange: this.normalizeMetric(priceChange),
      volatility: this.normalizeMetric(volatility * config.volatilityMultiplier),
      drawdown: this.normalizeMetric(drawdown),
      isBullish: this.determineTrend(priceChange, volatility, drawdown, config),
      volumeProfile,
      momentum,
    };
  }

  // Include other calculation methods from the previous MarketMetricsCalculator
  // (calculatePriceChange, calculateVolatility, calculateDrawdown, etc.)

  private determineVolatilityProfile(strength: number): "low" | "medium" | "high" | "extreme" {
    if (strength < 0.2) return "low";
    if (strength < 0.5) return "medium";
    if (strength < 0.8) return "high";
    return "extreme";
  }

  private getDefaultMetrics(): MarketMetrics {
    return {
      lastUpdate: Date.now(),
      priceChange: 0,
      volatility: 0,
      drawdown: 0,
      isBullish: false,
      volumeProfile: {
        value: 0,
        trend: "stable",
      },
      momentum: {
        shortTerm: 50,
        mediumTerm: 50,
        longTerm: 50,
      },
    };
  }

  cleanup(): void {
    this.updateIntervals.forEach(clearInterval);
    this.ws?.close();
  }
}

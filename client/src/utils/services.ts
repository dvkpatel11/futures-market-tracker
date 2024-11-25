import { BehaviorSubject } from "rxjs";
import { CRYPTO_MARKET_CONFIG, FUTURES_COINS, TIMEFRAMES } from "./constants";
import { KlineData, MarketMetrics, MarketSignal, MarketState, TimeframeConfig, TimeframeSignal } from "./types";

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

// Market Data Service
export class MarketDataService {
  private static cache: Map<string, { data: KlineData[]; timestamp: number; price: number; marketCap: number }> =
    new Map();
  private static readonly CACHE_TTL = 30000; // 30 seconds

  static async fetchKlines(symbol: string, interval: string, limit: number = 100): Promise<KlineData[]> {
    const cacheKey = `${symbol}-${interval}-${limit}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const formattedData = data.klines.map((kline: KlineData) => ({
        timestamp: kline.timestamp,
        open: kline.open,
        high: kline.high,
        low: kline.low,
        close: kline.close,
        volume: kline.volume,
      }));

      this.cache.set(cacheKey, { data: formattedData, timestamp: now, price: data.price, marketCap: data.marketCap });
      return formattedData;
    } catch (error) {
      console.error(`Failed to fetch klines for ${symbol}:`, error);
      throw error;
    }
  }

  static async updateMarketMetrics(symbol: string, timeframe: string): Promise<void> {
    try {
      const config = TIMEFRAMES[timeframe];
      if (!config) throw new Error(`Invalid timeframe: ${timeframe}`);

      const klines = await this.fetchKlines(symbol, config.interval);
      const metrics = this.calculateMetrics(klines, config);

      const currentState = marketState$.getValue();
      const symbolState = currentState[symbol] || {
        symbol,
        price: 0,
        volume: 0,
        metrics: {},
      };

      marketState$.next({
        ...currentState,
        [symbol]: {
          ...symbolState,
          metrics: {
            ...symbolState.metrics,
            [timeframe]: metrics,
          },
        },
      });
    } catch (error) {
      console.error(`Failed to update metrics for ${symbol}:`, error);
    }
  }

  private static calculateMetrics(klines: KlineData[], config: (typeof TIMEFRAMES)["5m"]): MarketMetrics {
    const priceChange = this.calculatePriceChange(klines);
    const volatility = this.calculateVolatility(klines, config);
    const drawdown = this.calculateDrawdown(klines);

    return {
      priceChange,
      volatility,
      drawdown,
      isBullish: this.checkBullishConditions(priceChange, drawdown, volatility, config),
      lastUpdate: Date.now(),
    };
  }

  private static calculatePriceChange(klines: KlineData[]): number {
    const startPrice = klines[0].close;
    const endPrice = klines[klines.length - 1].close;
    return ((endPrice - startPrice) / startPrice) * 100;
  }

  private static calculateVolatility(klines: KlineData[], config: (typeof TIMEFRAMES)["5m"]): number {
    const returns = klines.slice(1).map((kline, i) => Math.log(kline.close / klines[i].close));

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

    return Math.sqrt(variance) * Math.sqrt(365) * 100 * config.volatilityMultiplier;
  }

  private static calculateDrawdown(klines: KlineData[]): number {
    let peak = klines[0].high;
    let maxDrawdown = 0;

    klines.forEach((kline) => {
      if (kline.high > peak) peak = kline.high;
      const drawdown = ((peak - kline.low) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    });

    return maxDrawdown;
  }

  private static checkBullishConditions(
    priceChange: number,
    drawdown: number,
    volatility: number,
    config: (typeof TIMEFRAMES)["5m"]
  ): boolean {
    return (
      priceChange > config.threshold &&
      drawdown < config.drawdown &&
      volatility * config.volatilityMultiplier > config.threshold
    );
  }
}

// Market Data Manager
export class MarketDataManager {
  private wsService: WebSocketService;
  private updateIntervals: Record<string, NodeJS.Timeout> = {};
  private lastAlerts: Map<string, number> = new Map();
  private momentumDetector: MomentumDetector;

  constructor() {
    this.wsService = new WebSocketService();
    this.momentumDetector = new MomentumDetector();
  }

  initialize() {
    this.wsService.connect();
    this.setupMetricsUpdates();
    this.setupMomentumDetection();
  }

  private setupMetricsUpdates() {
    Object.values(this.updateIntervals).forEach((interval) => clearInterval(interval));
    this.updateIntervals = {};

    FUTURES_COINS.forEach((symbol) => {
      Object.entries(TIMEFRAMES).forEach(([timeframe, config]) => {
        const updateInterval = Math.floor((config.seconds * 1000) / 2);

        // Initial update
        MarketDataService.updateMarketMetrics(symbol, timeframe);

        // Setup periodic updates
        this.updateIntervals[`${symbol}-${timeframe}`] = setInterval(() => {
          MarketDataService.updateMarketMetrics(symbol, timeframe);
        }, updateInterval);
      });
    });
  }

  private setupMomentumDetection() {
    const { updateFrequency } = CRYPTO_MARKET_CONFIG.environment;

    FUTURES_COINS.forEach((symbol) => {
      setInterval(async () => {
        try {
          const momentum = await this.momentumDetector.analyzeMarketConditions(symbol);
          const currentState = marketState$.getValue();

          marketState$.next({
            ...currentState,
            [symbol]: {
              ...currentState[symbol],
              momentum,
            },
          });

          if (this.shouldTriggerAlert(momentum, currentState[symbol])) {
            this.emitAlert(symbol, momentum);
          }
        } catch (error) {
          console.error(`Error detecting momentum for ${symbol}:`, error);
        }
      }, updateFrequency);
    });
  }

  private shouldTriggerAlert(momentum: MarketSignal, currentState: MarketState): boolean {
    const { alerting } = CRYPTO_MARKET_CONFIG;
    const lastAlert = this.lastAlerts.get(momentum.symbol);
    const now = Date.now();

    return (
      momentum.isValid &&
      momentum.overallStrength >= alerting.minOverallStrength &&
      (!lastAlert || now - lastAlert >= alerting.alertCooldown) &&
      Math.abs(currentState.metrics["5m"]?.priceChange || 0) >= alerting.priceChangeThreshold
    );
  }

  private emitAlert(symbol: string, momentum: MarketSignal) {
    this.lastAlerts.set(symbol, Date.now());
    alertStream$.next({
      symbol,
      timestamp: Date.now(),
      momentum,
      type: momentum.overallStrength > 0.9 ? "strong" : "moderate",
    });
  }

  cleanup() {
    Object.values(this.updateIntervals).forEach((interval) => clearInterval(interval));
    this.updateIntervals = {};
    this.wsService.disconnect();
  }
}

// Momentum Detector
class MomentumDetector {
  private readonly config: typeof CRYPTO_MARKET_CONFIG;
  private lastVolatilityCheck: number = 0;
  private currentVolatilityProfile: "low" | "medium" | "high" | "extreme" = "medium";

  constructor(config = CRYPTO_MARKET_CONFIG) {
    this.config = config;
  }

  async analyzeMarketConditions(symbol: string): Promise<MarketSignal> {
    const signals: TimeframeSignal[] = [];
    let overallStrength = 0;

    await this.updateVolatilityProfile(symbol);

    for (const [timeframe, config] of Object.entries(this.config.timeframes)) {
      const klines = await MarketDataService.fetchKlines(symbol, config.interval, config.seconds);

      const signal = this.analyzeTimeframe(timeframe, klines, config);

      if (signal) {
        signals.push(signal);
        overallStrength += signal.strength * config.volatilityMultiplier; // Adjusting strength by volatilityMultiplier
      }
    }

    const hasRequiredTimeframes = this.config.alerting.requiredTimeframes.every((timeframe) =>
      signals.some((s) => s.timeframe === timeframe)
    );

    return {
      symbol,
      timestamp: Date.now(),
      signals,
      overallStrength,
      isValid: hasRequiredTimeframes && overallStrength >= this.config.alerting.minOverallStrength,
      volatilityProfile: this.currentVolatilityProfile,
    };
  }

  private async updateVolatilityProfile(symbol: string): Promise<void> {
    const now = Date.now();
    if (now - this.lastVolatilityCheck < this.config.environment.updateFrequency) {
      return;
    }

    const klines = await MarketDataService.fetchKlines(symbol, "1d", 30);
    const volatility = this.calculateMarketVolatility(klines);
    this.currentVolatilityProfile = this.determineVolatilityProfile(volatility);
    this.lastVolatilityCheck = now;
  }

  private calculateMarketVolatility(klines: KlineData[]): number {
    const returns = klines.slice(1).map((kline, i) => Math.log(kline.close / klines[i].close));

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

    return Math.sqrt(variance) * Math.sqrt(365) * 100; // Annualized volatility
  }

  private determineVolatilityProfile(volatility: number): "low" | "medium" | "high" | "extreme" {
    if (
      volatility <
      this.config.volatilityAdjustment.thresholdMultipliers.low * this.config.environment.baseVolatility
    ) {
      return "low";
    } else if (
      volatility <
      this.config.volatilityAdjustment.thresholdMultipliers.medium * this.config.environment.baseVolatility
    ) {
      return "medium";
    } else if (
      volatility <
      this.config.volatilityAdjustment.thresholdMultipliers.high * this.config.environment.baseVolatility
    ) {
      return "high";
    } else {
      return "extreme";
    }
  }

  private analyzeTimeframe(timeframe: string, klines: KlineData[], config: TimeframeConfig): TimeframeSignal | null {
    const priceStrength = this.calculatePriceStrength(klines, config.threshold);
    const volumeStrength = this.calculateVolumeStrength(klines);
    const trend = this.calculateTrend(priceStrength, volumeStrength);

    const signalStrength = priceStrength * config.volatilityMultiplier + volumeStrength * config.volatilityMultiplier;

    if (signalStrength >= config.threshold) {
      // Assuming you have access to the price at the time of the signal (using the first and last kline)
      const priceAtSignal = klines[klines.length - 1].close;

      const components = {
        price: priceStrength,
        volume: volumeStrength,
        trend: trend,
      };

      return {
        timeframe,
        strength: signalStrength,
        confirmedAt: Date.now(),
        priceAtSignal: priceAtSignal,
        components: components,
      };
    }

    return null;
  }

  private calculatePriceStrength(klines: KlineData[], threshold: number): number {
    const priceChange = this.calculatePriceChange(klines);

    // Ensure price change is above threshold for strength
    return priceChange >= threshold ? priceChange : 0;
  }

  private calculateVolumeStrength(klines: KlineData[]): number {
    const totalVolume = klines.reduce((sum, kline) => sum + kline.volume, 0);

    // Example logic for volume strength based on significant change
    return totalVolume >
      (this.config.indicators.volumeProfile.significantChange * totalVolume) /
        this.config.indicators.volumeProfile.lookbackPeriods
      ? totalVolume
      : 0;
  }

  private calculateTrend(priceStrength: number, volumeStrength: number): string {
    if (priceStrength > 0 && volumeStrength > 0) {
      return "positive";
    }
    if (priceStrength < 0 && volumeStrength < 0) {
      return "negative";
    }

    return "neutral";
  }

  private calculatePriceChange(klines: KlineData[]): number {
    const startPrice = klines[0].close;
    const endPrice = klines[klines.length - 1].close;

    return ((endPrice - startPrice) / startPrice) * 100; // Percentage change
  }
}

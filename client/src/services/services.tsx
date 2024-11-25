// types.ts
export interface KlineData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TimeframeConfig {
  seconds: number;
  threshold: number;
  drawdown: number;
  interval: string;
  volatilityMultiplier: number;
}

export interface MarketMetrics {
  priceChange: number;
  volatility: number;
  drawdown: number;
  isBullish: boolean;
  lastUpdate: number;
}

export interface MarketState {
  symbol: string;
  price: number;
  volume: number;
  metrics: Record<string, MarketMetrics>;
}

// constants.ts
export const TIMEFRAMES: Record<string, TimeframeConfig> = {
  "5m": { seconds: 300, threshold: 2, drawdown: 5, interval: "5m", volatilityMultiplier: 1.2 },
  "1h": { seconds: 3600, threshold: 5, drawdown: 7, interval: "1h", volatilityMultiplier: 1.5 },
  "2h": { seconds: 7200, threshold: 10, drawdown: 10, interval: "2h", volatilityMultiplier: 1.8 },
  "4h": { seconds: 14400, threshold: 15, drawdown: 12, interval: "4h", volatilityMultiplier: 2.0 },
  "1d": { seconds: 86400, threshold: 20, drawdown: 25, interval: "1d", volatilityMultiplier: 3.0 },
};

export const FUTURES_COINS = ["BTCUSDT", "ETHUSDT", "LTCUSDT", "XRPUSDT"];

// binanceAPI.ts
export class BinanceAPIService {
  private static baseUrl = "https://fapi.binance.com/fapi/v1";
  private static rateLimiter = {
    requests: 0,
    lastReset: Date.now(),
    limit: 1200, // Binance futures API limit per minute
    resetInterval: 60000,
  };

  private static async checkRateLimit(): Promise<void> {
    const now = Date.now();
    if (now - this.rateLimiter.lastReset >= this.rateLimiter.resetInterval) {
      this.rateLimiter.requests = 0;
      this.rateLimiter.lastReset = now;
    }
    if (this.rateLimiter.requests >= this.rateLimiter.limit) {
      throw new Error("Rate limit exceeded");
    }
    this.rateLimiter.requests++;
  }

  static async fetchKlines(symbol: string, interval: string, limit: number = 100): Promise<KlineData[]> {
    await this.checkRateLimit();

    try {
      const response = await fetch(`${this.baseUrl}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.map(this.formatKlineData);
    } catch (error) {
      console.error(`Failed to fetch klines for ${symbol}:`, error);
      throw error;
    }
  }

  private static formatKlineData(kline: any[]): KlineData {
    return {
      timestamp: kline[0],
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5]),
    };
  }
}

// websocket.ts
export class BinanceWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageQueue: any[] = [];
  private processingInterval: NodeJS.Timeout | undefined;

  constructor(private onMessage: (data: any) => void, private onStatusChange: (status: boolean) => void) {
    this.initMessageProcessor();
  }

  private initMessageProcessor() {
    this.processingInterval = setInterval(() => {
      if (this.messageQueue.length > 0) {
        const messages = this.messageQueue.splice(0, 10); // Process 10 messages at a time
        messages.forEach((msg) => this.onMessage(msg));
      }
    }, 100);
  }

  connect(symbols: string[]) {
    const streams = symbols.map((s) => `${s.toLowerCase()}@aggTrade/${s.toLowerCase()}@kline_1m`).join("/");

    const url = `wss://fstream.binance.com/stream?streams=${streams}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.onStatusChange(true);
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.messageQueue.push(data);
    };

    this.ws.onclose = () => {
      this.onStatusChange(false);
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.ws?.close();
    };
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      setTimeout(() => this.connect(FUTURES_COINS), delay);
    }
  }

  close() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// analysis.ts
export class MarketAnalysisService {
  static calculateMetrics(klines: KlineData[], timeframe: string): MarketMetrics {
    const config = TIMEFRAMES[timeframe];
    if (!config || klines.length < 2) {
      throw new Error("Invalid timeframe or insufficient data");
    }

    const priceChange = this.calculatePriceChange(klines);
    const volatility = this.calculateVolatility(klines, timeframe);
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

  private static calculateVolatility(klines: KlineData[], timeframe: string, period: number = 14): number {
    const returns = klines
      .slice(-period)
      .map((kline, i, arr) => (i > 0 ? Math.log(kline.close / arr[i - 1].close) : 0))
      .slice(1);

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

    const baseVolatility = Math.sqrt(variance) * Math.sqrt(365) * 100;
    return baseVolatility * (TIMEFRAMES[timeframe]?.volatilityMultiplier || 1);
  }

  private static calculateDrawdown(klines: KlineData[]): number {
    let peak = klines[0].high;
    let maxDrawdown = 0;

    klines.forEach((kline) => {
      if (kline.high > peak) {
        peak = kline.high;
      }
      const drawdown = ((peak - kline.low) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    });

    return maxDrawdown;
  }

  private static checkBullishConditions(
    priceChange: number,
    drawdown: number,
    volatility: number,
    config: TimeframeConfig
  ): boolean {
    return (
      priceChange > config.threshold &&
      drawdown < config.drawdown &&
      volatility * config.volatilityMultiplier > config.threshold
    );
  }
}

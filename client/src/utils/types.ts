// types.ts
export interface MarketDataResponse extends TickerData {
  klines: KlineData[];
}

export interface KlineData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TickerData {
  symbol: string;
  lastPrice: number;
  marketCap: number;
  priceChangePercent: number;
  high: number;
  low: number;
}

export interface MarketSignal {
  symbol: string;
  timestamp: number;
  signals: TimeframeSignal[];
  overallStrength: number;
  isValid: boolean;
  volatilityProfile: "low" | "medium" | "high" | "extreme";
}

export interface TimeframeSignal {
  timeframe: string;
  strength: number;
  confirmedAt: number;
  priceAtSignal: number;
  components: {
    price: number;
    volume: number;
    trend: string;
    priceChangePercent: number;
  };
}

export interface MarketState {
  symbol: string;
  price: number;
  marketCap: number;
  volume: number;
  metrics: Record<string, MarketMetrics>;
  momentum?: MarketSignal;
}

export interface MarketMetrics {
  lastUpdate: number;
  priceChange: number;
  volatility: number;
  drawdown: number;
  isBullish: boolean;
  volumeProfile: {
    value: number;
    trend: "increasing" | "decreasing" | "stable";
  };
  momentum: {
    shortTerm: number;
    mediumTerm: number;
    longTerm: number;
  };
}

export interface TimeframeConfig {
  interval: string;
  seconds: number;
  threshold: number;
  volatilityMultiplier: number;
  volatilityThreshold: number;
  maxDrawdown: number;
}
export interface TimeframeSignalConfig {
  minStrength: number; // minimum signal strength to consider (0-1)
  weightInSignal: number; // importance in overall signal (0-1)
  minimumCandles: number; // minimum candles needed for valid signal
  volatilityWeight: number; // how much volatility impacts signal
  volumeWeight: number; // how much volume impacts signal
  trendWeight: number; // how much trend impacts signal
}

export interface AlertConfig {
  minOverallStrength: number; // minimum combined signal strength
  requiredTimeframes: string[]; // timeframes that must confirm
  alertCooldown: number; // milliseconds between alerts
  priceChangeThreshold: number; // minimum price change to trigger
}

export interface MarketConfig {
  environment: {
    name: string;
    volatilityProfile: "low" | "medium" | "high" | "extreme";
    baseVolatility: number;
    updateFrequency: number;
  };
  timeframes: Record<string, TimeframeConfig>;
  alerting: AlertConfig;
  volatilityAdjustment: {
    thresholdMultipliers: {
      low: number;
      medium: number;
      high: number;
      extreme: number;
    };
    lookbackPeriods: Record<string, number>;
  };
}

// types.ts
export interface KlineData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  price: number;
  marketCap: number;
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

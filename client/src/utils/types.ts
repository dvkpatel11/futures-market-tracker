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

export interface TimeframeConfig {
  seconds: number;
  threshold: number;
  drawdown: number;
  interval: string;
  volatilityMultiplier: number;
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
  volume: number;
  metrics: Record<string, MarketMetrics>;
  momentum?: MarketSignal;
}

export interface MarketMetrics {
  priceChange: number;
  volatility: number;
  drawdown: number;
  isBullish: boolean;
  lastUpdate: number;
}

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

export type TrendReason =
  | "bullish_candlestick"
  | "bearish_candlestick"
  | "price_increase"
  | "price_decrease"
  | "strong_volume"
  | "weak_volume"
  | "momentum_shift"
  | "RSI_overbought"
  | "RSI_oversold"
  | "RSI_stable"
  | "uptrend"
  | "downtrend"
  | "sideways_trend"
  | "significant_price_change"
  | "high_volatility"
  | "low_volatility"
  | "drawdown_high"
  | "drawdown_low"
  | "short_term_momentum"
  | "medium_term_momentum"
  | "long_term_momentum"
  | "increasing_volume"
  | "decreasing_volume"
  | "stable_volume"
  | "uptrend_support"
  | "downtrend_support"
  | "neutral_trend"
  | "recent_price_change";

export interface Trend {
  trend: "bullish" | "bearish" | "neutral";
  reasons: TrendReason[];
}

export interface MarketSignal {
  symbol: string;
  timestamp: number;
  signals: TimeframeSignal[];
  overallStrength: number;
  isValid: boolean;
  volatilityProfile: "low" | "medium" | "high" | "extreme";
  trendConsistency: number;
  overallTrend: Trend["trend"];
}

export interface TimeframeSignal {
  timeframe: string;
  strength: number;
  confirmedAt: number;
  priceAtSignal: number;
  components: {
    price: number;
    volume: number;
    trend: Trend;
    priceChangePercent: number;
  };
}

export interface MarketState {
  symbol: string;
  price: number;
  marketCap: number;
  volume: number;
  metrics: Record<string, MarketMetrics>;
  marketSignal?: MarketSignal;
}

export interface MarketMetrics {
  lastUpdate: number;
  priceChange: number;
  volatility: number;
  drawdown: number;
  volumeProfile: {
    value: number;
    trend: "increasing" | "decreasing" | "stable";
  };
  momentum: {
    shortTerm: number; // RSI (0-100) for the short-term timeframe (e.g., 5m or 1h). Indicates quick momentum shifts and recent price behavior.
    mediumTerm: number; // RSI (0-100) for the medium-term timeframe (e.g., 4h or 1d). Reflects broader price trends and momentum over an intermediate period.
    longTerm: number; // RSI (0-100) for the long-term timeframe (e.g., 1d, weekly). Shows overall market momentum and helps identify long-term trend direction.
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
  minStrength: number; // Minimum signal strength (0-1)
  weightInSignal: number; // Weight in overall signal (0-1)
  minimumCandles: number; // Candles needed for validity
  volatilityWeight: number; // Impact of volatility on signal
  volumeWeight: number; // Impact of volume on signal
  trendWeight: number; // Impact of trend on signal
}

export interface AlertConfig {
  minOverallStrength: number; // Combined signal strength threshold
  requiredTimeframes: string[]; // Mandatory timeframes for validation
  alertCooldown: number; // Time in ms before next alert
  priceChangeThreshold: number; // % price change to trigger alert
}

export interface MarketConfig {
  environment: {
    name: string;
    volatilityProfile: "low" | "medium" | "high" | "extreme";
    baseVolatility: number; // Base volatility for classification
    updateFrequency: number; // Time in ms between updates
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

export interface BreakoutConfig {
  thresholds: {
    short: number; // e.g., 3%
    medium: number; // e.g., 5%
    large: number; // e.g., 7%
    extreme: number; // e.g., 10%
  };
  timeframes: string[]; // Monitored timeframes
  cooldown: number; // Cooldown time in ms
  volumeMultiplier: number; // Volume confirmation multiplier
  volatilityExpansionThreshold: number;
}

export interface BreakoutAlert {
  symbol: string;
  timestamp: number;
  breakoutType: "short" | "medium" | "large" | "extreme" | null;
  currentPrice: number; // Price at breakout detection
  priceAtBreakout: number; // Price at breakout start
  percentageMove: number; // % move since breakout
  timeframe: string; // Timeframe for breakout
  direction: "bullish" | "bearish";
  trend: Trend;
  volumeProfile: {
    current: number; // Current volume
    trend: "increasing" | "decreasing" | "stable";
  };
  momentum: {
    shortTerm: number; // RSI (0-100) for the short-term timeframe (e.g., 5m or 1h). Indicates quick momentum shifts and recent price behavior.
    mediumTerm: number; // RSI (0-100) for the medium-term timeframe (e.g., 4h or 1d). Reflects broader price trends and momentum over an intermediate period.
    longTerm: number; // RSI (0-100) for the long-term timeframe (e.g., 1d, weekly). Shows overall market momentum and helps identify long-term trend direction.
  };
}

import { TimeframeConfig } from "./types";

interface MarketEnvironment {
  name: string;
  volatilityProfile: "low" | "medium" | "high" | "extreme";
  baseVolatility: number; // baseline daily volatility expectation
  updateFrequency: number; // milliseconds
}

interface TimeframeSignalConfig {
  minStrength: number; // minimum signal strength to consider (0-1)
  weightInSignal: number; // importance in overall signal (0-1)
  minimumCandles: number; // minimum candles needed for valid signal
  volatilityWeight: number; // how much volatility impacts signal
  volumeWeight: number; // how much volume impacts signal
  trendWeight: number; // how much trend impacts signal
}

interface AlertConfig {
  minOverallStrength: number; // minimum combined signal strength
  requiredTimeframes: string[]; // timeframes that must confirm
  alertCooldown: number; // milliseconds between alerts
  priceChangeThreshold: number; // minimum price change to trigger
}

export const CRYPTO_MARKET_CONFIG = {
  environment: {
    name: "Crypto",
    volatilityProfile: "extreme" as const,
    baseVolatility: 0.03, // 3% daily volatility baseline
    updateFrequency: 30000, // 30 seconds
  },

  timeframes: {
    "5m": {
      seconds: 300,
      threshold: 0.3, // 0.3% minimum move
      drawdown: 0.8, // 0.8% maximum drawdown
      interval: "5m",
      volatilityMultiplier: 1.2,
      signalConfig: {
        minStrength: 0.6,
        weightInSignal: 0.1, // 10% weight in overall signal
        minimumCandles: 10,
        volatilityWeight: 0.3,
        volumeWeight: 0.3,
        trendWeight: 0.4,
      },
    },
    "1h": {
      seconds: 3600,
      threshold: 0.8,
      drawdown: 1.5,
      interval: "1h",
      volatilityMultiplier: 1.5,
      signalConfig: {
        minStrength: 0.65,
        weightInSignal: 0.15, // 15% weight
        minimumCandles: 24,
        volatilityWeight: 0.35,
        volumeWeight: 0.25,
        trendWeight: 0.4,
      },
    },
    "2h": {
      seconds: 7200,
      threshold: 1.2,
      drawdown: 2,
      interval: "2h",
      volatilityMultiplier: 1.8,
      signalConfig: {
        minStrength: 0.7,
        weightInSignal: 0.2, // 20% weight
        minimumCandles: 24,
        volatilityWeight: 0.4,
        volumeWeight: 0.2,
        trendWeight: 0.4,
      },
    },
    "4h": {
      seconds: 14400,
      threshold: 1.5,
      drawdown: 2.5,
      interval: "4h",
      volatilityMultiplier: 2.0,
      signalConfig: {
        minStrength: 0.75,
        weightInSignal: 0.25, // 25% weight
        minimumCandles: 30,
        volatilityWeight: 0.4,
        volumeWeight: 0.2,
        trendWeight: 0.4,
      },
    },
    "1d": {
      seconds: 86400,
      threshold: 2.5,
      drawdown: 4,
      interval: "1d",
      volatilityMultiplier: 3.0,
      signalConfig: {
        minStrength: 0.8,
        weightInSignal: 0.3, // 30% weight
        minimumCandles: 30,
        volatilityWeight: 0.45,
        volumeWeight: 0.15,
        trendWeight: 0.4,
      },
    },
  },

  alerting: {
    minOverallStrength: 0.75, // 75% overall signal strength required
    requiredTimeframes: ["5m", "1h", "2h"], // minimum timeframes needed
    alertCooldown: 1800000, // 30 minutes between alerts
    priceChangeThreshold: 0.5, // 0.5% minimum price change to trigger new alert
  },

  volatilityAdjustment: {
    // Adjust thresholds based on current market volatility
    thresholdMultipliers: {
      low: 0.7, // Lower thresholds in low volatility
      medium: 1.0, // Base case
      high: 1.3, // Higher thresholds in high volatility
      extreme: 1.5, // Much higher thresholds in extreme volatility
    },
    // Periods to look back for volatility calculation
    lookbackPeriods: {
      "5m": 288, // 24 hours
      "1h": 168, // 7 days
      "2h": 168, // 14 days
      "4h": 180, // 30 days
      "1d": 30, // 30 days
    },
  },

  // Technical indicators configuration
  indicators: {
    rsi: {
      period: 14,
      overbought: 70,
      oversold: 30,
    },
    macd: {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
    },
    volumeProfile: {
      significantChange: 1.5, // 150% of average volume
      lookbackPeriods: 20,
    },
  },
};

export const TIMEFRAMES: Record<string, TimeframeConfig> = {
  "5m": { seconds: 300, threshold: 2, drawdown: 5, interval: "5m", volatilityMultiplier: 1.2 },
  "1h": { seconds: 3600, threshold: 5, drawdown: 7, interval: "1h", volatilityMultiplier: 1.5 },
  "2h": { seconds: 7200, threshold: 10, drawdown: 10, interval: "2h", volatilityMultiplier: 1.8 },
  "4h": { seconds: 14400, threshold: 15, drawdown: 12, interval: "4h", volatilityMultiplier: 2.0 },
  "1d": { seconds: 86400, threshold: 20, drawdown: 25, interval: "1d", volatilityMultiplier: 3.0 },
};

export const FUTURES_COINS = ["BTCUSDT", "ETHUSDT", "LTCUSDT", "XRPUSDT"];

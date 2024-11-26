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
    volatilityProfile: "high" as const, // Changed from extreme to high as default
    baseVolatility: 0.02, // 2% daily volatility baseline (more realistic)
    updateFrequency: 15000, // 15 seconds (faster updates for crypto)
  },

  timeframes: {
    "5m": {
      seconds: 300,
      threshold: 0.25, // 0.25% minimum move (more realistic)
      drawdown: 0.5, // 0.5% maximum drawdown
      interval: "5m",
      volatilityMultiplier: 1.2,
      signalConfig: {
        minStrength: 0.65,
        weightInSignal: 0.15, // Increased from 0.1
        minimumCandles: 12, // Reduced from 24
        volatilityWeight: 0.35,
        volumeWeight: 0.35, // Increased volume importance
        trendWeight: 0.3, // Reduced trend weight
      },
    },
    "1h": {
      seconds: 3600,
      threshold: 0.6, // Reduced from 0.8
      drawdown: 1.2, // Reduced from 1.5
      interval: "1h",
      volatilityMultiplier: 1.5,
      signalConfig: {
        minStrength: 0.7,
        weightInSignal: 0.25, // Increased importance
        minimumCandles: 24,
        volatilityWeight: 0.35,
        volumeWeight: 0.35,
        trendWeight: 0.3,
      },
    },
    "4h": {
      seconds: 14400,
      threshold: 1.2,
      drawdown: 2.0,
      interval: "4h",
      volatilityMultiplier: 2.0,
      signalConfig: {
        minStrength: 0.75,
        weightInSignal: 0.3,
        minimumCandles: 24,
        volatilityWeight: 0.35,
        volumeWeight: 0.35,
        trendWeight: 0.3,
      },
    },
    "1d": {
      seconds: 86400,
      threshold: 2.0, // Reduced from 2.5
      drawdown: 3.0, // Reduced from 4.0
      interval: "1d",
      volatilityMultiplier: 2.5, // Reduced from 3.0
      signalConfig: {
        minStrength: 0.8,
        weightInSignal: 0.3,
        minimumCandles: 30,
        volatilityWeight: 0.4,
        volumeWeight: 0.3,
        trendWeight: 0.3,
      },
    },
  },

  alerting: {
    minOverallStrength: 0.7, // Reduced from 0.75 for more signals
    requiredTimeframes: ["5m", "1h"], // Reduced required timeframes
    alertCooldown: 900000, // 15 minutes (reduced from 30)
    priceChangeThreshold: 0.3, // Reduced from 0.5%
  },

  volatilityAdjustment: {
    thresholdMultipliers: {
      low: 0.8, // Increased from 0.7
      medium: 1.0,
      high: 1.2, // Reduced from 1.3
      extreme: 1.3, // Reduced from 1.5
    },
    lookbackPeriods: {
      "5m": 144, // 12 hours (reduced from 24)
      "1h": 72, // 3 days (reduced from 7)
      "4h": 90, // 15 days (reduced from 30)
      "1d": 20, // 20 days (reduced from 30)
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

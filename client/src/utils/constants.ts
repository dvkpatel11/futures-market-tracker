import { MarketConfig } from "./types";

export const CRYPTO_MARKET_CONFIG: MarketConfig = {
  environment: {
    name: "Crypto",
    volatilityProfile: "high",
    baseVolatility: 0.02,
    updateFrequency: 15000,
  },

  timeframes: {
    "5m": {
      seconds: 300,
      threshold: 0.25,
      volatilityMultiplier: 1.2,
      volatilityThreshold: 0.5,
      maxDrawdown: 0.5,
      interval: "5m",
    },
    "1h": {
      seconds: 3600,
      threshold: 0.6,
      volatilityMultiplier: 1.5,
      volatilityThreshold: 1.0,
      maxDrawdown: 1.2,
      interval: "1h",
    },
    "4h": {
      seconds: 14400,
      threshold: 1.2,
      volatilityMultiplier: 2.0,
      volatilityThreshold: 1.5,
      maxDrawdown: 2.0,
      interval: "4h",
    },
    "1d": {
      seconds: 86400,
      threshold: 2.0,
      volatilityMultiplier: 2.5,
      volatilityThreshold: 2.5,
      maxDrawdown: 3.0,
      interval: "1d",
    },
  },

  alerting: {
    minOverallStrength: 0.7,
    requiredTimeframes: ["5m", "1h"],
    alertCooldown: 900000,
    priceChangeThreshold: 0.3,
  },

  volatilityAdjustment: {
    thresholdMultipliers: {
      low: 0.8,
      medium: 1.0,
      high: 1.2,
      extreme: 1.3,
    },
    lookbackPeriods: {
      "5m": 144,
      "1h": 72,
      "4h": 90,
      "1d": 20,
    },
  },
};

export const FUTURES_COINS = ["BTCUSDT", "ETHUSDT", "LTCUSDT", "XRPUSDT"];

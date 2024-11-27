import { BREAKOUT_CONFIG } from "../utils/constants";
import { BreakoutAlert, KlineData, MarketMetrics, MarketSignal, TickerData, TimeframeConfig } from "../utils/types";
import { BreakoutDetector } from "./BreakoutDetector";
import { MarketSignalDetector } from "./MaketSignalDetector";
import { alertStream$ } from "./WebSocketService";

export class AlertService {
  private lastAlerts: Record<string, BreakoutAlert> = {}; // Store last alerts per symbol
  private readonly alertCooldown = BREAKOUT_CONFIG.cooldown; // Alert cooldown in milliseconds

  constructor(private breakoutDetector: BreakoutDetector) {}
  handleAlerts(
    symbol: string,
    klines: KlineData[],
    marketMetrics: MarketMetrics,
    tickerData: TickerData,
    config: TimeframeConfig
  ) {
    // Check if we need to skip alerting based on cooldown
    const lastAlert = this.lastAlerts[symbol];
    const currentTime = Date.now();

    if (lastAlert && currentTime - lastAlert.timestamp < this.alertCooldown) {
      // Skip alert if it's within cooldown period
      return;
    }

    // Check for Breakout Alerts
    const breakoutAlert = this.breakoutDetector.detectBreakout(symbol, klines, marketMetrics, config.interval);
    if (breakoutAlert) {
      this.emitAlert(breakoutAlert);
      return;
    }

    // Check for Bullish Signals if no breakout alert is detected
    const bullishSignal = MarketSignalDetector.detectBullishSignals(klines, config);
    if (bullishSignal) {
      this.emitAlert({
        symbol,
        timestamp: Date.now(),
        breakoutType: "short", // Default to "short" for bullish signals (or adjust as needed)
        currentPrice: tickerData.lastPrice,
        priceAtBreakout: tickerData.lastPrice, // Replace with logic for price at breakout
        percentageMove: bullishSignal.strength, // Use bullish signal strength as percentage
        timeframe: config.interval,
        trend: bullishSignal.strength > 0 ? "bullish" : "bearish", // Assuming positive strength indicates bullish trend
        volumeProfile: {
          current: marketMetrics.volumeProfile.value, // Assuming volume is part of market metrics
          trend: marketMetrics.volumeProfile.trend, // Add volume trend to market metrics
        },
        momentum: {
          shortTerm: marketMetrics.momentum.shortTerm,
          mediumTerm: marketMetrics.momentum.mediumTerm,
          longTerm: marketMetrics.momentum.longTerm,
        },
      });
      return;
    }
  }

  /**
   * Emits the breakout or bullish signal alert to the alert stream.
   * @param alert The alert object to emit.
   */
  private emitAlert(alert: BreakoutAlert | MarketSignal) {
    if ("breakoutType" in alert) {
      // Ensure alert has the correct structure as a BreakoutAlert
      this.lastAlerts[alert.symbol] = alert;
    }
    alertStream$.next(alert);
  }
}

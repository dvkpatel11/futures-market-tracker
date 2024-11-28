import { BehaviorSubject, Observable } from "rxjs";
import {
  BreakoutAlert,
  KlineData,
  MarketMetrics,
  MarketSignal,
  TimeframeConfig,
  TimeframeSignal,
} from "../utils/types";
import { BreakoutDetector } from "./BreakoutDetector";
import { MarketMetricsCalculator } from "./MarketMetricsCalculator";

export class AlertService {
  private lastAlerts: Record<string, BreakoutAlert> = {};
  private breakoutAlerts$ = new BehaviorSubject<BreakoutAlert[]>([]);

  constructor(private breakoutDetector: BreakoutDetector) {}

  /**
   * Handle alert generation for a specific symbol across multiple timeframes
   */
  handleAlerts(
    symbol: string,
    klines: Record<string, KlineData[]>,
    marketSignal: MarketSignal,
    configs: TimeframeConfig[]
  ): void {
    // Validate market signal
    if (!this.isValidMarketSignal(marketSignal)) {
      console.warn(`Invalid market signal for ${symbol}`);
      return;
    }

    // Check for existing recent alert
    const lastAlert = this.lastAlerts[symbol];
    const currentTime = Date.now();
    if (lastAlert && currentTime - lastAlert.timestamp < this.getAlertCooldown()) {
      return;
    }

    // Process alerts for each configured timeframe
    configs.forEach((config) => {
      this.processTimeframeAlert(symbol, klines[config.interval] || [], marketSignal, config);
    });
  }

  /**
   * Process alert for a specific timeframe
   */
  private processTimeframeAlert(
    symbol: string,
    klines: KlineData[],
    marketSignal: MarketSignal,
    config: TimeframeConfig
  ): void {
    // Find corresponding timeframe signal
    const timeframeSignal = this.findTimeframeSignal(marketSignal, config.interval);

    if (!timeframeSignal || klines.length === 0) {
      console.warn(`Insufficient data for ${symbol} on ${config.interval}`);
      return;
    }

    // Detect potential breakout
    const breakoutAlert = this.detectBreakout(
      symbol,
      klines,
      MarketMetricsCalculator.calculateMarketMetrics(klines, config),
      config.interval
    );

    if (breakoutAlert) {
      this.emitAlert(breakoutAlert);
    }
  }

  /**
   * Comprehensive breakout detection
   */
  private detectBreakout(
    symbol: string,
    klines: KlineData[],
    marketMetrics: MarketMetrics,
    timeframe: string
  ): BreakoutAlert | null {
    return this.breakoutDetector.detectBreakout(symbol, klines, marketMetrics, timeframe);
  }

  /**
   * Emit alert to various channels
   */
  private emitAlert(alert: BreakoutAlert): void {
    // Update last alerts
    this.lastAlerts[alert.symbol] = alert;

    // Update breakout alerts subject
    const currentAlerts = this.breakoutAlerts$.getValue();
    this.breakoutAlerts$.next([...currentAlerts, alert]);

    // Additional emit mechanisms can be added here
    console.log(`🚨 ${alert.direction.toUpperCase()} Breakout Alert: ${alert.symbol}`, alert);
  }

  /**
   * Find timeframe signal
   */
  private findTimeframeSignal(marketSignal: MarketSignal, timeframe: string): TimeframeSignal | undefined {
    return marketSignal.signals.find((signal) => signal.timeframe === timeframe);
  }

  /**
   * Validate market signal
   */
  private isValidMarketSignal(marketSignal: MarketSignal): boolean {
    return marketSignal.isValid && marketSignal.signals.length > 0 && marketSignal.timestamp > 0;
  }

  /**
   * Get alert cooldown period
   */
  private getAlertCooldown(): number {
    return 30000; // 30 seconds, can be configured
  }

  /**
   * Get breakout alerts observable
   */
  getBreakoutAlerts$(): Observable<BreakoutAlert[]> {
    return this.breakoutAlerts$.asObservable();
  }
}

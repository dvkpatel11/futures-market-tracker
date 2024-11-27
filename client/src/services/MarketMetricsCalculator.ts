import { KlineData } from "../utils/types";

export class MarketMetricsCalculator {
  static calculatePriceChange(klines: KlineData[]): number {
    if (klines.length < 2) return 0;
    const startPrice = klines[0].close;
    const endPrice = klines[klines.length - 1].close;
    return ((endPrice - startPrice) / startPrice) * 100;
  }

  static calculateVolatility(klines: KlineData[]): number {
    const returns = klines.slice(1).map((kline, i) => Math.log(kline.close / klines[i].close));

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

    return Math.sqrt(variance) * Math.sqrt(365) * 100;
  }

  static calculateRSI(prices: number[], period: number = 14): number {
    const changes = prices.slice(1).map((price, i) => price - prices[i]);
    const gains = changes.map((change) => (change > 0 ? change : 0));
    const losses = changes.map((change) => (change < 0 ? -change : 0));

    const avgGain = this.calculateMovingAverage(gains, period).pop() || 0;
    const avgLoss = this.calculateMovingAverage(losses, period).pop() || 0;

    if (avgLoss === 0) return 100;
    const RS = avgGain / avgLoss;
    return 100 - 100 / (1 + RS);
  }

  static calculateMovingAverage(data: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / period);
    }
    return result;
  }
}

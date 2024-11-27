import { KlineData, MarketDataResponse } from "../utils/types";

export class MarketDataFetcher {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.REACT_APP_API_BASE_URL || "http://localhost:8080") {
    this.baseUrl = baseUrl;
  }

  private async fetchWithErrorHandling(
    endpoint: string,
    params: Record<string, string | number>
  ): Promise<MarketDataResponse> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value.toString()));

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
      }

      return (await response.json()) as MarketDataResponse;
    } catch (error) {
      console.error("Fetch error:", error);
      throw error;
    }
  }

  async fetchMarketData(symbol: string, interval: string, limit: number = 100): Promise<MarketDataResponse> {
    try {
      const data = await this.fetchWithErrorHandling("/api/klines", {
        symbol: symbol.toUpperCase(),
        interval,
        limit,
      });

      if (!data.klines || !Array.isArray(data.klines)) {
        throw new Error("Invalid klines data received");
      }

      if (typeof data.lastPrice !== "number" || typeof data.marketCap !== "number") {
        throw new Error("Invalid market data received");
      }

      return data;
    } catch (error) {
      console.error(`Failed to fetch market data for ${symbol}:`, error);
      throw error;
    }
  }
  async fetchKlineData(symbol: string, interval: string, limit: number = 100): Promise<KlineData[]> {
    const marketData = await this.fetchMarketData(symbol, interval, limit);
    return marketData.klines;
  }

  async fetchCurrentPrice(symbol: string): Promise<number> {
    const marketData = await this.fetchMarketData(symbol, "1h", 1);
    return marketData.lastPrice;
  }

  async fetchMarketCap(symbol: string): Promise<number> {
    const marketData = await this.fetchMarketData(symbol, "1h", 1);
    return marketData.marketCap;
  }
}

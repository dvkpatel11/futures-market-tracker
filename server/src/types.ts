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

export interface MarketDataResponse extends TickerData {
  klines: KlineData[];
}

export interface SubscribeMessage {
  type: "subscribe";
  streams: string | string[];
}

export interface MarketData {
  eventType: string;
  eventTime: string;
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
}

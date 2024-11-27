import { BehaviorSubject } from "rxjs";
import { CONFIG, FUTURES_COINS } from "../utils/constants";
import { BreakoutAlert, MarketSignal, MarketState } from "../utils/types";

// Stream subjects

export const connectionStatus$ = new BehaviorSubject<boolean>(false);
export const marketState$ = new BehaviorSubject<Record<string, MarketState>>({});
export const alertStream$ = new BehaviorSubject<MarketSignal | BreakoutAlert | null>(null);
// WebSocket Service

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = CONFIG.WS.MAX_RECONNECT_ATTEMPTS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageQueue: Set<string> = new Set();
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.handleWebSocketMessage = this.handleWebSocketMessage.bind(this);
    this.setupMessageProcessor();
  }

  private setupMessageProcessor() {
    this.processingInterval = setInterval(() => {
      if (this.messageQueue.size > 0) {
        const messages = Array.from(this.messageQueue);
        this.messageQueue.clear();
        messages.forEach((msg) => this.processMessage(JSON.parse(msg)));
      }
    }, CONFIG.MARKET_ANALYSIS.MESSAGE_PROCESSOR_INTERVAL);
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(CONFIG.WS.BASE_URL);

    this.ws.onopen = () => {
      console.log("WebSocket connected");
      connectionStatus$.next(true);
      this.reconnectAttempts = 0;

      // Subscribe to market data streams
      this.subscribe(FUTURES_COINS.map((symbol) => `${symbol.toLowerCase()}@aggTrade`));
    };

    this.ws.onclose = () => {
      console.log("WebSocket disconnected");
      connectionStatus$.next(false);
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.ws?.close();
    };

    this.ws.onmessage = this.handleWebSocketMessage;
  }

  private handleWebSocketMessage(event: MessageEvent) {
    try {
      this.messageQueue.add(event.data);
    } catch (error) {
      console.error("Error queuing WebSocket message:", error);
    }
  }

  private processMessage(data: any) {
    try {
      if (data.error) {
        console.error("WebSocket error:", data.error);
        return;
      }

      const currentState = marketState$.getValue();
      const symbol = data.symbol;

      if (symbol) {
        const updatedState: MarketState = {
          ...currentState[symbol],
          symbol,
          price: parseFloat(data.price),
          volume: parseFloat(data.volume) || currentState[symbol]?.volume || 0,
          metrics: currentState[symbol]?.metrics || {},
        };

        marketState$.next({
          ...currentState,
          [symbol]: updatedState,
        });
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = CONFIG.WS.RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1);

      this.reconnectTimer = setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }, delay);
    }
  }

  subscribe(streams: string[]) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          method: "SUBSCRIBE",
          params: streams,
          id: Date.now(),
        })
      );
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

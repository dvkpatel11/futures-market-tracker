import cors from "cors";
import express from "express";
import { createServer } from "http";
import fetch from "node-fetch";
import { WebSocket, WebSocketServer } from "ws";
import { RateLimiter } from "./rateLimiter.js";
import type { KlineData } from "./types.js";

// ================== Constants ==================
const PORT = process.env.PORT || 5000;
const BINANCE_FUTURES_WS = "wss://fstream.binance.com/stream";
const BINANCE_FUTURES_API = "https://fapi.binance.com/fapi/v1";
const HEARTBEAT_INTERVAL = 30000;

// ================== Type Definitions ==================
interface SubscribeMessage {
  type: "subscribe";
  streams: string | string[];
}

interface MarketData {
  eventType: string;
  eventTime: string;
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
}

// ================== Data Transformers ==================
const transformers = {
  marketData: (rawData: any): MarketData => {
    const data = JSON.parse(rawData);
    return {
      eventType: data.e,
      eventTime: BigInt(data.E).toString(),
      symbol: data.s,
      price: parseFloat(data.c || data.p),
      volume: parseFloat(data.v || data.q),
      timestamp: Number(data.E),
    };
  },

  klines: (rawKlines: any[]): KlineData[] => {
    return rawKlines.map((k) => ({
      timestamp: Number(k[0]),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
  },
};

// ================== Validation Utils ==================
const validators = {
  symbol: (symbol: string): string => {
    if (typeof symbol !== "string") {
      throw new Error("Symbol must be a string");
    }
    return symbol.toUpperCase();
  },

  interval: (interval: string): string => {
    const validIntervals = new Set(["5m", "1h", "2h", "4h", "1d"]);

    if (!validIntervals.has(interval)) {
      throw new Error("Invalid interval");
    }
    return interval;
  },
};

// ================== Server Setup ==================
const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });
const rateLimiter = new RateLimiter(1200, 60000);

// ================== WebSocket Handler ==================
class WebSocketHandler {
  private binanceWs: WebSocket | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(private clientWs: WebSocket) {}

  handleSubscribe(streams: string | string[]) {
    if (this.binanceWs) {
      this.cleanup();
    }

    const normalizedStreams = Array.isArray(streams)
      ? streams.map(this.normalizeStream)
      : [this.normalizeStream(streams)];

    const wsUrl = `${BINANCE_FUTURES_WS}?streams=${normalizedStreams.join("/")}`;
    this.binanceWs = new WebSocket(wsUrl);

    this.setupBinanceHandlers();
    this.setupHeartbeat();
  }

  private normalizeStream(stream: string): string {
    return stream.toLowerCase();
  }

  private setupBinanceHandlers() {
    if (!this.binanceWs) return;

    // this.binanceWs.on("message", (data) => {
    //   try {
    //     if (this.clientWs.readyState === WebSocket.OPEN) {
    //       const parsed = JSON.parse(data.toString());
    //       if (parsed.data) {
    //         const transformed = transformers.marketData(JSON.stringify(parsed.data));
    //         this.clientWs.send(JSON.stringify(transformed));
    //       }
    //     }
    //   } catch (error) {
    //     console.error("Error processing Binance message:", error);
    //     this.sendError("Data processing error", error);
    //   }
    // });

    this.binanceWs.on("message", (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        console.log("Raw Data: ", parsed); // Add this line to check the raw data
        if (parsed.data) {
          const transformed = transformers.marketData(JSON.stringify(parsed.data));
          console.log("Transformed Data: ", transformed); // Check the transformed data
          this.clientWs.send(JSON.stringify(transformed));
        }
      } catch (error) {
        console.error("Error processing Binance message:", error);
        this.sendError("Data processing error", error);
      }
    });

    this.binanceWs.on("error", (error) => {
      console.error("Binance WebSocket error:", error);
      this.sendError("Binance WebSocket error", error);
    });

    this.binanceWs.on("close", () => {
      console.log("Binance WebSocket closed");
      this.cleanup();
      this.sendNotification("Binance connection closed");
    });
  }

  private setupHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.binanceWs?.readyState === WebSocket.OPEN) {
        this.binanceWs.ping();
      }
    }, HEARTBEAT_INTERVAL);
  }

  private sendError(type: string, error: any) {
    this.clientWs.send(
      JSON.stringify({
        error: type,
        details: error instanceof Error ? error.message : String(error),
      })
    );
  }

  private sendNotification(message: string) {
    this.clientWs.send(
      JSON.stringify({
        type: "notification",
        message,
      })
    );
  }

  cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.binanceWs) {
      this.binanceWs.close();
      this.binanceWs = null;
    }
  }
}

// ================== WebSocket Server Setup ==================
wss.on("connection", (ws) => {
  console.log("New WebSocket connection established");
  const handler = new WebSocketHandler(ws);

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString()) as SubscribeMessage;
      if (data.type === "subscribe") {
        handler.handleSubscribe(data.streams);
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
      ws.send(
        JSON.stringify({
          error: "Message processing error",
          details: error instanceof Error ? error.message : String(error),
        })
      );
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    handler.cleanup();
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  ws.send(JSON.stringify({ type: "connection", status: "connected" }));
});

// ================== REST API Routes ==================
app.get("/api/klines", async (req: any, res: any) => {
  try {
    if (!rateLimiter.checkLimit()) {
      return res.status(429).json({ error: "Rate limit exceeded" });
    }

    const symbol = validators.symbol(req.query.symbol as string);
    const interval = validators.interval(req.query.interval as string);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 1000);

    const klinesUrl = `${BINANCE_FUTURES_API}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const tickerUrl = `${BINANCE_FUTURES_API}/ticker/24hr?symbol=${symbol}`;

    console.log("Fetching from Binance:", klinesUrl);

    // Fetch both klines and ticker data
    const [klinesResponse, tickerResponse] = await Promise.all([fetch(klinesUrl), fetch(tickerUrl)]);

    const klinesData = (await klinesResponse.json()) as any[];
    const tickerData = (await tickerResponse.json()) as any;

    if (!klinesResponse.ok) {
      console.error("Binance API error (klines):", klinesData);
      return res.status(klinesResponse.status).json(klinesData);
    }

    if (!tickerResponse.ok) {
      console.error("Binance API error (ticker):", tickerData);
      return res.status(tickerResponse.status).json(tickerData);
    }

    // Extract price and market cap from ticker data
    const price = parseFloat(tickerData.lastPrice);
    const marketCap = parseFloat(tickerData.quoteVolume); // Assuming quoteVolume represents the market cap in Binance

    // Transform klines data
    const transformedKlines = transformers.klines(klinesData);

    // Send both klines and market data
    return res.json({
      klines: transformedKlines,
      price,
      marketCap,
    });
  } catch (error) {
    console.error("Proxy server error:", error);
    return res.status(500).json({
      error: "Failed to fetch data from Binance",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/health", (_req: express.Request, res: express.Response) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// ================== Server Startup ==================
server.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received. Closing server...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

import cors from "cors";
import express from "express";
import http from "http";
import fetch from "node-fetch";
import { WebSocketServer } from "ws";

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Utility function to transform ticker data
const transformTickerData = (rawData) => {
  const data = JSON.parse(rawData);
  return {
    symbol: data.s,
    price: parseFloat(data.c),
    priceChange: parseFloat(data.p),
    priceChangePercent: parseFloat(data.P),
    high24h: parseFloat(data.h),
    low24h: parseFloat(data.l),
    volume: parseFloat(data.v),
    quoteVolume: parseFloat(data.q),
    lastUpdate: Date.now(),
  };
};

// Utility function to transform klines data
const transformKlinesData = (rawKlines) => {
  return rawKlines.map((k) => ({
    openTime: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    closeTime: k[6],
    quoteVolume: parseFloat(k[7]),
    trades: parseInt(k[8]),
    takerBuyBaseVolume: parseFloat(k[9]),
    takerBuyQuoteVolume: parseFloat(k[10]),
  }));
};

// WebSocket connection handler
wss.on("connection", (ws) => {
  console.log("New WebSocket connection established");
  let binanceWs = null;

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      // Handle subscription requests
      if (data.type === "subscribe") {
        // Close existing connection if any
        if (binanceWs) {
          binanceWs.close();
        }

        // Create streams string for multiple symbols
        const streamsString = Array.isArray(data.streams) ? data.streams.join("/") : data.streams;
        const binanceWsUrl = `wss://stream.binance.com:9443/stream?streams=${streamsString}`;
        binanceWs = new WebSocket(binanceWsUrl);

        binanceWs.on("message", (binanceData) => {
          try {
            if (ws.readyState === WebSocket.OPEN) {
              const parsed = JSON.parse(binanceData);
              if (parsed.data) {
                const transformed = transformTickerData(JSON.stringify(parsed.data));
                ws.send(JSON.stringify(transformed));
              }
            }
          } catch (error) {
            console.error("Error processing Binance message:", error);
            ws.send(JSON.stringify({ error: "Data processing error" }));
          }
        });

        binanceWs.on("error", (error) => {
          console.error("Binance WebSocket error:", error);
          ws.send(JSON.stringify({ error: "Binance WebSocket error" }));
        });

        binanceWs.on("close", () => {
          console.log("Binance WebSocket closed");
          ws.send(JSON.stringify({ type: "notification", message: "Binance connection closed" }));
        });
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
      ws.send(JSON.stringify({ error: "Message processing error" }));
    }
  });

  // Handle client disconnection
  ws.on("close", () => {
    console.log("Client disconnected");
    if (binanceWs) {
      binanceWs.close();
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  // Send initial connection success message
  ws.send(JSON.stringify({ type: "connection", status: "connected" }));
});

// REST API endpoints
app.get("/api/klines", async (req, res) => {
  const { symbol, interval, limit } = req.query;

  if (!symbol || !interval) {
    return res.status(400).json({
      error: "Missing parameters",
      required: { symbol: "required", interval: "required" },
    });
  }

  try {
    const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${
      limit || 100
    }`;

    const response = await fetch(binanceUrl);

    const data = await response.json();

    if (!response.ok) {
      console.error("Binance API error:", data);
      return res.status(response.status).json(data);
    }

    // Transform and send klines data
    const transformedData = transformKlinesData(data);

    res.json(transformedData);
  } catch (error) {
    console.error("Proxy server error:", error);

    res.status(500).json({ error: "Failed to fetch data from Binance" });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Start server
server.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});

// Handle server shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Closing server...");

  server.close(() => {
    console.log("Server closed");

    process.exit(0);
  });
});

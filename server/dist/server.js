import cors from "cors";
import express from "express";
import { createServer } from "http";
import fetch from "node-fetch";
import { WebSocket, WebSocketServer } from "ws";
import { RateLimiter } from "./rateLimiter.js";
// ================== Constants ==================
const PORT = process.env.PORT || 5000;
const BINANCE_FUTURES_WS = "wss://fstream.binance.com/stream";
const BINANCE_FUTURES_API = "https://fapi.binance.com/fapi/v1";
const HEARTBEAT_INTERVAL = 30000;
// ================== Data Transformers ==================
const transformers = {
    marketData: (rawData) => {
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
    klines: (rawKlines) => {
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
    symbol: (symbol) => {
        if (typeof symbol !== "string") {
            throw new Error("Symbol must be a string");
        }
        return symbol.toUpperCase();
    },
    interval: (interval) => {
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
    clientWs;
    binanceWs = null;
    heartbeatInterval = null;
    constructor(clientWs) {
        this.clientWs = clientWs;
    }
    handleSubscribe(streams) {
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
    normalizeStream(stream) {
        return stream.toLowerCase();
    }
    setupBinanceHandlers() {
        if (!this.binanceWs)
            return;
        this.binanceWs.on("message", (data) => {
            try {
                if (this.clientWs.readyState === WebSocket.OPEN) {
                    const parsed = JSON.parse(data.toString());
                    if (parsed.data) {
                        const transformed = transformers.marketData(JSON.stringify(parsed.data));
                        this.clientWs.send(JSON.stringify(transformed));
                    }
                }
            }
            catch (error) {
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
    setupHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.binanceWs?.readyState === WebSocket.OPEN) {
                this.binanceWs.ping();
            }
        }, HEARTBEAT_INTERVAL);
    }
    sendError(type, error) {
        this.clientWs.send(JSON.stringify({
            error: type,
            details: error instanceof Error ? error.message : String(error),
        }));
    }
    sendNotification(message) {
        this.clientWs.send(JSON.stringify({
            type: "notification",
            message,
        }));
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
            const data = JSON.parse(message.toString());
            if (data.type === "subscribe") {
                handler.handleSubscribe(data.streams);
            }
        }
        catch (error) {
            console.error("Error processing WebSocket message:", error);
            ws.send(JSON.stringify({
                error: "Message processing error",
                details: error instanceof Error ? error.message : String(error),
            }));
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
app.get("/api/klines", async (req, res) => {
    try {
        if (!rateLimiter.checkLimit()) {
            return res.status(429).json({ error: "Rate limit exceeded" });
        }
        const symbol = validators.symbol(req.query.symbol);
        const interval = validators.interval(req.query.interval);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 1000);
        const url = `${BINANCE_FUTURES_API}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        console.log("Fetching from Binance:", url);
        const response = await fetch(url);
        const data = (await response.json());
        if (!response.ok) {
            console.error("Binance API error:", data);
            return res.status(response.status).json(data);
        }
        const transformedData = transformers.klines(data);
        res.json(transformedData);
    }
    catch (error) {
        console.error("Proxy server error:", error);
        res.status(500).json({
            error: "Failed to fetch data from Binance",
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
app.get("/health", (_req, res) => {
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
//# sourceMappingURL=server.js.map
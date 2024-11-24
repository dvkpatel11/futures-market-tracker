// Server-side (proxy-server.js)
const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Debug middleware (removed regular request logging)
app.use((req, res, next) => {
  next();
});

app.get("/api/klines", async (req, res) => {
  const { symbol, interval, limit } = req.query;

  // Validate query parameters
  if (!symbol || !interval || !limit) {
    console.warn("Missing parameters in request:", req.query);
    return res.status(400).json({
      error: "Missing parameters",
      required: { symbol: "required", interval: "required", limit: "required" },
    });
  }

  try {
    const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

    const response = await fetch(binanceUrl);
    const data = await response.json();

    if (!response.ok) {
      console.error("Binance API error:", data, ` data ${symbol} | ${interval} | ${limit}`);
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error("Proxy server error:", error.message);
    res.status(500).json({ error: "Failed to fetch data from Binance", details: error.message });
  }
});

app.get("/test", (req, res) => {
  res.json({ message: "Server is working!" });
});

// Catch-all handler for unknown routes
app.use((req, res) => {
  console.warn("Unknown route accessed:", req.originalUrl);
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});

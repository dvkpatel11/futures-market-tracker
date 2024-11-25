// services.js

/**
 * Constants and configurations
 */
export const PROXY_SERVER_URL = "http://localhost:5000";
export const FUTURES_COINS = ["BTCUSDT", "ETHUSDT", "LTCUSDT", "XRPUSDT"];
export const TIMEFRAMES = {
  "5m": { seconds: 300, threshold: 2, drawdown: 5, interval: "5m", volatilityMultiplier: 1.2 },
  "1h": { seconds: 3600, threshold: 5, drawdown: 7, interval: "1h", volatilityMultiplier: 1.5 },
  "2h": { seconds: 7200, threshold: 10, drawdown: 10, interval: "2h", volatilityMultiplier: 1.8 },
  "4h": { seconds: 14400, threshold: 15, drawdown: 12, interval: "4h", volatilityMultiplier: 2 },
  "1d": { seconds: 86400, threshold: 20, drawdown: 25, interval: "1d", volatilityMultiplier: 3 },
};

/**
 * Utility functions for data analysis
 */

/**
 * Adjusts volatility calculations based on the market's volatility level.
 * @param {number} volatility - The calculated volatility.
 * @param {string} timeframe - The timeframe being analyzed (e.g., '1h').
 * @returns {number} - The adjusted volatility based on the current market conditions.
 */
const adjustVolatilityForMarketConditions = (volatility, timeframe) => {
  const volatilityMultiplier = TIMEFRAMES[timeframe]?.volatilityMultiplier || 1;
  return volatility * volatilityMultiplier;
};

/**
 * Calculates the annualized volatility based on historical klines with dynamic adjustments.
 * @param {Array} klines - The array of kline data.
 * @param {number} period - The number of periods to calculate volatility over.
 * @param {string} timeframe - The timeframe being analyzed (e.g., '1h').
 * @returns {number} - The adjusted annualized volatility as a percentage.
 */
const calculateVolatility = (klines, period = 14, timeframe) => {
  if (klines.length < period) return 0;

  const returns = klines
    .slice(-period)
    .map((kline, i, arr) => (i > 0 ? Math.log(kline.close / arr[i - 1].close) : 0))
    .slice(1);

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

  const volatility = Math.sqrt(variance) * Math.sqrt(365) * 100; // Annualized volatility
  return adjustVolatilityForMarketConditions(volatility, timeframe); // Adjust volatility for the current market conditions
};

/**
 * Binance API Service
 *
 * This service handles all interactions with the Binance API to fetch historical kline data.
 */
export class BinanceAPIService {
  /**
   * Fetches kline data for a specific symbol and interval from the proxy server.
   * @param {string} symbol - The cryptocurrency symbol (e.g., 'BTCUSDT').
   * @param {string} interval - The time interval for the kline data (e.g., '1h').
   * @param {number} limit - The number of klines to fetch (default is 500).
   * @returns {Promise<Array>} - A promise that resolves to an array of formatted kline data.
   */
  static async fetchKlines(symbol, interval, limit = 500) {
    const url = `${PROXY_SERVER_URL}/api/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch klines: ${response.status}`);
      }
      const data = await response.json();
      return this.formatKlineData(data);
    } catch (error) {
      console.error("Error fetching klines:", error);
      throw error;
    }
  }

  /**
   * Formats raw kline data into a more usable structure.
   * @param {Array} data - The raw kline data from the API response.
   * @returns {Array} - An array of formatted kline objects.
   */
  static formatKlineData(data) {
    return data.map(([timestamp, open, high, low, close, volume]) => ({
      timestamp: new Date(timestamp),
      open: parseFloat(open),
      high: parseFloat(high),
      low: parseFloat(low),
      close: parseFloat(close),
      volume: parseFloat(volume),
    }));
  }

  /**
   * Fetches all timeframe data for a specific cryptocurrency symbol.
   * @param {string} symbol - The cryptocurrency symbol (e.g., 'BTCUSDT').
   * @returns {Promise<Object>} - A promise that resolves to an object containing price and volume information across timeframes.
   */
  static async fetchAllTimeframeData(symbol) {
    try {
      const timeframeData = await Promise.all(
        Object.entries(TIMEFRAMES).map(async ([timeframe]) => {
          const klines = await this.fetchKlines(symbol, timeframe);
          return [timeframe, klines];
        })
      );

      // Get the most recent klines for current price and volume
      const recentKlines = timeframeData[0][1];
      const lastKline = recentKlines[recentKlines.length - 1];

      return {
        symbol,
        price: lastKline.close,
        volume: lastKline.volume,
        timeframeData: Object.fromEntries(timeframeData), // Store klines by timeframe
        volatility: calculateVolatility(recentKlines, 14, "1h"), // Adjusted volatility for '1h' timeframe
        drawdown: calculateDrawdown(recentKlines),
      };
    } catch (error) {
      console.error(`Error fetching data for ${symbol}:`, error);
      throw error;
    }
  }
}

/**
 * Binance WebSocket Service
 *
 * This service handles real-time WebSocket interactions with the Binance API.
 */
export class BinanceWebSocketService {
  /**
   * Connects to the Binance WebSocket for real-time price updates.
   * @param {string} symbol - The cryptocurrency symbol (e.g., 'BTCUSDT').
   * @param {string} callback - The callback function to process the incoming data.
   */
  static connect(symbol, callback) {
    const url = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`;

    const socket = new WebSocket(url);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      callback(data); // Pass data to the callback function
    };

    socket.onerror = (error) => {
      console.error(`WebSocket error for ${symbol}:`, error);
    };

    socket.onclose = () => {
      console.log(`WebSocket connection closed for ${symbol}`);
    };

    return socket; // Return socket in case it needs to be closed later
  }

  /**
   * Disconnects from the WebSocket.
   * @param {WebSocket} socket - The WebSocket connection to close.
   */
  static disconnect(socket) {
    if (socket) {
      socket.close();
    }
  }
}

/**
 * Market Analysis Service
 *
 * This service analyzes market data to determine bullish behavior based on price changes and drawdowns.
 */
export class MarketAnalysisService {
  /**
   * Analyzes a given set of klines for a specific timeframe to determine bullish behavior.
   * @param {Array} klines - The array of kline data for analysis.
   * @param {string} timeframe - The timeframe being analyzed (e.g., '1h').
   * @returns {Object} - An object containing price change metrics and bullish status.
   */
  static analyzeTimeframe(klines, timeframe) {
    const { threshold, drawdown } = TIMEFRAMES[timeframe];
    const lastKline = klines[klines.length - 1];
    const startKline = klines[klines.length - 2];

    const priceChange = calculatePriceChange(startKline.close, lastKline.close);
    const maxDrawdown = calculateDrawdown(klines);

    const isBullish = priceChange > threshold && Math.abs(maxDrawdown) < drawdown;

    return {
      priceChange,
      maxDrawdown,
      isBullish,
    };
  }

  /**
   * Checks if a token shows consistent bullish behavior across all defined timeframes.
   * @param {Object} timeframeData - An object containing arrays of klines indexed by timeframe.
   * @returns {boolean} - True if all timeframes indicate bullish behavior; false otherwise.
   */
  static isConsistentlyBullish(timeframeData) {
    let bullishCount = Object.keys(TIMEFRAMES).length;

    for (const [timeframe] of Object.entries(TIMEFRAMES)) {
      const klines = timeframeData[timeframe];
      const analysisResult = this.analyzeTimeframe(klines, timeframe);

      // If any timeframe fails to meet bullish criteria
      if (!analysisResult.isBullish) {
        bullishCount--;
      }
    }

    // Return true if all timeframes are bullish
    return bullishCount === Object.keys(TIMEFRAMES).length;
  }

  /**
   * Aggregates market analysis for multiple symbols and checks for consistent bullish behavior.
   * @param {Array<string>} symbols - An array of cryptocurrency symbols to analyze.
   * @returns {Promise<Array>} - A promise that resolves to an array of analysis results for each symbol.
   */
  static async getFullMarketAnalysis(symbols = FUTURES_COINS) {
    try {
      const analysisPromises = symbols.map(async (symbol) => {
        const data = await BinanceAPIService.fetchAllTimeframeData(symbol);
        // Check for consistent bullish behavior
        const isBullishConsistent = this.isConsistentlyBullish(data.timeframeData);
        return { symbol, ...data, isBullishConsistent };
      });

      return await Promise.all(analysisPromises);
    } catch (error) {
      console.error("Error during full market analysis:", error);
      throw error;
    }
  }
}

/**
 * Utility functions for price change and drawdown calculations
 */

/**
 * Calculates the price change between two prices.
 * @param {number} startPrice - The starting price.
 * @param {number} endPrice - The ending price.
 * @returns {number} - The percentage change in price.
 */
const calculatePriceChange = (startPrice, endPrice) => {
  return ((endPrice - startPrice) / startPrice) * 100;
};

/**
 * Calculates the maximum drawdown from an array of klines.
 * @param {Array} klines - The array of kline data.
 * @returns {number} - The maximum drawdown percentage.
 */
const calculateDrawdown = (klines) => {
  let maxDrawdown = 0;
  let peak = klines[0].close;

  klines.forEach((kline) => {
    const drawdown = ((peak - kline.close) / peak) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
    if (kline.close > peak) {
      peak = kline.close;
    }
  });

  return maxDrawdown;
};

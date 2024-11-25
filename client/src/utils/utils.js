// src/utils.js

import { useEffect, useState } from "react";

// Constants
export const FUTURES_COINS = ["BTCUSDT", "ETHUSDT", "LTCUSDT", "XRPUSDT"]; // Add more coins as needed

export const TIMEFRAMES = {
  "5m": {
    seconds: 300,
    threshold: 2,
    drawdown: 2,
    interval: "5m",
  },
  "1h": {
    seconds: 3600,
    threshold: 5,
    drawdown: 5,
    interval: "1h",
  },
  "2h": {
    seconds: 7200,
    threshold: 10,
    drawdown: 10,
    interval: "2h",
  },
  "4h": {
    seconds: 14400,
    threshold: 15,
    drawdown: 10,
    interval: "4h",
  },
  "1d": {
    seconds: 86400,
    threshold: 50,
    drawdown: 25,
    interval: "1d",
  },
};

export const API_CONFIG = {
  FUTURES: {
    REST_URL: "https://fapi.binance.com/fapi/v1/klines",
    WS_URL: "wss://fstream.binance.com/ws",
  },
};

// WebSocket setup utility function
export const setupWebSocket = (url, { onOpen, onClose, onMessage }) => {
  const socket = new WebSocket(url);

  socket.onopen = onOpen;
  socket.onclose = onClose;
  socket.onmessage = onMessage;

  const cleanup = () => {
    socket.close();
  };

  return { socket, cleanup };
};

// Hook to handle WebSocket connection and data updates
export const useWebSocketConnection = (symbol, onMessage) => {
  const [isConnected, setIsConnected] = useState(false);
  
  const url = `${API_CONFIG.FUTURES.WS_URL}/${symbol.toLowerCase()}@trade`;

  useEffect(() => {
    const { socket, cleanup } = setupWebSocket(url, {
      onOpen: () => setIsConnected(true),
      onClose: () => setIsConnected(false),
      onMessage,
    });

    return () => cleanup();
    
  }, [url, onMessage]);

  return isConnected;
};

// Custom hook for fetching historical data based on dynamic symbol and timeframe
export const useHistoricalData = (symbol, timeframe) => {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const { interval } = TIMEFRAMES[timeframe] || {};
  
  const url = `${API_CONFIG.FUTURES.REST_URL}?symbol=${symbol}&interval=${interval}&limit=1000`;

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const historicalData = await response.json();
        setData(historicalData);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    
  }, [symbol, interval]);

  return { data, isLoading, error };
};

// Mathematical utility functions

/**
 * Calculate the percentage change between two prices.
 * @param {number} oldPrice - The original price.
 * @param {number} newPrice - The new price.
 * @returns {number} - The percentage change.
 */
export const calculatePercentageChange = (oldPrice, newPrice) => {
  if (oldPrice === null || oldPrice === undefined || oldPrice === 0) return null;
  
  return ((newPrice - oldPrice) / oldPrice) * 100;
};

/**
 * Calculate the drawdown percentage.
 * @param {number} high - The highest price.
 * @param {number} low - The lowest price.
 * @returns {number} - The drawdown percentage.
 */
export const calculateDrawdown = (high, low) => {
   if (high === null || high === undefined || high === 0) return null;

   return ((high - low) / high) * 100;
};

// Handle WebSocket message safely and update state for multiple symbols
export const handleWebSocketMessage = (event, setData) => {
   try {
     if (event.data) {
       const parsedData = JSON.parse(event.data);

       if (
         parsedData &&
         parsedData.p && // price
         parsedData.s && // symbol
         parsedData.h && // high
         parsedData.l && // low
         parsedData.m   // market
       ) {
         const { p: price, s: symbol, h: high, l: low, m: market } = parsedData;

         // Calculate the drawdown using the provided function
         const drawdown = calculateDrawdown(high, low);

         setData((prevData) => {
           const existingData = prevData.find((d) => d.symbol === symbol) || { symbol };
           return [
             ...prevData.filter((d) => d.symbol !== symbol),
             {
               ...existingData,
               price,
               market,
               currentDrawdown: drawdown,
             },
           ];
         });
       } else {
         console.warn("Received malformed data:", parsedData);
       }
     } else {
       console.warn("Received empty WebSocket message");
     }
     
   } catch (err) {
     console.error("Error parsing WebSocket message", err);
   }
};

// Function to fetch news articles related to futures trading (mocked for now)
export const fetchNewsArticles = async () => {
   // Replace this with actual API call to fetch news articles
   return [
     { id: '1', title: 'Market Update', content: 'Latest trends in the futures market...' },
     { id: '2', title: 'Trading Strategies', content: 'How to trade futures effectively...' },
   ];
};
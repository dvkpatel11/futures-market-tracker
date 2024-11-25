import { Card, CardContent, CardHeader, Typography } from "@mui/material";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BinanceAPIService,
  BinanceWebSocketService,
  FUTURES_COINS,
  MarketAnalysisService,
  TIMEFRAMES,
} from "../services/services"; // Ensure this path is correct
import CryptoTable from "./CryptoTable";
import ErrorCard from "./ErrorCard";
import LoadingSpinner from "./LoadingSpinner";

const CryptoTracker = () => {
  const [marketData, setMarketData] = useState(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wsStatus, setWsStatus] = useState(false);
  const [metrics, setMetrics] = useState(new Map());

  // Initialize WebSocket service with a callback to handle incoming messages
  const wsService = useMemo(
    () =>
      new BinanceWebSocketService((data) => {
        setMarketData((prevData) => {
          const newData = new Map(prevData);
          data.forEach((item) => {
            newData.set(item.symbol, {
              ...newData.get(item.symbol),
              ...item,
              lastUpdate: new Date(),
            });
          });
          return newData;
        });
      }),
    []
  );

  // Fetch historical data for all symbols and timeframes
  const fetchHistoricalData = useCallback(async (symbol) => {
    try {
      const metricsForAllTimeframes = {};

      // Fetch data for each timeframe and calculate metrics
      await Promise.all(
        Object.entries(TIMEFRAMES).map(async ([label, timeframe]) => {
          const klineData = await BinanceAPIService.fetchKlines(symbol, timeframe.interval, 100);
          const marketMetrics = MarketAnalysisService.calculateMetrics(klineData);

          metricsForAllTimeframes[label] = marketMetrics;
        })
      );

      setMetrics((prevMetrics) => {
        const newMetrics = new Map(prevMetrics);
        newMetrics.set(symbol, metricsForAllTimeframes);
        return newMetrics;
      });
    } catch (err) {
      console.error(`Error fetching historical data for ${symbol}:`, err);
      setError(`Failed to fetch historical data for ${symbol}`);
    }
  }, []);

  // Initialize data on component mount
  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        await Promise.all(FUTURES_COINS.map(fetchHistoricalData));

        wsService.connect(FUTURES_COINS); // Connect to WebSocket streams

        wsService.onOpen(() => setWsStatus(true));
        wsService.onClose(() => setWsStatus(false));
        wsService.onError((err) => {
          console.error("WebSocket error:", err);
          setError("WebSocket connection error");
        });
      } catch (err) {
        console.error("Initialization error:", err);
        setError("Failed to initialize market data");
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();

    return () => {
      wsService.close(); // Close WebSocket connection (check for correct method in your service)
    };
  }, [wsService, fetchHistoricalData]);

  // Prepare table data for rendering
  const tableData = useMemo(() => {
    return Array.from(marketData.values()).map((item) => ({
      ...item,
      metrics: metrics.get(item.symbol) || {},
    }));
  }, [marketData, metrics]);

  if (error) {
    return <ErrorCard message={error} />;
  }

  return (
    <Card elevation={3}>
      <CardHeader
        title={<Typography variant="h5">Cryptocurrency Market Tracker</Typography>}
        subheader={
          <Typography variant="body2" color={wsStatus ? "success.main" : "error.main"}>
            {wsStatus ? "Live: Connected" : "Live: Disconnected"}
          </Typography>
        }
      />
      <CardContent>{isLoading ? <LoadingSpinner /> : <CryptoTable data={tableData} metrics={metrics} />}</CardContent>
    </Card>
  );
};

export default CryptoTracker;

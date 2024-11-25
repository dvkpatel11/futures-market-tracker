import { Alert, Box, Card, CardContent, Chip, Grid, styled, Typography } from "@mui/material";
import { Wifi, WifiOff } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import {
  BinanceAPIService,
  BinanceWebSocketService,
  FUTURES_COINS,
  MarketAnalysisService,
  MarketMetrics,
  TIMEFRAMES,
  type KlineData,
  type MarketState,
} from "../services/services";
import VolatilityTable from "./VolatilityTable";

// Styled components using MUI's styled API
const StyledCard = styled(Card)(({ theme }) => ({
  height: "100%",
  "& .bullish": {
    backgroundColor: theme.palette.success.light,
    opacity: 0.05,
  },
}));

// Use MUI's styled API for consistency
const StatusChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== "isConnected",
})<{ isConnected: boolean }>(({ theme, isConnected }) => ({
  backgroundColor: isConnected ? theme.palette.success.main : theme.palette.error.main,
  color: theme.palette.common.white,
  "& .MuiChip-icon": {
    color: theme.palette.common.white,
  },
}));

const VolatilityDashboard = () => {
  const [marketStates, setMarketStates] = useState<Record<string, MarketState>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historicalData, setHistoricalData] = useState<Record<string, Record<string, KlineData[]>>>({});

  // WebSocket initialization and historical data fetching
  useEffect(() => {
    const ws = new BinanceWebSocketService(handleWebSocketMessage, handleConnectionStatus);
    ws.connect(FUTURES_COINS);
    return () => ws.close();
  }, []);

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const data: Record<string, Record<string, KlineData[]>> = {};
        for (const symbol of FUTURES_COINS) {
          data[symbol] = {};
          for (const [timeframe, config] of Object.entries(TIMEFRAMES)) {
            const klines = await BinanceAPIService.fetchKlines(symbol, config.interval, 100);
            data[symbol][timeframe] = klines;
          }
        }
        setHistoricalData(data);
        initializeMarketStates(data);
      } catch (err) {
        setError("Failed to fetch historical data");
        console.error(err);
      }
    };
    fetchInitialData();
  }, []);

  const initializeMarketStates = useCallback((data: Record<string, Record<string, KlineData[]>>) => {
    const states: Record<string, MarketState> = {};
    for (const symbol of FUTURES_COINS) {
      const metrics: Record<string, MarketMetrics> = {};
      for (const timeframe of Object.keys(TIMEFRAMES)) {
        const klines = data[symbol][timeframe];
        if (klines?.length) {
          metrics[timeframe] = MarketAnalysisService.calculateMetrics(klines, timeframe);
        }
      }
      states[symbol] = {
        symbol,
        price: data[symbol]?.[Object.keys(TIMEFRAMES)[0]]?.slice(-1)[0]?.close || 0,
        volume: data[symbol]?.[Object.keys(TIMEFRAMES)[0]]?.slice(-1)[0]?.volume || 0,
        metrics,
      };
    }
    setMarketStates(states);
  }, []);

  const handleWebSocketMessage = useCallback((message: any) => {
    if (message.data?.e === "aggTrade") {
      const { s: symbol, p: price, q: volume } = message.data;
      setMarketStates((prev) => ({
        ...prev,
        [symbol]: {
          ...prev[symbol],
          price: parseFloat(price),
          volume: parseFloat(volume),
        },
      }));
    }
  }, []);

  const handleConnectionStatus = useCallback((status: boolean) => {
    setIsConnected(status);
    if (!status) {
      setError("WebSocket connection lost. Attempting to reconnect...");
    } else {
      setError(null);
    }
  }, []);

  return (
    <Box sx={{ p: 3, maxWidth: "xl", mx: "auto" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4" component="h1">
          Crypto Volatility Tracker
        </Typography>
        <StatusChip
          icon={isConnected ? <Wifi size={20} /> : <WifiOff size={20} />}
          label={isConnected ? "Connected" : "Disconnected"}
          isConnected={isConnected}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {FUTURES_COINS.map((symbol) => {
          const marketState = marketStates[symbol];
          const previousPrice = historicalData[symbol]?.[Object.keys(TIMEFRAMES)[0]]?.slice(-2)[0]?.close;
          const priceTrend = previousPrice ? (marketState?.price - previousPrice) / previousPrice : 0;

          return (
            <Grid item xs={12} md={6} key={symbol}>
              <StyledCard>
                <CardContent>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
                    <Typography variant="h5" component="h2">
                      {symbol}
                    </Typography>
                    <Typography variant="h5" sx={{ color: priceTrend >= 0 ? "success.main" : "error.main" }}>
                      ${marketState?.price?.toFixed(2)}
                    </Typography>
                  </Box>
                  <VolatilityTable marketState={marketState} />
                </CardContent>
              </StyledCard>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default VolatilityDashboard;

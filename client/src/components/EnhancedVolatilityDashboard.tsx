import {
  Alert,
  AppBar,
  Box,
  Chip,
  styled,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Toolbar,
  Typography,
} from "@mui/material";
import { TrendingDown, TrendingUp, Wifi, WifiOff } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { AlertService } from "../services/AlertService";
import { BreakoutDetector } from "../services/BreakoutDetector";
import { MarketDataService } from "../services/MarketDataService";
import { connectionStatus$, marketState$, WebSocketService } from "../services/WebSocketService";
import { CRYPTO_MARKET_CONFIG, FUTURES_COINS } from "../utils/constants";
import { AlertConfig, BreakoutAlert, MarketSignal, MarketState } from "../utils/types";
import MarketPopover from "./MarketPopover";
import TelegramAlertSetup from "./TelegramAlertSetup";

// Enhanced Styled Components
const StatusChip = styled(Chip)<{ isConnected: boolean }>(({ theme, isConnected }) => ({
  backgroundColor: isConnected ? theme.palette.success.main : theme.palette.error.main,
  color: theme.palette.common.white,
}));

const SignalChip = styled(Chip)(({ theme }) => ({
  fontWeight: "bold",
  "&.bullish": {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
  },
  "&.bearish": {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
  },
  "&.neutral": {
    backgroundColor: theme.palette.grey[300],
    color: theme.palette.text.secondary,
  },
}));

const EnhancedVolatilityDashboard: React.FC = () => {
  // State Management
  const [marketStates, setMarketStates] = useState<Record<string, MarketState>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [breakoutAlerts, setBreakoutAlerts] = useState<BreakoutAlert[]>([]);
  const [alertConfig, setAlertConfig] = useState<{
    telegramToken: string;
    chatId: string;
    enableAlerts: boolean;
    customAlertConfig?: Partial<AlertConfig>;
  } | null>(null);

  // Sorting Configuration
  const [sortConfig, setSortConfig] = useState({
    key: "symbol" as keyof MarketState,
    direction: "asc" as "asc" | "desc",
  });

  // Services
  const [webSocketService] = useState(() => new WebSocketService());
  const [marketDataService] = useState(() => new MarketDataService(FUTURES_COINS));
  const [alertService] = useState(() => new AlertService(new BreakoutDetector()));

  // Market Signal Color Determination
  const getMarketSignalColor = (marketSignal?: MarketSignal): "bullish" | "bearish" | "neutral" => {
    if (!marketSignal) return "neutral";

    if (marketSignal.overallStrength > 0.7) return "bullish";
    if (marketSignal.overallStrength < 0.3) return "bearish";
    return "neutral";
  };

  // Sorted Market States
  const sortedMarketStates = useMemo(() => {
    return [...FUTURES_COINS].sort((a, b) => {
      const aState = marketStates[a];
      const bState = marketStates[b];

      let comparison = 0;
      if (Object.keys(CRYPTO_MARKET_CONFIG.timeframes).includes(sortConfig.key)) {
        const aMetric = aState?.metrics?.[sortConfig.key]?.priceChange || 0;
        const bMetric = bState?.metrics?.[sortConfig.key]?.priceChange || 0;
        comparison = aMetric - bMetric;
      } else {
        switch (sortConfig.key) {
          case "price":
            comparison = (aState?.price || 0) - (bState?.price || 0);
            break;
          case "marketCap":
            comparison = (aState?.marketCap || 0) - (bState?.marketCap || 0);
            break;
          default:
            comparison = a.localeCompare(b);
        }
      }

      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [marketStates, sortConfig]);

  // Handle Sort Request
  const handleSortRequest = (key: keyof MarketState) => {
    const isAsc = sortConfig.key === key && sortConfig.direction === "asc";
    setSortConfig({
      key,
      direction: isAsc ? "desc" : "asc",
    });
  };

  // Breakout Alerts Setup
  useEffect(() => {
    const breakoutSubscription = alertService.getBreakoutAlerts$().subscribe((alerts) => {
      const newAlerts = alerts.filter(
        (alert) =>
          !breakoutAlerts.some((existing) => existing.symbol === alert.symbol && existing.timestamp === alert.timestamp)
      );

      setBreakoutAlerts((prev) => [...newAlerts, ...prev].slice(0, 10)); // Limit to 10 most recent alerts
    });
    return () => breakoutSubscription.unsubscribe();
  }, [alertService]);

  // Existing initialization and connection logic remains similar...
  useEffect(() => {
    const initServices = () => {
      setIsLoading(true);
      setError(null);

      webSocketService.connect();
      marketDataService.startAnalysis();

      const marketSubscription = marketState$.subscribe({
        next: (states) => {
          setMarketStates(states);
          setIsLoading(false);
        },
        error: (err) => {
          console.error("Market state error:", err);
          setError("Error receiving market data");
          setIsLoading(false);
        },
      });

      const connectionSubscription = connectionStatus$.subscribe({
        next: (status) => setIsConnected(status),
        error: (err) => {
          console.error("Connection status error:", err);
          setError("Connection status error");
        },
      });

      return () => {
        webSocketService.disconnect();
        marketDataService.cleanup();
        marketSubscription.unsubscribe();
        connectionSubscription.unsubscribe();
      };
    };

    const cleanup = initServices();
    return cleanup;
  }, [webSocketService, marketDataService]);

  return (
    <Box sx={{ p: 3, maxWidth: "xl", mx: "auto" }}>
      {/* App Bar remains mostly the same */}
      <AppBar position="static">
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="h6">Crypto Volatility Tracker</Typography>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <StatusChip
              icon={isConnected ? <Wifi size={20} /> : <WifiOff size={20} />}
              label={isConnected ? "Connected" : "Disconnected"}
              isConnected={isConnected}
              sx={{ mr: 2 }}
            />
            <TelegramAlertSetup
              marketConfig={CRYPTO_MARKET_CONFIG}
              onAlertConfigurationSave={() => {}} // Implement save logic
            />
          </Box>
        </Toolbar>
      </AppBar>

      {/* Breakout Alerts Section */}
      {breakoutAlerts.length > 0 && (
        <Box sx={{ my: 2 }}>
          {breakoutAlerts.slice(0, 3).map((alert) => (
            <Alert
              key={`${alert.symbol}-${alert.timestamp}`}
              severity={alert.direction === "bullish" ? "success" : "error"}
              icon={alert.direction === "bullish" ? <TrendingUp /> : <TrendingDown />}
              sx={{ mb: 1 }}
            >
              {`${alert.symbol} ${alert.direction.toUpperCase()} Breakout: ${alert.percentageMove.toFixed(2)}%`}
            </Alert>
          ))}
        </Box>
      )}

      {/* Market Data Table with Enhanced Features */}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortConfig.key === "symbol"}
                  direction={sortConfig.key === "symbol" ? sortConfig.direction : "asc"}
                  onClick={() => handleSortRequest("symbol")}
                >
                  Symbol
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortConfig.key === "price"}
                  direction={sortConfig.key === "price" ? sortConfig.direction : "asc"}
                  onClick={() => handleSortRequest("price")}
                >
                  Price
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortConfig.key === "marketCap"}
                  direction={sortConfig.key === "marketCap" ? sortConfig.direction : "asc"}
                  onClick={() => handleSortRequest("marketCap")}
                >
                  Market Cap
                </TableSortLabel>
              </TableCell>
              {Object.keys(CRYPTO_MARKET_CONFIG.timeframes).map((timeframe) => (
                <TableCell key={timeframe} align="center">
                  <TableSortLabel
                    active={sortConfig.key === timeframe}
                    direction={sortConfig.key === timeframe ? sortConfig.direction : "asc"}
                    onClick={() => handleSortRequest(timeframe as keyof MarketState)}
                  >
                    {timeframe}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedMarketStates.map((symbol) => {
              const marketState = marketStates[symbol];
              const signalColor = getMarketSignalColor(marketState?.marketSignal);

              return (
                <TableRow
                  key={symbol}
                  sx={{
                    backgroundColor:
                      signalColor === "bullish"
                        ? "rgba(76, 175, 80, 0.1)"
                        : signalColor === "bearish"
                        ? "rgba(244, 67, 54, 0.1)"
                        : "transparent",
                  }}
                >
                  <TableCell>
                    {symbol}
                    <SignalChip size="small" className={signalColor} label={signalColor.toUpperCase()} sx={{ ml: 1 }} />
                  </TableCell>
                  <TableCell>{marketState?.price ? marketState.price.toFixed(2) : "..."}</TableCell>
                  <TableCell>{marketState?.marketCap ? marketState.marketCap.toLocaleString() : "..."}</TableCell>
                  {Object.keys(CRYPTO_MARKET_CONFIG.timeframes).map((timeframe) => {
                    const metrics = marketState?.metrics?.[timeframe];
                    const signal = marketState?.marketSignal;
                    return (
                      <TableCell key={timeframe} align="center">
                        <MarketPopover metrics={metrics} signal={signal}>
                          {metrics?.priceChange ? `${metrics.priceChange.toFixed(2)}%` : "..."}
                        </MarketPopover>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default EnhancedVolatilityDashboard;

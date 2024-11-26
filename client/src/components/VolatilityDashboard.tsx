import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  styled,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Toolbar,
  Typography,
} from "@mui/material";
import { Wifi, WifiOff } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { CRYPTO_MARKET_CONFIG, FUTURES_COINS } from "../utils/constants";
import {
  AlertService,
  BreakoutDetector,
  connectionStatus$,
  MarketDataService,
  marketState$,
  WebSocketService,
} from "../utils/services";
import { AlertConfig, MarketSignal, MarketState } from "../utils/types";
import MarketPopover from "./MarketPopover";
import TelegramAlertSetup from "./TelegramAlertSetup";

// Styled components
const StatusChip = styled(Chip)<{ isConnected: boolean }>(({ theme, isConnected }) => ({
  backgroundColor: isConnected ? theme.palette.success.main : theme.palette.error.main,
  color: theme.palette.common.white,
  "& .MuiChip-icon": {
    color: theme.palette.common.white,
  },
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  "&.positive": {
    color: theme.palette.success.main,
    fontWeight: 600,
  },
  "&.negative": {
    color: theme.palette.error.main,
    fontWeight: 600,
  },
  "&:hover": {
    cursor: "pointer",
    textDecoration: "underline",
  },
}));

const VolatilityDashboard: React.FC = () => {
  const [marketStates, setMarketStates] = useState<Record<string, MarketState>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // New state to store pending alerts DEBUG
  const [pendingAlerts, setPendingAlerts] = useState<string[]>([]);

  // Initialize services
  const [webSocketService, setWebSocketService] = useState(() => new WebSocketService());
  const [marketDataService, setMarketDataService] = useState(() => new MarketDataService(FUTURES_COINS));
  const [alertService] = useState(() => new AlertService(new BreakoutDetector()));

  const [alertConfig, setAlertConfig] = useState<{
    telegramToken: string;
    chatId: string;
    enableAlerts: boolean;
    customAlertConfig?: Partial<AlertConfig>;
  } | null>(null);

  const [lastAlertTimestamps, setLastAlertTimestamps] = useState<Record<string, number>>({});

  // Load saved configuration on component mount
  useEffect(() => {
    const savedConfig = localStorage.getItem("telegramAlertConfig");
    if (savedConfig) {
      setAlertConfig(JSON.parse(savedConfig));
    }
  }, []);

  // Alert configuration save handler
  const handleAlertConfigurationSave = useCallback(
    (config: {
      telegramToken: string;
      chatId: string;
      enableAlerts: boolean;
      customAlertConfig?: Partial<AlertConfig>;
    }) => {
      setAlertConfig(config);
      localStorage.setItem("telegramAlertConfig", JSON.stringify(config));
    },
    []
  );

  // Send Telegram alert if conditions are met
  const sendTelegramAlert = useCallback(
    async (symbol: string, momentum: MarketSignal) => {
      if (!alertConfig?.enableAlerts || !alertConfig?.telegramToken || !alertConfig?.chatId) return;

      const now = Date.now();
      const lastAlertTimestamp = lastAlertTimestamps[symbol] || 0;
      const cooldown = alertConfig.customAlertConfig?.alertCooldown || CRYPTO_MARKET_CONFIG.alerting.alertCooldown;

      if (now - lastAlertTimestamp < cooldown) return;

      const message = `
        🚨 Market Signal Alert 🚨
        Symbol: ${symbol}
        Overall Strength: ${(momentum.overallStrength * 100).toFixed(2)}%
        Volatility Profile: ${momentum.volatilityProfile}
        Timeframes: ${momentum.signals.map((s) => s.timeframe).join(", ")}
        Price at Signal: $${momentum.signals[0]?.components.price.toFixed(2)}
      `;

      // Display the alert on the dashboard first DEBUG
      setPendingAlerts((prev) => [message, ...prev]);

      try {
        await fetch(`https://api.telegram.org/bot${alertConfig.telegramToken}/sendMessage`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: alertConfig.chatId,
            text: message,
          }),
        });

        setLastAlertTimestamps((prev) => ({ ...prev, [symbol]: now }));
      } catch (error) {
        console.error("Failed to send Telegram alert", error);
      }
    },
    [alertConfig, lastAlertTimestamps]
  );

  // Evaluate market signals and send alerts
  const evaluateMarketSignals = useCallback(() => {
    if (!alertConfig?.enableAlerts) return;

    Object.entries(marketStates).forEach(([symbol, state]) => {
      const momentum = state.momentum;
      if (!momentum || !momentum.isValid) return;

      const minStrength =
        alertConfig.customAlertConfig?.minOverallStrength ?? CRYPTO_MARKET_CONFIG.alerting.minOverallStrength;

      const requiredTimeframes =
        alertConfig.customAlertConfig?.requiredTimeframes ?? CRYPTO_MARKET_CONFIG.alerting.requiredTimeframes;

      const confirmedTimeframes = momentum.signals.filter((signal) => requiredTimeframes.includes(signal.timeframe));

      const meetsStrengthThreshold = momentum.overallStrength >= minStrength;
      const hasRequiredTimeframes = confirmedTimeframes.length === requiredTimeframes.length;

      if (meetsStrengthThreshold && hasRequiredTimeframes) {
        sendTelegramAlert(symbol, momentum);
      }
    });
  }, [marketStates, alertConfig, sendTelegramAlert]);

  const initializeServices = useCallback(() => {
    try {
      const wsService = new WebSocketService();
      const dataService = new MarketDataService(FUTURES_COINS);
      setWebSocketService(wsService);
      setMarketDataService(dataService);
      wsService.connect();
      dataService.startAnalysis();

      const marketSubscription = marketState$.subscribe({
        next: (states) => setMarketStates(states),
        error: (err) => setError("Error receiving market data"),
      });

      const connectionSubscription = connectionStatus$.subscribe({
        next: (status) => setIsConnected(status),
        error: () => setError("Connection status error"),
      });

      return () => {
        wsService.disconnect();
        dataService.cleanup();
        marketSubscription.unsubscribe();
        connectionSubscription.unsubscribe();
      };
    } catch (initError) {
      setError("Failed to initialize market services");
      return () => {};
    }
  }, []);

  // Service initialization and connection
  useEffect(() => {
    const initServices = () => {
      setIsLoading(true);
      setError(null);

      // Connect WebSocket service and market data service
      webSocketService.connect();
      marketDataService.startAnalysis();

      // Subscribe to market states and connection status
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

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    try {
      webSocketService.disconnect();
      marketDataService.cleanup();
      setMarketStates({});
      setIsLoading(true);
      const cleanup = initializeServices();
      return cleanup;
    } catch (refreshError) {
      console.error("Refresh error:", refreshError);
      setError("Failed to refresh market data");
    }
  }, [webSocketService, marketDataService]);

  // Evaluate market signals whenever market states or alert config changes
  useEffect(() => {
    evaluateMarketSignals();
  }, [marketStates, alertConfig, evaluateMarketSignals]);

  return (
    <Box sx={{ p: 3, maxWidth: "xl", mx: "auto" }}>
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
              onAlertConfigurationSave={handleAlertConfigurationSave}
            />
            <Button color="inherit" onClick={handleRefresh} disabled={isLoading}>
              {isLoading ? "Refreshing..." : "Refresh"}
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Display pending alerts */}
      <Box sx={{ mb: 3 }}>
        {pendingAlerts.length > 0 && (
          <Alert severity="info">
            <strong>Pending Alerts:</strong>
            <ul>
              {pendingAlerts.slice(0, 3).map((alert, index) => (
                <li key={index}>{alert}</li>
              ))}
            </ul>
          </Alert>
        )}
      </Box>

      <TableContainer sx={{ mt: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Symbol</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Market Cap</TableCell>
              {Object.keys(CRYPTO_MARKET_CONFIG.timeframes).map((timeframe) => (
                <TableCell key={timeframe} align="center">
                  {timeframe}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {FUTURES_COINS.map((symbol) => (
              <TableRow key={symbol}>
                <TableCell>{symbol}</TableCell>
                <TableCell>{marketStates[symbol]?.price ? marketStates[symbol].price.toFixed(2) : "..."}</TableCell>
                <TableCell>
                  {marketStates[symbol]?.marketCap ? marketStates[symbol].marketCap.toLocaleString() : "..."}
                </TableCell>
                {Object.keys(CRYPTO_MARKET_CONFIG.timeframes).map((timeframe) => {
                  const metrics = marketStates[symbol]?.metrics?.[timeframe];
                  return (
                    <StyledTableCell
                      key={timeframe}
                      align="center"
                      className={metrics?.isBullish ? "positive" : "negative"}
                    >
                      <MarketPopover metrics={metrics}>
                        {metrics?.priceChange ? `${metrics.priceChange.toFixed(2)}%` : "..."}
                      </MarketPopover>
                    </StyledTableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default VolatilityDashboard;

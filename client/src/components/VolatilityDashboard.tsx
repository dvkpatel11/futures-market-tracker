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
import { useEffect, useState } from "react";
import { FUTURES_COINS, CRYPTO_MARKET_CONFIG } from "../utils/constants";
import { connectionStatus$,  marketState$ } from "../utils/services";
import MarketPopover from "./MarketPopover";

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

const VolatilityDashboard = () => {
  const [marketStates, setMarketStates] = useState<Record<string, any>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const manager = new MarketDataManager();
    const marketSubscription = marketState$.subscribe({
      next: (states) => setMarketStates(states),
      error: () => setError("Error receiving market data"),
    });
    const connectionSubscription = connectionStatus$.subscribe({
      next: (status) => setIsConnected(status),
      error: () => setError("Connection status error"),
    });

    manager.initialize();
    return () => {
      marketSubscription.unsubscribe();
      connectionSubscription.unsubscribe();
      manager.cleanup();
    };
  }, []);

  const handleRefresh = () => {
    // Trigger refresh action
    setMarketStates({});
    // You can add logic to re-fetch market data here if needed
  };

  return (
    <Box sx={{ p: 3, maxWidth: "xl", mx: "auto" }}>
      {/* Header AppBar */}
      <AppBar position="static">
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="h6" component="div">
            Crypto Volatility Tracker
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <StatusChip
              icon={isConnected ? <Wifi size={20} /> : <WifiOff size={20} />}
              label={isConnected ? "Connected" : "Disconnected"}
              isConnected={isConnected}
              sx={{ mr: 2 }}
            />
            <Button color="inherit" onClick={handleRefresh}>
              Refresh
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

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
                <TableCell>{marketStates[symbol]?.price?.toFixed(2) || "N/A"}</TableCell>
                <TableCell>{marketStates[symbol]?.marketCap?.toFixed(0) || "N/A"}</TableCell>
                {Object.keys(CRYPTO_MARKET_CONFIG.timeframes).map((timeframe) => {
                  const metrics = marketStates[symbol]?.metrics?.[timeframe];
                  const priceChange = metrics?.priceChange || 0;

                  return (
                    <StyledTableCell
                      key={timeframe}
                      align="center"
                      className={metrics?.isBullish ? "positive" : "negative"}
                    >
                      <MarketPopover metrics={metrics}>
                        {marketStates[symbol]?.metrics?.[timeframe]?.priceChange.toFixed(2)}%
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

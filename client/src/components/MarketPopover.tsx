import { Box, Popover, Typography } from "@mui/material";
import { Activity, ArrowDownCircle } from "lucide-react";
import React, { useMemo, useState } from "react";
import { MarketMetrics, MarketSignal } from "../utils/types";

interface MarketPopoverProps {
  metrics?: MarketMetrics;
  signal?: MarketSignal;
  children: React.ReactNode;
}

const MarketPopover: React.FC<MarketPopoverProps> = ({ metrics, signal, children }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const signalStrength = useMemo(() => {
    if (!metrics) return "No Data";

    const strengthFactors = [
      Math.abs(metrics.priceChange) > 15 ? 3 : Math.abs(metrics.priceChange) > 7 ? 2 : 1,
      metrics.momentum.shortTerm > 70 ? 2 : metrics.momentum.shortTerm < 30 ? -2 : 0,
      metrics.volumeProfile.trend === "increasing" ? 1 : metrics.volumeProfile.trend === "decreasing" ? -1 : 0,
    ];

    const totalStrength = strengthFactors.reduce((sum, factor) => sum + factor, 0);

    return totalStrength > 3 ? "Strong" : totalStrength > 0 ? "Moderate" : "Weak";
  }, [metrics]);

  // Improved bullish or bearish trend determination
  const isBullish = useMemo(() => {
    if (!metrics) return false;

    // Use price change and momentum to determine trend
    const priceTrend = metrics.priceChange > 0;
    const momentumTrend = metrics.momentum.shortTerm > 50;

    // If both price and short-term momentum are positive, consider it bullish
    return priceTrend && momentumTrend;
  }, [metrics]);

  if (!metrics) {
    return (
      <span onClick={handleOpen} style={{ cursor: "pointer" }}>
        {children}
      </span>
    );
  }

  return (
    <>
      <span
        onClick={handleOpen}
        style={{
          cursor: "pointer",
          color: isBullish ? "#4caf50" : "#f44336",
          fontWeight: "bold",
        }}
      >
        {children}
      </span>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
      >
        <Box
          sx={{
            p: 3,
            minWidth: 300,
            backgroundColor: "#fff",
            borderRadius: "8px",
            boxShadow: "0px 4px 20px rgba(0,0,0,0.1)",
          }}
        >
          <Typography variant="h6" sx={{ mb: 2, display: "flex", alignItems: "center" }}>
            Market Analysis
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Volatility
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
                <Activity size={18} />
                <Typography variant="body2" sx={{ ml: 1 }}>
                  {metrics.volatility.toFixed(2)}%
                </Typography>
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Max Drawdown
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
                <ArrowDownCircle size={18} />
                <Typography variant="body2" sx={{ ml: 1 }}>
                  {metrics.drawdown.toFixed(2)}%
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Momentum
            </Typography>
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption"> Short Term: {metrics.momentum.shortTerm.toFixed(2)}</Typography>
              <Typography variant="caption"> Medium Term: {metrics.momentum.mediumTerm.toFixed(2)}</Typography>
              <Typography variant="caption"> Long Term: {metrics.momentum.longTerm.toFixed(2)}</Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="subtitle2" color="text.secondary">
              Trend
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: isBullish ? "#4caf50" : "#f44336",
                fontWeight: "bold",
              }}
            >
              {isBullish ? "Bullish" : "Bearish"} ({signalStrength} Signal)
            </Typography>
          </Box>

          <Typography
            variant="caption"
            sx={{
              display: "block",
              mt: 2,
              color: "text.secondary",
              textAlign: "right",
            }}
          >
            Updated: {new Date(metrics.lastUpdate).toLocaleTimeString()}
          </Typography>
        </Box>
      </Popover>
    </>
  );
};

export default MarketPopover;

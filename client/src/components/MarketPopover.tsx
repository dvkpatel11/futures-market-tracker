import { Box, Popover, Typography } from "@mui/material";
import { Activity, ArrowDownCircle, TrendingDown, TrendingUp } from "lucide-react";
import React, { useMemo, useState } from "react";
import { MarketMetrics } from "../utils/types";

interface MarketPopoverProps {
  metrics: MarketMetrics;
  children: React.ReactNode;
}

const MarketPopover: React.FC<MarketPopoverProps> = ({ metrics, children }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  // Memoize the signal strength calculation
  const signalStrength = useMemo(() => {
    if (!metrics) return "neutral";
    const strength = Math.abs(metrics.priceChange);
    if (strength > 15) return "strong";
    if (strength > 7) return "moderate";
    return "weak";
  }, [metrics?.priceChange]);

  // Memoize the market conditions
  const marketConditions = useMemo(() => {
    if (!metrics) return null;

    const conditions = [];
    if (metrics.volatility > 50) conditions.push("High Volatility");
    if (metrics.drawdown > 10) conditions.push("Significant Drawdown");
    if (Math.abs(metrics.priceChange) > 10) conditions.push("Strong Movement");

    return conditions;
  }, [metrics]);

  const getSignalColor = (strength: string) => {
    switch (strength) {
      case "strong":
        return "error.main";
      case "moderate":
        return "warning.main";
      case "weak":
        return "info.main";
      default:
        return "text.secondary";
    }
  };

  if (!metrics) return <span>{children}</span>;

  return (
    <>
      <span onClick={handleOpen} style={{ cursor: "pointer" }}>
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
        PaperProps={{
          elevation: 3,
          sx: {
            borderRadius: 1,
            border: 1,
            borderColor: "divider",
          },
        }}
      >
        <Box sx={{ p: 2, minWidth: 250, backgroundColor: "background.paper" }}>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
            Market Analysis
          </Typography>

          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <Activity size={18} />
            <Typography variant="body2" sx={{ ml: 1 }}>
              Volatility: {metrics.volatility?.toFixed(2)}%
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <ArrowDownCircle size={18} />
            <Typography variant="body2" sx={{ ml: 1 }}>
              Max Drawdown: {metrics.drawdown?.toFixed(2)}%
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
            {metrics.isBullish ? <TrendingUp color="green" size={18} /> : <TrendingDown color="red" size={18} />}
            <Typography
              variant="body2"
              sx={{
                ml: 1,
                color: metrics.isBullish ? "success.main" : "error.main",
                fontWeight: 500,
              }}
            >
              {metrics.isBullish ? "Bullish" : "Bearish"} • {signalStrength} signal
            </Typography>
          </Box>

          {marketConditions && marketConditions.length > 0 && (
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }}>
              {marketConditions.map((condition, index) => (
                <Typography
                  key={index}
                  variant="caption"
                  sx={{
                    display: "block",
                    color: "text.secondary",
                    "&:not(:last-child)": { mb: 0.5 },
                  }}
                >
                  • {condition}
                </Typography>
              ))}
            </Box>
          )}

          <Typography
            variant="caption"
            sx={{
              display: "block",
              mt: 2,
              color: "text.secondary",
              fontSize: "0.7rem",
            }}
          >
            Last updated: {new Date(metrics.lastUpdate).toLocaleTimeString()}
          </Typography>
        </Box>
      </Popover>
    </>
  );
};

export default MarketPopover;

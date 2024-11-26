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

  // Simplified signal strength calculation
  const signalStrength = useMemo(() => {
    const strength = Math.abs(metrics.priceChange);
    if (strength > 15) return "Strong";
    if (strength > 7) return "Moderate";
    return "Weak";
  }, [metrics.priceChange]);

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
              Volatility: {metrics.volatility.toFixed(2)}%
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <ArrowDownCircle size={18} />
            <Typography variant="body2" sx={{ ml: 1 }}>
              Max Drawdown: {metrics.drawdown.toFixed(2)}%
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", mr: 2 }}>
              {metrics.isBullish ? <TrendingUp color="green" size={18} /> : <TrendingDown color="red" size={18} />}
              <Typography
                variant="body2"
                sx={{
                  ml: 1,
                  color: metrics.isBullish ? "success.main" : "error.main",
                  fontWeight: 500,
                }}
              >
                {metrics.isBullish ? "Bullish" : "Bearish"}
              </Typography>
            </Box>
            <Typography variant="body2">{signalStrength} Signal</Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <Typography variant="body2">
              Volume: {metrics.volumeProfile.value.toFixed(2)} ({metrics.volumeProfile.trend})
            </Typography>
          </Box>

          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="caption">Short Term: {metrics.momentum.shortTerm.toFixed(2)}</Typography>
            <Typography variant="caption">Medium Term: {metrics.momentum.mediumTerm.toFixed(2)}</Typography>
            <Typography variant="caption">Long Term: {metrics.momentum.longTerm.toFixed(2)}</Typography>
          </Box>

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

import { Box, Popover, Typography } from "@mui/material";
import { Activity, ArrowDownCircle, TrendingDown, TrendingUp } from "lucide-react";
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

    const strength = Math.abs(metrics.priceChange);
    if (strength > 15) return "Strong";
    if (strength > 7) return "Moderate";
    return "Weak";
  }, [metrics?.priceChange]);

  // Early return if no metrics
  if (!metrics) {
    return (
      <span onClick={handleOpen} style={{ cursor: "pointer" }}>
        {children}
      </span>
    );
  }

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
              Volatility: {typeof metrics.volatility === "number" ? metrics.volatility.toFixed(2) : "N/A"}%
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <ArrowDownCircle size={18} />
            <Typography variant="body2" sx={{ ml: 1 }}>
              Max Drawdown: {typeof metrics.drawdown === "number" ? metrics.drawdown.toFixed(2) : "N/A"}%
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
              Volume:{" "}
              {typeof metrics.volumeProfile?.value === "number" ? metrics.volumeProfile.value.toFixed(2) : "N/A"}(
              {metrics.volumeProfile?.trend || "N/A"})
            </Typography>
          </Box>

          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="caption">
              Short Term:{" "}
              {typeof metrics.momentum?.shortTerm === "number" ? metrics.momentum.shortTerm.toFixed(2) : "N/A"}
            </Typography>
            <Typography variant="caption">
              Medium Term:{" "}
              {typeof metrics.momentum?.mediumTerm === "number" ? metrics.momentum.mediumTerm.toFixed(2) : "N/A"}
            </Typography>
            <Typography variant="caption">
              Long Term: {typeof metrics.momentum?.longTerm === "number" ? metrics.momentum.longTerm.toFixed(2) : "N/A"}
            </Typography>
          </Box>

          {signal && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Overall Signal Strength: {signal.overallStrength.toFixed(2)}
                <br />
                Volatility Profile: {signal.volatilityProfile}
              </Typography>
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
            Last updated: {metrics.lastUpdate ? new Date(metrics.lastUpdate).toLocaleTimeString() : "N/A"}
          </Typography>
        </Box>
      </Popover>
    </>
  );
};

export default MarketPopover;

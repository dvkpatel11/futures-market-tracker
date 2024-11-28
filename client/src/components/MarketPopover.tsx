import { Box, Chip, Divider, Popover, Tooltip, Typography } from "@mui/material";
import { Activity, ArrowDownCircle, BarChart2, Clock, TrendingDown, TrendingUp, Zap } from "lucide-react";
import React, { useMemo, useState } from "react";
import { MarketMetrics, MarketSignal } from "../utils/types";

interface MarketPopoverProps {
  metrics?: MarketMetrics;
  signal?: MarketSignal;
  marketCap?: number;
  children: React.ReactNode;
}

const MarketPopover: React.FC<MarketPopoverProps> = ({ metrics, signal, marketCap, children }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const trendAnalysis = useMemo(() => {
    if (!metrics)
      return {
        trend: "neutral",
        strength: "No Data",
        color: "grey",
        icon: Zap,
      };

    const isBullish = metrics.priceChange > 0 && metrics.momentum.shortTerm > 50;

    return {
      trend: isBullish ? "bullish" : "bearish",
      strength: metrics.momentum.shortTerm > 70 ? "Strong" : metrics.momentum.shortTerm < 30 ? "Weak" : "Moderate",
      color: isBullish ? "green" : "red",
      icon: isBullish ? TrendingUp : TrendingDown,
    };
  }, [metrics]);

  if (!metrics) return <span onClick={handleOpen}>{children}</span>;

  const getTrendColor = (value: number) => {
    if (value > 0) return "text-green-600";
    if (value < 0) return "text-red-600";
    return "text-gray-600";
  };

  return (
    <>
      <span
        onClick={handleOpen}
        style={{
          cursor: "pointer",
          color: trendAnalysis.color,
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
            minWidth: 400,
            backgroundColor: "#fff",
            borderRadius: "12px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Box>
              <Typography variant="h6">Market Analysis</Typography>
              {marketCap && (
                <Typography variant="caption" color="text.secondary">
                  Market Cap: ${(marketCap / 1_000_000_000).toFixed(2)}B
                </Typography>
              )}
            </Box>
            <Tooltip title={`${trendAnalysis.strength} ${trendAnalysis.trend.toUpperCase()} Signal`}>
              <Box component="span" className={getTrendColor(metrics.priceChange)}>
                {React.createElement(trendAnalysis.icon, {
                  size: 24,
                })}
              </Box>
            </Tooltip>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Signal Strength
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Typography className={getTrendColor(metrics.priceChange)} variant="h4">
                {signal?.overallStrength ? `${(signal.overallStrength * 100).toFixed(1)}%` : "N/A"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Volatility Profile: {signal?.volatilityProfile || "N/A"}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Price Metrics
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <Clock size={16} />
                  <Typography variant="body2" sx={{ ml: 1 }} className={getTrendColor(metrics.priceChange)}>
                    {metrics.priceChange > 0 ? "+" : ""}
                    {metrics.priceChange.toFixed(2)}%
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <Activity size={16} />
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    Volatility: {metrics.volatility.toFixed(2)}%
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <ArrowDownCircle size={16} />
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    Drawdown: {metrics.drawdown.toFixed(2)}%
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Volume Analysis
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <BarChart2 size={16} />
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    {metrics.volumeProfile.value.toLocaleString()} ({metrics.volumeProfile.trend})
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Trend Consistency:{" "}
                  {signal?.trendConsistency ? `${(signal.trendConsistency * 100).toFixed(1)}%` : "N/A"}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Momentum Indicators
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2 }}>
              {[
                { label: "Short Term", value: metrics.momentum.shortTerm },
                { label: "Medium Term", value: metrics.momentum.mediumTerm },
                { label: "Long Term", value: metrics.momentum.longTerm },
              ].map(({ label, value }) => (
                <Box key={label}>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography variant="body2" className={getTrendColor(value - 50)}>
                    {value.toFixed(1)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {signal?.signals?.length && signal.signals.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Trend Signals
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {signal?.signals[0].components.trend.reasons.slice(0, 3).map((reason, index) => (
                  <Chip
                    key={index}
                    label={reason.replace(/_/g, " ")}
                    size="small"
                    color={trendAnalysis.trend === "bullish" ? "success" : "error"}
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          )}

          <Typography
            variant="caption"
            sx={{
              display: "block",
              mt: 3,
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

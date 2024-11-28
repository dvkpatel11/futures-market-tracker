import { Box, Divider, Popover, Tooltip, Typography } from "@mui/material";
import { Activity, ArrowDownCircle, BarChart2, Clock, TrendingDown, TrendingUp, Zap } from "lucide-react";
import React, { useMemo, useState } from "react";
import { MarketMetrics, MarketSignal } from "../utils/types";

interface MarketPopoverProps {
  metrics?: MarketMetrics;
  signal?: MarketSignal;
  marketCap?: number;
  children: React.ReactNode;
}

const MOMENTUM_THRESHOLDS = {
  shortTerm: { oversold: 30, neutral: [40, 60], overbought: 70 },
  mediumTerm: { oversold: 40, neutral: [45, 55], overbought: 60 },
  longTerm: { oversold: 45, neutral: [48, 52], overbought: 55 },
};

const getColorForMomentum = (value: number) => {
  if (value <= 30) return "text-red-600"; // Oversold
  if (value <= 40) return "text-orange-600"; // Weak
  if (value <= 60) return "text-gray-600"; // Neutral
  if (value <= 70) return "text-green-400"; // Strong
  return "text-green-600"; // Very Strong
};

const getTrendColor = (trend: string) => {
  switch (trend) {
    case "bullish":
      return "text-green-600";
    case "bearish":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
};

const getDrawdownInterpretation = (drawdown: number) => {
  if (drawdown < 5) return { color: "text-green-600", description: "Minor Pullback" };
  if (drawdown < 10) return { color: "text-yellow-600", description: "Moderate Correction" };
  if (drawdown < 20) return { color: "text-orange-600", description: "Significant Decline" };
  return { color: "text-red-600", description: "Severe Drawdown" };
};

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

  const drawdownInterpretation = getDrawdownInterpretation(metrics.drawdown);

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
              <Box component="span" className={getTrendColor(trendAnalysis.trend)}>
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
              <Typography className={getTrendColor(trendAnalysis.trend)} variant="h4">
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
                  <Typography
                    variant="body2"
                    sx={{ ml: 1 }}
                    className={metrics.priceChange > 0 ? "text-green-600" : "text-red-600"}
                  >
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
                  <Typography variant="body2" sx={{ ml: 1 }} className={drawdownInterpretation.color}>
                    Drawdown: {metrics.drawdown.toFixed(2)}%
                    <Tooltip title={drawdownInterpretation.description}>
                      <span className="ml-2 cursor-help">ℹ️</span>
                    </Tooltip>
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
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Momentum Indicators
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2 }}>
              {[
                {
                  label: "Short Term",
                  value: metrics.momentum.shortTerm,
                  threshold: `(${MOMENTUM_THRESHOLDS.shortTerm.oversold}-${MOMENTUM_THRESHOLDS.shortTerm.overbought})`,
                },
                {
                  label: "Medium Term",
                  value: metrics.momentum.mediumTerm,
                  threshold: `(${MOMENTUM_THRESHOLDS.mediumTerm.oversold}-${MOMENTUM_THRESHOLDS.mediumTerm.overbought})`,
                },
                {
                  label: "Long Term",
                  value: metrics.momentum.longTerm,
                  threshold: `(${MOMENTUM_THRESHOLDS.longTerm.oversold}-${MOMENTUM_THRESHOLDS.longTerm.overbought})`,
                },
              ].map(({ label, value, threshold }) => (
                <Box key={label} sx={{ p: 1 }}>
                  {" "}
                  {/* Added padding here */}
                  <Typography variant="caption" color="text.secondary">
                    {label} {threshold}
                  </Typography>
                  <Typography variant="body2" className={getColorForMomentum(value)}>
                    {value.toFixed(1)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Popover>
    </>
  );
};

export default MarketPopover;

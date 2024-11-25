import { Box, Popover, Typography } from "@mui/material";
import { TrendingDown, TrendingUp } from "lucide-react";
import React, { useState } from "react";

interface MarketPopoverProps {
  metrics: any;
  children: React.ReactNode;
}

const MarketPopover: React.FC<MarketPopoverProps> = ({ metrics, children }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLTableCellElement | null>(null);

  const handleOpen = (event: React.MouseEvent<HTMLTableCellElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <span onClick={handleOpen}>{children}</span>
      <Popover
        open={open}
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
        <Box sx={{ p: 2, minWidth: 220, backgroundColor: "background.paper", boxShadow: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Technical Metrics
          </Typography>
          <Typography variant="body2">Volatility: {metrics?.volatility?.toFixed(2)}%</Typography>
          <Typography variant="body2">Drawdown: {metrics?.drawdown?.toFixed(2)}%</Typography>
          <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
            {metrics?.isBullish ? <TrendingUp color="green" /> : <TrendingDown color="red" />}
            <Typography variant="caption" sx={{ ml: 1 }}>
              {metrics?.isBullish ? "Bullish" : "Bearish"}
            </Typography>
          </Box>
        </Box>
      </Popover>
    </>
  );
};

export default MarketPopover;

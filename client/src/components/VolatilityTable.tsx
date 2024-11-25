import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, styled } from "@mui/material";
import { TrendingDown, TrendingUp } from "lucide-react";
import React from "react";
import { TIMEFRAMES, type MarketState } from "../services/services";

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  "&.price-cell-positive": {
    color: theme.palette.success.main,
    fontWeight: "bold",
  },
  "&.price-cell-negative": {
    color: theme.palette.error.main,
    fontWeight: "bold",
  },
  "&.metrics-cell-bullish": {
    backgroundColor: theme.palette.success.light,
    opacity: 0.1,
    fontWeight: "bold",
  },
}));

interface VolatilityTableProps {
  marketState: MarketState;
}

const VolatilityTable: React.FC<VolatilityTableProps> = ({ marketState }) => {
  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Timeframe</TableCell>
            <TableCell align="right">Change %</TableCell>
            <TableCell align="right">Volatility</TableCell>
            <TableCell align="right">Drawdown</TableCell>
            <TableCell align="center">Trend</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {Object.entries(TIMEFRAMES).map(([timeframe, config]) => {
            const metrics = marketState?.metrics[timeframe];
            const isBullish = metrics?.isBullish;
            const priceChangeClass = metrics?.priceChange >= 0 ? "price-cell-positive" : "price-cell-negative";

            return (
              <TableRow key={timeframe} className={isBullish ? "bullish" : ""}>
                <StyledTableCell className={isBullish ? "metrics-cell-bullish" : ""}>{timeframe}</StyledTableCell>
                <StyledTableCell align="right" className={priceChangeClass}>
                  {metrics?.priceChange?.toFixed(2)}%
                </StyledTableCell>
                <StyledTableCell align="right" className={isBullish ? "metrics-cell-bullish" : ""}>
                  {metrics?.volatility?.toFixed(2)}%
                </StyledTableCell>
                <StyledTableCell align="right" className={isBullish ? "metrics-cell-bullish" : ""}>
                  {metrics?.drawdown?.toFixed(2)}%
                </StyledTableCell>
                <TableCell align="center">
                  {isBullish ? <TrendingUp color="#00c853" size={20} /> : <TrendingDown color="#ff3d00" size={20} />}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default VolatilityTable;

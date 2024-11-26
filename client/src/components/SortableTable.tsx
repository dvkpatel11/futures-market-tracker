import { styled, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { useState } from "react";
import { CRYPTO_MARKET_CONFIG } from "../utils/constants";
import MarketPopover from "./MarketPopover";

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  "&.positive": {
    color: theme.palette.success.main,
    fontWeight: 600,
  },
  "&.negative": {
    color: theme.palette.error.main,
    fontWeight: 600,
  },
}));

const SortableTable: React.FC<{ marketStates: Record<string, any> }> = ({ marketStates }) => {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "ascending" | "descending" } | null>(null);

  const sortedCoins = () => {
    let sortableItems = Object.keys(marketStates).map((symbol) => ({
      symbol,
      ...marketStates[symbol],
    }));

    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  };

  const requestSort = (key: string) => {
    let direction: "ascending" | "descending" = "ascending";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  return (
    <TableContainer sx={{ mt: 3 }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell onClick={() => requestSort("symbol")}>Symbol</TableCell>
            <TableCell onClick={() => requestSort("price")}>Price</TableCell>
            <TableCell onClick={() => requestSort("marketCap")}>Market Cap</TableCell>
            {Object.keys(CRYPTO_MARKET_CONFIG.timeframes).map((timeframe) => (
              <TableCell key={timeframe} align="center">
                {timeframe}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedCoins().map(({ symbol, price, marketCap }) => (
            <TableRow key={symbol}>
              <TableCell>{symbol}</TableCell>
              <TableCell>{price ? price.toFixed(2) : "..."}</TableCell>
              <TableCell>{marketCap ? marketCap.toLocaleString() : "..."}</TableCell>
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
  );
};

export default SortableTable;

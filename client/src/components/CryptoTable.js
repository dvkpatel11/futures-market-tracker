import { ArrowDownward, ArrowUpward, TrendingUp } from "@mui/icons-material";
import {
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";

import React from "react";
import { TIMEFRAMES } from "../services/services";

const formatNumber = (value, options = {}) => {
  if (typeof value !== "number") return "-";

  const { minimumFractionDigits = 2, maximumFractionDigits = 2, notation = "standard" } = options;

  return new Intl.NumberFormat("en-US", {
    notation,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
};

const formatPercentage = (value) => {
  if (typeof value !== "number") return "-";
  return `${value >= 0 ? "+" : ""}${formatNumber(value / 100, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: "percent",
  })}`;
};

const isBullishInterval = (change, interval) => {
  if (!change || !TIMEFRAMES[interval]) return false;
  const { threshold, drawdown } = TIMEFRAMES[interval];
  return change > threshold && Math.abs(Math.min(0, change)) < drawdown;
};

const IntervalCell = ({ value, interval }) => {
  if (!value) return "-";

  const isBullish = isBullishInterval(value, interval);
  const { threshold, drawdown } = TIMEFRAMES[interval];

  return (
    <Tooltip
      title={
        <>
          <div>Threshold: {threshold}%</div>
          <div>Max Drawdown: {drawdown}%</div>
        </>
      }
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 8px",
          borderRadius: 4,
          backgroundColor: isBullish ? "#4caf50" : "transparent",
          color: isBullish ? "#fff" : value >= 0 ? "#4caf50" : "#f44336",
          fontWeight: isBullish ? "bold" : "normal",
        }}
      >
        {formatPercentage(value)}
        {isBullish && <TrendingUp fontSize="small" />}
      </div>
    </Tooltip>
  );
};

const CryptoTable = ({ data, sortConfig, onSort }) => {
  const getSortIcon = (columnKey) => {
    if (sortConfig?.key !== columnKey) return null;
    return sortConfig.direction === "asc" ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />;
  };

  const columns = React.useMemo(
    () => [
      {
        key: "symbol",
        label: "Symbol",
        sortable: true,
        align: "left",
      },
      {
        key: "price",
        label: "Price",
        format: (value) => formatNumber(value, { maximumFractionDigits: 8 }),
        sortable: true,
      },
      {
        key: "volume",
        label: "Volume",
        format: (value) => formatNumber(value, { notation: "compact" }),
        sortable: true,
      },
      ...Object.keys(TIMEFRAMES).map((interval) => ({
        key: interval,
        label: interval,
        render: (row) => <IntervalCell value={row.priceChanges?.[interval]} interval={interval} />,
        sortable: true,
        getValue: (row) => row.priceChanges?.[interval] || 0,
      })),
      {
        key: "volatility",
        label: "Volatility",
        format: (value) => formatPercentage(value),
        sortable: true,
      },
      {
        key: "drawdown",
        label: "Drawdown",
        format: (value) => formatPercentage(value),
        sortable: true,
      },
    ],
    []
  );

  return (
    <Card>
      <CardHeader title={<Typography variant="h6">Crypto Trading Analysis</Typography>} />
      <CardContent>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    align={column.align || "center"}
                    sortDirection={sortConfig?.key === column.key ? sortConfig.direction : false}
                    onClick={() => column.sortable && onSort?.(column.key)}
                    style={{ cursor: column.sortable ? "pointer" : "default" }}
                    aria-sort={
                      sortConfig?.key === column.key
                        ? sortConfig.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span>{column.label}</span>
                      {column.sortable && getSortIcon(column.key)}
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center">
                    No data available
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row) => (
                  <TableRow key={row.symbol}>
                    {columns.map((column) => (
                      <TableCell key={`${row.symbol}-${column.key}`} align={column.align || "center"}>
                        {column.render
                          ? column.render(row)
                          : column.format
                          ? column.format(row[column.key])
                          : row[column.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};

export default CryptoTable;

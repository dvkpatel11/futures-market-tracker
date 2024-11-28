import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Zap, TrendingUp, TrendingDown } from 'lucide-react';

// TrendReason type from the original document
type TrendReason =
  | "bullish_candlestick"
  | "bearish_candlestick"
  | "price_increase"
  | "price_decrease"
  | "strong_volume"
  | "weak_volume"
  | "momentum_shift"
  | "RSI_overbought"
  | "RSI_oversold"
  | "RSI_stable"
  | "uptrend"
  | "downtrend"
  | "sideways_trend"
  | "significant_price_change"
  | "high_volatility"
  | "low_volatility"
  | "drawdown_high"
  | "drawdown_low"
  | "short_term_momentum"
  | "medium_term_momentum"
  | "long_term_momentum"
  | "increasing_volume"
  | "decreasing_volume"
  | "stable_volume"
  | "uptrend_support"
  | "downtrend_support"
  | "neutral_trend"
  | "recent_price_change";

interface Trend {
  trend: "bullish" | "bearish" | "neutral";
  reasons: TrendReason[];
}

interface MarketState {
  symbol: string;
  price: number;
  marketCap: number;
  volume: number;
  metrics: Record<string, MarketMetrics>;
  marketSignal?: MarketSignal;
}

interface MarketMetrics {
  lastUpdate: number;
  priceChange: number;
  volatility: number;
  drawdown: number;
  volumeProfile: {
    value: number;
    trend: "increasing" | "decreasing" | "stable";
  };
  momentum: {
    shortTerm: number;
    mediumTerm: number;
    longTerm: number;
  };
}

interface MarketSignal {
  symbol: string;
  timestamp: number;
  overallStrength: number;
  isValid: boolean;
  volatilityProfile: "low" | "medium" | "high" | "extreme";
  trendConsistency: number;
  overallTrend: "bullish" | "bearish" | "neutral";
}

// Mock data generator
const generateMockMarketStates = (): MarketState[] => {
  const trendReasons: Record<Trend['trend'], TrendReason[]> = {
    bullish: [
      "price_increase", 
      "strong_volume", 
      "uptrend", 
      "short_term_momentum", 
      "increasing_volume"
    ],
    bearish: [
      "price_decrease", 
      "weak_volume", 
      "downtrend", 
      "long_term_momentum", 
      "decreasing_volume"
    ],
    neutral: [
      "sideways_trend", 
      "stable_volume", 
      "RSI_stable", 
      "neutral_trend"
    ]
  };

  const symbols = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'XRP/USDT', 'ADA/USDT'];
  return symbols.map(symbol => {
    const overallTrend: Trend['trend'] = ["bullish", "bearish", "neutral"][Math.floor(Math.random() * 3)] as Trend['trend'];
    
    return {
      symbol,
      price: Math.random() * 1000,
      marketCap: Math.random() * 1000000000,
      volume: Math.random() * 1000000,
      metrics: {
        "1h": {
          lastUpdate: Date.now(),
          priceChange: Math.random() * 10 - 5,
          volatility: Math.random() * 10,
          drawdown: Math.random() * 5,
          volumeProfile: {
            value: Math.random() * 1000000,
            trend: Math.random() > 0.5 ? "increasing" : "decreasing"
          },
          momentum: {
            shortTerm: Math.random() * 100,
            mediumTerm: Math.random() * 100,
            longTerm: Math.random() * 100
          }
        },
        "4h": {
          lastUpdate: Date.now(),
          priceChange: Math.random() * 10 - 5,
          volatility: Math.random() * 10,
          drawdown: Math.random() * 5,
          volumeProfile: {
            value: Math.random() * 1000000,
            trend: Math.random() > 0.5 ? "increasing" : "decreasing"
          },
          momentum: {
            shortTerm: Math.random() * 100,
            mediumTerm: Math.random() * 100,
            longTerm: Math.random() * 100
          }
        },
        "1d": {
          lastUpdate: Date.now(),
          priceChange: Math.random() * 10 - 5,
          volatility: Math.random() * 10,
          drawdown: Math.random() * 5,
          volumeProfile: {
            value: Math.random() * 1000000,
            trend: Math.random() > 0.5 ? "increasing" : "decreasing"
          },
          momentum: {
            shortTerm: Math.random() * 100,
            mediumTerm: Math.random() * 100,
            longTerm: Math.random() * 100
          }
        }
      },
      marketSignal: {
        symbol,
        timestamp: Date.now(),
        overallStrength: Math.random(),
        isValid: Math.random() > 0.5,
        volatilityProfile: ["low", "medium", "high", "extreme"][Math.floor(Math.random() * 4)] as "low" | "medium" | "high" | "extreme",
        trendConsistency: Math.random(),
        overallTrend: overallTrend
      }
    };
  });
};

const VolatilityTable: React.FC = () => {
  const [marketStates, setMarketStates] = useState<MarketState[]>(generateMockMarketStates());
  const [expandedRows, setExpandedRows] = useState<{[key: string]: string | null}>({});

  const getRowColorClass = (strength: number) => {
    if (strength < 0.3) return 'bg-red-100';
    if (strength < 0.6) return 'bg-yellow-100';
    return 'bg-green-100';
  };

  const renderTrendReasonBadges = (trend: Trend['trend'], reasons: TrendReason[]) => {
    const trendIcons = {
      bullish: <TrendingUp className="text-green-600" />,
      bearish: <TrendingDown className="text-red-600" />,
      neutral: <Zap className="text-gray-600" />
    };

    return (
      <div className="flex flex-col space-y-2">
        <div className="flex items-center font-semibold">
          {trendIcons[trend]}
          <span className="ml-2 capitalize">{trend} Trend</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {reasons.map((reason, index) => (
            <span 
              key={index} 
              className="px-2 py-1 bg-gray-200 text-xs rounded-full"
            >
              {reason.replace('_', ' ')}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const renderMetricsDetails = (metrics: MarketMetrics, marketSignal?: MarketSignal) => (
    <div className="p-4 bg-gray-50 grid grid-cols-3 gap-4">
      <div className="col-span-3">
        {marketSignal && renderTrendReasonBadges(
          marketSignal.overallTrend, 
          // Generate mock trend reasons based on the trend
          marketSignal.overallTrend === 'bullish' 
            ? ["price_increase", "strong_volume", "uptrend"]
            : marketSignal.overallTrend === 'bearish'
              ? ["price_decrease", "weak_volume", "downtrend"]
              : ["sideways_trend", "stable_volume"]
        )}
      </div>
      <div>
        <h4 className="font-semibold">Price Change</h4>
        <p>{metrics.priceChange.toFixed(2)}%</p>
      </div>
      <div>
        <h4 className="font-semibold">Volatility</h4>
        <p>{metrics.volatility.toFixed(2)}%</p>
      </div>
      <div>
        <h4 className="font-semibold">Drawdown</h4>
        <p>{metrics.drawdown.toFixed(2)}%</p>
      </div>
      <div>
        <h4 className="font-semibold">Volume Profile</h4>
        <p>Value: {metrics.volumeProfile.value.toFixed(2)}</p>
        <p>Trend: {metrics.volumeProfile.trend}</p>
      </div>
      <div>
        <h4 className="font-semibold">Momentum</h4>
        <p>Short Term: {metrics.momentum.shortTerm.toFixed(2)}</p>
        <p>Medium Term: {metrics.momentum.mediumTerm.toFixed(2)}</p>
        <p>Long Term: {metrics.momentum.longTerm.toFixed(2)}</p>
      </div>
    </div>
  );

  const toggleRowExpansion = (symbol: string, timeframe: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [symbol]: prev[symbol] === timeframe ? null : timeframe
    }));
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <table className="w-full border-collapse bg-white shadow-lg">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-3 text-left">Symbol</th>
            <th className="p-3 text-left">Market Cap</th>
            <th className="p-3 text-left">1h</th>
            <th className="p-3 text-left">4h</th>
            <th className="p-3 text-left">1d</th>
          </tr>
        </thead>
        <tbody>
          {marketStates.map((state) => {
            const signalStrength = state.marketSignal?.overallStrength || 0;
            return (
              <>
                <tr 
                  key={state.symbol} 
                  className={`${getRowColorClass(signalStrength)} hover:bg-opacity-75 transition-all`}
                >
                  <td className="p-3">{state.symbol}</td>
                  <td className="p-3">${(state.marketCap / 1_000_000_000).toFixed(2)}B</td>
                  {(['1h', '4h', '1d'] as const).map((timeframe) => (
                    <td 
                      key={timeframe} 
                      className="p-3 cursor-pointer hover:bg-blue-100"
                      onClick={() => toggleRowExpansion(state.symbol, timeframe)}
                    >
                      <div className="flex items-center">
                        {state.metrics[timeframe].volatility.toFixed(2)}%
                        {expandedRows[state.symbol] === timeframe 
                          ? <ChevronUp className="ml-2" size={16} /> 
                          : <ChevronDown className="ml-2" size={16} />}
                      </div>
                    </td>
                  ))}
                </tr>
                {expandedRows[state.symbol] && (
                  <tr>
                    <td colSpan={5}>
                      {renderMetricsDetails(
                        state.metrics[expandedRows[state.symbol] as string], 
                        state.marketSignal
                      )}
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default VolatilityTable;
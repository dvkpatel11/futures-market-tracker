// import React, { useCallback, useEffect, useMemo, useState } from "react";
// import { Card, CardContent, CardHeader } from "@/components/ui/card";
// import {
//   BinanceAPIService,
//   BinanceWebSocketService,
//   MarketAnalysisService,
//   FUTURES_COINS,
//   TIMEFRAMES,
//   MarketState,
//   MarketMetrics,
// } from "../services/services";

// const CryptoTracker: React.FC = () => {
//   const [marketData, setMarketData] = useState<Map<string, MarketState>>(new Map());
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [wsStatus, setWsStatus] = useState(false);

//   const handleWebSocketMessage = useCallback((message: any) => {
//     const { data } = message;
//     if (!data) return;

//     setMarketData((prev) => {
//       const newData = new Map(prev);
//       const symbol = data.s;
//       const currentState = newData.get(symbol);

//       if (currentState) {
//         newData.set(symbol, {
//           ...currentState,
//           price: parseFloat(data.p),
//           volume: parseFloat(data.q),
//           lastUpdate: Date.now(),
//         });
//       }

//       return newData;
//     });
//   }, []);

//   const wsService = useMemo(
//     () => new BinanceWebSocketService(handleWebSocketMessage, setWsStatus),
//     [handleWebSocketMessage]
//   );

//   const updateMetrics = useCallback(async (symbol: string) => {
//     try {
//       const metricsPromises = Object.entries(TIMEFRAMES).map(async ([timeframe, config]) => {
//         const klines = await BinanceAPIService.fetchKlines(symbol, config.interval, 100);
//         return [timeframe, MarketAnalysisService.calculateMetrics(klines, timeframe)];
//       });

//       const metrics = Object.fromEntries(await Promise.all(metricsPromises));

//       setMarketData((prev) => {
//         const newData = new Map(prev);
//         const currentState = newData.get(symbol);
//         if (currentState) {
//           newData.set(symbol, {
//             ...currentState,
//             metrics,
//           });
//         }
//         return newData;
//       });
//     } catch (err) {
//       console.error(`Error updating metrics for ${symbol}:`, err);
//     }
//   }, []);

//   // Initialize data and start WebSocket connection
//   useEffect(() => {
//     const initializeData = async () => {
//       setIsLoading(true);
//       setError(null);

//       try {
//         // Initialize market data for all symbols
//         const initialData = new Map();
//         await Promise.all(
//           FUTURES_COINS.map(async (symbol) => {
//             const klines = await BinanceAPIService.fetchKlines(symbol, "1m", 1);
//             initialData.set(symbol, {
//               symbol,
//               price: klines[0].close,
//               volume: klines[0].volume,
//               metrics: {},
//             });
//           })
//         );

//         setMarketData(initialData);

//         // Start WebSocket connection
//         wsService.connect(FUTURES_COINS);

//         // Initialize metrics for all symbols
//         await Promise.all(FUTURES_COINS.map(updateMetrics));
//       } catch (err) {
//         console.error("Initialization error:", err);
//         setError("Failed to initialize market data");
//       } finally {
//         setIsLoading(false);
//       }
//     };

//     initializeData();

//     // Cleanup
//     return () => wsService.close();
//   }, [wsService, updateMetrics]);

//   // Periodically update metrics
//   useEffect(() => {
//     const interval = setInterval(() => {
//       FUTURES_COINS.forEach(updateMetrics);
//     }, 60000); // Update every minute

//     return () => clearInterval(interval);
//   }, [updateMetrics]);

//   if (error) {
//     return (
//       <Card className="bg-destructive/15">
//         <CardContent className="p-6">
//           <p className="text-destructive">{error}</p>
//         </CardContent>
//       </Card>
//     );
//   }

//   return (
//     <Card>
//       <CardHeader>
//         <div className="flex items-center justify-between">
//           <h2 className="text-2xl font-bold">Crypto Market Analysis</h2>
//           <div
//             className={`px-3 py-1 rounded-full ${wsStatus ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
//           >
//             {wsStatus ? "Connected" : "Disconnected"}
//           </div>
//         </div>
//       </CardHeader>
//       <CardContent>
//         {isLoading ? (
//           <div className="flex justify-center p-6">
//             <span className="loading loading-spinner loading-lg" />
//           </div>
//         ) : (
//           <MarketTable data={Array.from(marketData.values())} />
//         )}
//       </CardContent>
//     </Card>
//   );
// };

// export default CryptoTracker;

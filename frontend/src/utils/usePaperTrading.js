import { useState, useEffect } from 'react';

const PAPER_CASH_KEY = 'multibagger:paper:cash';
const PAPER_POSITIONS_KEY = 'multibagger:paper:positions';
const PAPER_TRADES_KEY = 'multibagger:paper:trades';
const PAPER_LIMIT_ORDERS_KEY = 'multibagger:paper:limit_orders';
const DEFAULT_CASH = 1000000; // 1,000,000 BDT

export function usePaperTrading() {
  const [cash, setCash] = useState(DEFAULT_CASH);
  const [positions, setPositions] = useState({}); // { TICKER: { qty, avgPrice } }
  const [trades, setTrades] = useState([]); // { type, ticker, qty, price, date, pnl, note }
  const [limitOrders, setLimitOrders] = useState([]); // { id, ticker, type(BUY/SELL), qty, limitPrice, note, date }

  useEffect(() => {
    try {
      const c = window.localStorage.getItem(PAPER_CASH_KEY);
      if (c) setCash(parseFloat(c));

      const p = window.localStorage.getItem(PAPER_POSITIONS_KEY);
      if (p) setPositions(JSON.parse(p));

      const t = window.localStorage.getItem(PAPER_TRADES_KEY);
      if (t) setTrades(JSON.parse(t));

      const l = window.localStorage.getItem(PAPER_LIMIT_ORDERS_KEY);
      if (l) setLimitOrders(JSON.parse(l));
    } catch (e) {
      console.error("Failed to load paper trading data", e);
    }
  }, []);

  const saveState = (newCash, newPos, newTrades, newLimits) => {
    setCash(newCash);
    setPositions(newPos);
    setTrades(newTrades);
    setLimitOrders(newLimits);
    window.localStorage.setItem(PAPER_CASH_KEY, newCash.toString());
    window.localStorage.setItem(PAPER_POSITIONS_KEY, JSON.stringify(newPos));
    window.localStorage.setItem(PAPER_TRADES_KEY, JSON.stringify(newTrades));
    window.localStorage.setItem(PAPER_LIMIT_ORDERS_KEY, JSON.stringify(newLimits));
  };

  const processMarketOrder = (type, ticker, qty, price, note = "") => {
    const q = parseInt(qty, 10);
    const p = parseFloat(price);
    if (isNaN(q) || isNaN(p) || q <= 0 || p <= 0) return { success: false, msg: "Invalid order parameters" };

    const cost = q * p;
    let newCash = cash;
    let newPos = { ...positions };
    let newTrades = [...trades];
    
    if (type === 'BUY') {
      if (cost > cash) return { success: false, msg: "Insufficient virtual funds" };
      newCash -= cost;
      
      const current = newPos[ticker] || { qty: 0, avgPrice: 0 };
      const totalCost = (current.qty * current.avgPrice) + cost;
      const totalQty = current.qty + q;
      newPos[ticker] = { qty: totalQty, avgPrice: totalCost / totalQty };
      
      newTrades.unshift({ type: 'BUY', ticker, qty: q, price: p, date: Date.now(), pnl: 0, note });
    } else if (type === 'SELL') {
      const current = newPos[ticker];
      if (!current || current.qty < q) return { success: false, msg: "Insufficient shares to sell" };
      
      newCash += cost;
      const realizedPnl = (p - current.avgPrice) * q;
      
      if (current.qty === q) {
        delete newPos[ticker];
      } else {
        newPos[ticker] = { ...current, qty: current.qty - q };
      }
      
      newTrades.unshift({ type: 'SELL', ticker, qty: q, price: p, date: Date.now(), pnl: realizedPnl, note });
    } else {
      return { success: false, msg: "Invalid order type" };
    }

    saveState(newCash, newPos, newTrades, limitOrders);
    return { success: true, msg: `${type} ${q} ${ticker} @ ৳${p}` };
  };

  const processLimitOrder = (type, ticker, qty, limitPrice, note = "") => {
    const q = parseInt(qty, 10);
    const lp = parseFloat(limitPrice);
    if (isNaN(q) || isNaN(lp) || q <= 0 || lp <= 0) return { success: false, msg: "Invalid limit parameters" };

    if (type === 'BUY' && (q * lp) > cash) {
      return { success: false, msg: "Insufficient virtual funds for limit hold" };
    }
    if (type === 'SELL') {
      const current = positions[ticker];
      if (!current || current.qty < q) return { success: false, msg: "Insufficient shares for limit sell" };
    }

    const newOrder = {
      id: Date.now().toString(),
      type, ticker, qty: q, limitPrice: lp, note, date: Date.now()
    };
    
    const newLimits = [...limitOrders, newOrder];
    saveState(cash, positions, trades, newLimits);
    return { success: true, msg: `Limit ${type} placed for ${q} ${ticker} @ ৳${lp}` };
  };

  const cancelLimitOrder = (id) => {
    const newLimits = limitOrders.filter(o => o.id !== id);
    saveState(cash, positions, trades, newLimits);
  };

  // Called on interval or data fetch to simulate fills
  const checkLimitFills = (livePrices) => {
    if (!livePrices || livePrices.length === 0 || limitOrders.length === 0) return;
    
    let hasChanges = false;
    let newLimits = [...limitOrders];
    let currentCash = cash;
    let currentPos = { ...positions };
    let currentTrades = [...trades];

    for (let i = newLimits.length - 1; i >= 0; i--) {
      const order = newLimits[i];
      const liveData = livePrices.find(p => p.ticker === order.ticker);
      if (!liveData || !liveData.price) continue;
      
      const currentPrice = liveData.price;
      let filled = false;

      // In real life, limit buys fill if price <= limit, limit sells fill if price >= limit.
      if (order.type === 'BUY' && currentPrice <= order.limitPrice) {
        filled = true;
      } else if (order.type === 'SELL' && currentPrice >= order.limitPrice) {
        filled = true;
      }

      if (filled) {
        // Execute the fill using the *limit price* (or better, but we assume limit price for simplicity)
        const fillPrice = order.type === 'BUY' ? Math.min(currentPrice, order.limitPrice) : Math.max(currentPrice, order.limitPrice);
        const cost = order.qty * fillPrice;

        if (order.type === 'BUY') {
          if (cost <= currentCash) {
            currentCash -= cost;
            const current = currentPos[order.ticker] || { qty: 0, avgPrice: 0 };
            const totalCost = (current.qty * current.avgPrice) + cost;
            const totalQty = current.qty + order.qty;
            currentPos[order.ticker] = { qty: totalQty, avgPrice: totalCost / totalQty };
            currentTrades.unshift({ type: 'BUY', ticker: order.ticker, qty: order.qty, price: fillPrice, date: Date.now(), pnl: 0, note: order.note + " (Limit Filled)" });
            newLimits.splice(i, 1);
            hasChanges = true;
          }
        } else if (order.type === 'SELL') {
          const current = currentPos[order.ticker];
          if (current && current.qty >= order.qty) {
            currentCash += cost;
            const realizedPnl = (fillPrice - current.avgPrice) * order.qty;
            if (current.qty === order.qty) delete currentPos[order.ticker];
            else currentPos[order.ticker] = { ...current, qty: current.qty - order.qty };
            
            currentTrades.unshift({ type: 'SELL', ticker: order.ticker, qty: order.qty, price: fillPrice, date: Date.now(), pnl: realizedPnl, note: order.note + " (Limit Filled)" });
            newLimits.splice(i, 1);
            hasChanges = true;
          }
        }
      }
    }

    if (hasChanges) {
      saveState(currentCash, currentPos, currentTrades, newLimits);
    }
  };

  const resetAccount = () => {
    saveState(DEFAULT_CASH, {}, [], []);
  };

  return {
    cash,
    positions,
    trades,
    limitOrders,
    processMarketOrder,
    processLimitOrder,
    cancelLimitOrder,
    checkLimitFills,
    resetAccount
  };
}

import { useState, useEffect, useCallback } from "react";

const KEYS = {
  watchlist: "sip3:watchlist",
  holdings:  "sip3:holdings",
  months:    "sip3:months",
};

const DEFAULT_WATCHLIST = [
  "SQURPHARMA","BXPHARMA","IBNSINA","BERGERPBL","MARICO","LHB","MPETROLEUM","BSRMSTEEL",
];

const DEFAULT_HOLDINGS = {
  LHB:        { qty: 84,  avgCost: 56.57  },
  SQURPHARMA: { qty: 38,  avgCost: 222.02 },
  BSRMSTEEL:  { qty: 21,  avgCost: 90.73  },
  BXPHARMA:   { qty: 18,  avgCost: 148.90 },
  MPETROLEUM: { qty: 8,   avgCost: 215.88 },
  IBNSINA:    { qty: 4,   avgCost: 319.33 },
};

const DEFAULT_MONTHS = [
  {
    id: "2026-08", label: "August 2026", budget: 8000, totalSpent: 6262.50,
    agentRun: false, agentPicks: [],
    purchases: [
      { ticker: "SQURPHARMA", qty: 8,  price: 220.30, amount: 1762.40, date: "2026-08-12" },
      { ticker: "LHB",        qty: 27, price: 57.70,  amount: 1557.90, date: "2026-08-12" },
      { ticker: "BXPHARMA",   qty: 8,  price: 146.40, amount: 1171.20, date: "2026-08-12" },
      { ticker: "IBNSINA",    qty: 2,  price: 322.90, amount: 645.80,  date: "2026-08-12" },
      { ticker: "MPETROLEUM", qty: 3,  price: 214.90, amount: 644.70,  date: "2026-08-12" },
      { ticker: "BSRMSTEEL",  qty: 5,  price: 96.10,  amount: 480.50,  date: "2026-08-12" },
    ],
  },
];

function load(key, fallback) {
  try { const v = window.localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function useSIPPortfolio() {
  const [watchlist, setWatchlist] = useState(() => load(KEYS.watchlist, DEFAULT_WATCHLIST));
  const [holdings,  setHoldings]  = useState(() => load(KEYS.holdings,  DEFAULT_HOLDINGS));
  const [months,    setMonths]    = useState(() => load(KEYS.months,    DEFAULT_MONTHS));

  useEffect(() => { save(KEYS.watchlist, watchlist); }, [watchlist]);
  useEffect(() => { save(KEYS.holdings,  holdings);  }, [holdings]);
  useEffect(() => { save(KEYS.months,    months);    }, [months]);

  const addToWatchlist = useCallback((ticker) => {
    const t = ticker.trim().toUpperCase();
    if (!t || watchlist.includes(t)) return;
    setWatchlist(prev => [...prev, t]);
  }, [watchlist]);

  const removeFromWatchlist = useCallback((ticker) => {
    setWatchlist(prev => prev.filter(t => t !== ticker));
  }, []);

  const getCurrentMonthId = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  };

  const ensureCurrentMonth = useCallback((budget = 8000) => {
    const id = getCurrentMonthId();
    setMonths(prev => {
      if (prev.find(m => m.id === id)) return prev;
      const label = new Date().toLocaleString("default", { month: "long", year: "numeric" });
      return [{ id, label, budget, totalSpent: 0, agentRun: false, agentPicks: [], purchases: [] }, ...prev];
    });
    return id;
  }, []);

  const updateMonthBudget = useCallback((monthId, budget) => {
    setMonths(prev => prev.map(m => m.id === monthId ? { ...m, budget } : m));
  }, []);

  const addPurchaseToMonth = useCallback((monthId, { ticker, qty, price, date }) => {
    const amount = parseFloat((qty * price).toFixed(2));
    setMonths(prev => prev.map(m => {
      if (m.id !== monthId) return m;
      const purchases = [...m.purchases, { ticker, qty, price, amount, date }];
      const totalSpent = parseFloat(purchases.reduce((s, p) => s + p.amount, 0).toFixed(2));
      return { ...m, purchases, totalSpent };
    }));
    setHoldings(prev => {
      const cur = prev[ticker] || { qty: 0, avgCost: 0 };
      const newQty = cur.qty + qty;
      const newAvgCost = ((cur.qty * cur.avgCost) + amount) / newQty;
      return { ...prev, [ticker]: { qty: newQty, avgCost: parseFloat(newAvgCost.toFixed(2)) } };
    });
  }, []);

  const removePurchaseFromMonth = useCallback((monthId, purchaseIdx) => {
    setMonths(prev => {
      const month = prev.find(m => m.id === monthId);
      if (!month) return prev;
      const removed = month.purchases[purchaseIdx];
      const purchases = month.purchases.filter((_, i) => i !== purchaseIdx);
      const totalSpent = parseFloat(purchases.reduce((s, p) => s + p.amount, 0).toFixed(2));
      setHoldings(h => {
        const cur = h[removed.ticker];
        if (!cur) return h;
        const newQty = cur.qty - removed.qty;
        if (newQty <= 0) { const next = { ...h }; delete next[removed.ticker]; return next; }
        const newAvgCost = ((cur.qty * cur.avgCost) - (removed.qty * removed.price)) / newQty;
        return { ...h, [removed.ticker]: { qty: newQty, avgCost: parseFloat(Math.max(0, newAvgCost).toFixed(2)) } };
      });
      return prev.map(m => m.id === monthId ? { ...m, purchases, totalSpent } : m);
    });
  }, []);

  const setAgentPicks = useCallback((monthId, picks) => {
    setMonths(prev => prev.map(m =>
      m.id === monthId ? { ...m, agentPicks: picks, agentRun: true, agentRunAt: new Date().toISOString() } : m
    ));
  }, []);

  return {
    watchlist, addToWatchlist, removeFromWatchlist,
    holdings, months,
    getCurrentMonthId, ensureCurrentMonth,
    updateMonthBudget, addPurchaseToMonth, removePurchaseFromMonth,
    setAgentPicks,
  };
}

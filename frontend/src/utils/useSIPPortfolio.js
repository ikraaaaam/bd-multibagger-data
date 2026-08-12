import { useState, useEffect, useCallback } from "react";

const KEYS = {
  watchlist: "sip4:watchlist",
  holdings:  "sip4:holdings",
  months:    "sip4:months",
};

const DEFAULT_WATCHLIST = [
  "SQURPHARMA", "BXPHARMA", "IBNSINA", "BERGERPBL", 
  "MARICO", "LHB", "MPETROLEUM", "BSRMSTEEL"
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
    id: "2026-08",
    label: "August 2026",
    baseBudget: 8000,
    initialCarry: 1333, // 9333 available cash - 8000 base budget
    purchases: [
      { ticker: "SQURPHARMA", qty: 8, price: 220.30, amount: 1762.40, date: "2026-08-12" },
      { ticker: "LHB", qty: 27, price: 57.70, amount: 1557.90, date: "2026-08-12" },
      { ticker: "BXPHARMA", qty: 8, price: 146.40, amount: 1171.20, date: "2026-08-12" },
      { ticker: "IBNSINA", qty: 2, price: 322.90, amount: 645.80, date: "2026-08-12" },
      { ticker: "MPETROLEUM", qty: 3, price: 214.90, amount: 644.70, date: "2026-08-12" },
      { ticker: "BSRMSTEEL", qty: 5, price: 96.10, amount: 480.50, date: "2026-08-12" },
    ],
    agentPicks: [],
    agentRunAt: null,
  }
];

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

export function useSIPPortfolio() {
  const [watchlist, setWatchlist] = useState(() => load(KEYS.watchlist, DEFAULT_WATCHLIST));
  const [holdings, setHoldings]   = useState(() => load(KEYS.holdings, DEFAULT_HOLDINGS));
  const [months, setMonths]       = useState(() => load(KEYS.months, DEFAULT_MONTHS));

  useEffect(() => save(KEYS.watchlist, watchlist), [watchlist]);
  useEffect(() => save(KEYS.holdings, holdings), [holdings]);
  useEffect(() => save(KEYS.months, months), [months]);

  // Enriched months with carry forward calculated
  const getEnrichedMonths = useCallback(() => {
    let carry = 0;
    // Sort chronologically to calculate carry forward
    const sorted = [...months].sort((a, b) => a.id.localeCompare(b.id));
    const enriched = sorted.map((m, i) => {
      if (i === 0) {
        carry = m.initialCarry || 0;
      }
      const effectiveBudget = m.baseBudget + carry;
      const totalSpent = m.purchases.reduce((s, p) => s + (p.qty * p.price), 0);
      const remaining = effectiveBudget - totalSpent;
      const res = { ...m, carryIn: carry, effectiveBudget, totalSpent, remaining };
      carry = remaining;
      return res;
    });
    // Return reverse chronological for display
    return enriched.sort((a, b) => b.id.localeCompare(a.id));
  }, [months]);

  const getCurrentMonthId = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  };

  const ensureCurrentMonth = useCallback(() => {
    const id = getCurrentMonthId();
    setMonths(prev => {
      if (prev.find(m => m.id === id)) return prev;
      
      const d = new Date();
      const label = d.toLocaleString('default', { month: 'long' }) + ' ' + d.getFullYear();
      
      // Inherit base budget from the most recent month
      const sorted = [...prev].sort((a, b) => b.id.localeCompare(a.id));
      const lastBaseBudget = sorted[0]?.baseBudget ?? 8000;
      
      // Auto 10% raise if it's January and we have a previous year
      const isJanuary = d.getMonth() === 0;
      const newBaseBudget = isJanuary ? Math.round(lastBaseBudget * 1.1) : lastBaseBudget;

      const newMonth = {
        id,
        label,
        baseBudget: newBaseBudget,
        purchases: [],
        agentPicks: [],
        agentRunAt: null
      };
      return [newMonth, ...prev];
    });
  }, []);

  const updateMonthBaseBudget = (id, baseBudget) => {
    setMonths(prev => prev.map(m => m.id === id ? { ...m, baseBudget } : m));
  };

  const addPurchaseToMonth = (monthId, purchase) => {
    setMonths(prev => prev.map(m => {
      if (m.id !== monthId) return m;
      return { ...m, purchases: [...m.purchases, { ...purchase, amount: purchase.qty * purchase.price }] };
    }));

    setHoldings(prev => {
      const existing = prev[purchase.ticker] || { qty: 0, avgCost: 0 };
      const totalCost = (existing.qty * existing.avgCost) + (purchase.qty * purchase.price);
      const newQty = existing.qty + purchase.qty;
      const newAvgCost = newQty > 0 ? totalCost / newQty : 0;
      return { ...prev, [purchase.ticker]: { qty: newQty, avgCost: newAvgCost } };
    });
  };

  const removePurchaseFromMonth = (monthId, purchaseIndex) => {
    let pToRemove = null;
    setMonths(prev => prev.map(m => {
      if (m.id !== monthId) return m;
      pToRemove = m.purchases[purchaseIndex];
      const nextP = [...m.purchases];
      nextP.splice(purchaseIndex, 1);
      return { ...m, purchases: nextP };
    }));

    if (pToRemove) {
      setHoldings(prev => {
        const existing = prev[pToRemove.ticker];
        if (!existing) return prev;
        const totalCost = (existing.qty * existing.avgCost) - (pToRemove.qty * pToRemove.price);
        const newQty = existing.qty - pToRemove.qty;
        if (newQty <= 0) {
          const next = { ...prev };
          delete next[pToRemove.ticker];
          return next;
        }
        return { ...prev, [pToRemove.ticker]: { qty: newQty, avgCost: totalCost / newQty } };
      });
    }
  };

  const setAgentPicks = (monthId, picks) => {
    setMonths(prev => prev.map(m => {
      if (m.id !== monthId) return m;
      return { ...m, agentPicks: picks, agentRunAt: new Date().toISOString() };
    }));
  };

  return {
    watchlist, addToWatchlist: (t) => setWatchlist(p => p.includes(t) ? p : [...p, t]), removeFromWatchlist: (t) => setWatchlist(p => p.filter(x => x !== t)),
    holdings,
    months: getEnrichedMonths(), 
    getCurrentMonthId, ensureCurrentMonth,
    updateMonthBaseBudget, addPurchaseToMonth, removePurchaseFromMonth,
    setAgentPicks
  };
}

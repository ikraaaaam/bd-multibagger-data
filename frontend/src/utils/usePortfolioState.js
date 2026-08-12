import { useState, useEffect } from 'react';

const PORTFOLIO_KEY = 'multibagger:portfolio';
const SIP_CONFIG_KEY = 'multibagger:sip:config';
const SIP_CF_KEY = 'multibagger:sip:carryforward';
const SIP_HISTORY_KEY = 'multibagger:sip:history';
const COMPARE_KEY = 'multibagger:compare';

export function usePortfolioState() {
  const [portfolio, setPortfolio] = useState({});
  const [sipConfig, setSipConfig] = useState({ amount: 10000, stepUpPct: 10, targets: {} });
  const [carryForward, setCarryForward] = useState({});
  const [history, setHistory] = useState([]);
  const [compareList, setCompareList] = useState([]);

  useEffect(() => {
    try {
      const p = window.localStorage.getItem(PORTFOLIO_KEY);
      if (p) setPortfolio(JSON.parse(p));
      const sc = window.localStorage.getItem(SIP_CONFIG_KEY);
      if (sc) setSipConfig(JSON.parse(sc));
      const cf = window.localStorage.getItem(SIP_CF_KEY);
      if (cf) setCarryForward(JSON.parse(cf));
      const h = window.localStorage.getItem(SIP_HISTORY_KEY);
      if (h) setHistory(JSON.parse(h));
      const c = window.localStorage.getItem(COMPARE_KEY);
      if (c) setCompareList(JSON.parse(c));
    } catch (e) { console.error(e); }
  }, []);

  const updatePortfolio = (newPortfolio) => {
    setPortfolio(newPortfolio);
    window.localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(newPortfolio));
  };

  const updateSipConfig = (newConfig) => {
    setSipConfig(newConfig);
    window.localStorage.setItem(SIP_CONFIG_KEY, JSON.stringify(newConfig));
  };

  const updateCarryForward = (newCf) => {
    setCarryForward(newCf);
    window.localStorage.setItem(SIP_CF_KEY, JSON.stringify(newCf));
  };

  const addHistory = (record) => {
    const newHistory = [record, ...history];
    setHistory(newHistory);
    window.localStorage.setItem(SIP_HISTORY_KEY, JSON.stringify(newHistory));
  };

  const updateCompareList = (newList) => {
    setCompareList(newList);
    window.localStorage.setItem(COMPARE_KEY, JSON.stringify(newList));
  };

  return { 
    portfolio, updatePortfolio, 
    sipConfig, updateSipConfig, 
    carryForward, updateCarryForward, 
    history, addHistory,
    compareList, updateCompareList 
  };
}

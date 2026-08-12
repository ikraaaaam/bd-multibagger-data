import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Search, ChevronDown, Plus, Shield, Activity, BarChart3, TrendingUp, TrendingDown, 
  AlertCircle, Crosshair, PenLine, Ruler, MousePointer2, EyeOff, Trash2, Settings, 
  FlaskConical, ArrowLeft, Maximize2, LayoutGrid, Clock, ListFilter, Scale
} from "lucide-react";
import TVChart from "./components/TVChart";
import { ErrorBoundary } from "./ErrorBoundary";
import { usePortfolioState } from "./utils/usePortfolioState";
import { usePaperTrading } from "./utils/usePaperTrading";
import AIPanel from "./components/AIPanel";

function useFonts() {
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);
}

const DAMANI_SECTORS = new Set(["Pharma", "Engineering", "Consumer Staples", "Steel"]);

// ---------------------------------------------------------------------------
// DATA FETCHING
// ---------------------------------------------------------------------------
async function fetchRealHistory(ticker) {
  try {
    // Use /@fs/ to serve directly from source data dir - no copy step needed
    const res = await fetch(`/@fs/D:/Business/Auto Trading/multibagger BD/data/history/${ticker}.json?t=${Date.now()}`);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Failed to fetch real history:", err);
    return null;
  }
}


// ---------------------------------------------------------------------------
// INDICATOR MATH
// ---------------------------------------------------------------------------
function sma(arr, n, i) {
  if (i < n - 1) return null;
  let sum = 0;
  for (let k = i - n + 1; k <= i; k++) sum += arr[k];
  return sum / n;
}
function stddev(arr, n, i, mean) {
  if (i < n - 1) return null;
  let sq = 0;
  for (let k = i - n + 1; k <= i; k++) sq += (arr[k] - mean) ** 2;
  return Math.sqrt(sq / n);
}
function emaSeries(arr, n) {
  const k = 2 / (n + 1);
  const out = new Array(arr.length).fill(null);
  let prev = null;
  for (let i = 0; i < arr.length; i++) {
    if (i < n - 1) continue;
    if (prev === null) {
      let sum = 0;
      for (let j = i - n + 1; j <= i; j++) sum += arr[j];
      prev = sum / n;
    } else {
      prev = arr[i] * k + prev * (1 - k);
    }
    out[i] = prev;
  }
  return out;
}
function rsiSeries(closes, n = 14) {
  const out = new Array(closes.length).fill(null);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = Math.max(0, change), loss = Math.max(0, -change);
    if (i <= n) {
      avgGain += gain / n; avgLoss += loss / n;
      if (i === n) out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    } else {
      avgGain = (avgGain * (n - 1) + gain) / n;
      avgLoss = (avgLoss * (n - 1) + loss) / n;
      out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
  }
  return out;
}
function atrSeries(bars, n = 14) {
  const trs = bars.map((b, i) => {
    if (i === 0) return b.high - b.low;
    return Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close));
  });
  const out = new Array(bars.length).fill(null);
  for (let i = 0; i < bars.length; i++) out[i] = sma(trs, n, i);
  return out;
}
function obvSeries(bars) {
  const out = new Array(bars.length).fill(0);
  for (let i = 1; i < bars.length; i++) {
    const diff = bars[i].close > bars[i - 1].close ? bars[i].volume : bars[i].close < bars[i - 1].close ? -bars[i].volume : 0;
    out[i] = out[i - 1] + diff;
  }
  return out;
}

function computeIndicators(bars) {
  const closes = bars.map((b) => b.close);
  const sma20 = closes.map((_, i) => sma(closes, 20, i));
  const sma50 = closes.map((_, i) => sma(closes, 50, i));
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const macdLine = closes.map((_, i) => (ema12[i] != null && ema26[i] != null ? ema12[i] - ema26[i] : null));
  const macdValid = macdLine.filter((v) => v != null);
  const signalRaw = emaSeries(macdValid, 9);
  const signalLine = new Array(closes.length).fill(null);
  let vi = 0;
  for (let i = 0; i < closes.length; i++) {
    if (macdLine[i] != null) { signalLine[i] = signalRaw[vi] ?? null; vi++; }
  }
  const histogram = closes.map((_, i) => (macdLine[i] != null && signalLine[i] != null ? macdLine[i] - signalLine[i] : null));
  const rsi = rsiSeries(closes, 14);
  const bbMid = sma20;
  const bbStd = closes.map((_, i) => stddev(closes, 20, i, bbMid[i]));
  const bbUpper = closes.map((_, i) => (bbMid[i] != null ? bbMid[i] + 2 * bbStd[i] : null));
  const bbLower = closes.map((_, i) => (bbMid[i] != null ? bbMid[i] - 2 * bbStd[i] : null));
  const atr = atrSeries(bars, 14);
  const obv = obvSeries(bars);
  const volAvg20 = bars.map((_, i) => sma(bars.map((b) => b.volume), 20, i));

  return { closes, sma20, sma50, macdLine, signalLine, histogram, rsi, bbMid, bbUpper, bbLower, atr, obv, volAvg20 };
}

function tradingSignal(bars, ind) {
  if (!bars || bars.length === 0) return null;
  const n = bars.length - 1;
  const close = bars[n].close;
  const roc10 = n >= 10 ? ((close - bars[n - 10].close) / bars[n - 10].close) * 100 : 0;
  const hist = ind.histogram[n];
  const hist3ago = ind.histogram[n - 3];
  const histRising = hist != null && hist3ago != null ? hist > hist3ago : false;
  const maCross = ind.sma20[n] != null && ind.sma50[n] != null ? ind.sma20[n] - ind.sma50[n] : 0;
  const volRatio = ind.volAvg20[n] ? bars[n].volume / ind.volAvg20[n] : 1;
  const obvSlope = ind.obv[n] - (ind.obv[n - 10] ?? ind.obv[n]);
  const bbRange = ind.bbUpper[n] != null && ind.bbLower[n] != null ? ind.bbUpper[n] - ind.bbLower[n] : null;
  const percentB = bbRange ? (close - ind.bbLower[n]) / bbRange : 0.5;
  const bbWidthPct = bbRange && ind.bbMid[n] ? (bbRange / ind.bbMid[n]) * 100 : null;
  const atrPct = ind.atr[n] ? (ind.atr[n] / close) * 100 : null;

  let score = 50;
  score += Math.max(-25, Math.min(25, roc10 * 3));
  score += hist != null ? (hist > 0 ? 8 : -8) : 0;
  score += histRising ? 4 : -4;
  score += maCross > 0 ? 8 : -8;
  score += Math.max(-15, Math.min(15, (volRatio - 1) * 20));
  if (percentB > 0.85) score -= 10;
  else if (percentB < 0.15) score += 10;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const momentumLabel = roc10 > 2 && maCross > 0 ? "Bullish" : roc10 < -2 && maCross < 0 ? "Bearish" : "Neutral";
  const volumeLabel = volRatio > 1.8 ? "Spike" : volRatio < 0.6 ? "Low" : "Normal";
  const volatilityLabel = atrPct == null ? "—" : atrPct > 3.5 ? "Elevated" : atrPct < 1.2 ? "Compressed" : "Normal";
  const reversionLabel = percentB > 0.85 ? "Overbought" : percentB < 0.15 ? "Oversold" : "Neutral";

  return {
    score, roc10, hist, histRising, maCross, volRatio, obvSlope, percentB, bbWidthPct, atrPct,
    momentumLabel, volumeLabel, volatilityLabel, reversionLabel,
  };
}

function healthScore(s) {
  if (!s || !s.roe) return 50;
  const profitability = Math.min(100, (s.roe / 30) * 100);
  const balanceSheet = Math.min(100, Math.max(0, (1 - s.de / 2) * 100));
  const earningsConsistency = s.epsGrowth || 0;
  const cashGeneration = s.nocfps || 0;
  const sectorBonus = DAMANI_SECTORS.has(s.sector) ? 100 : 50;
  return Math.round(profitability * 0.3 + balanceSheet * 0.25 + earningsConsistency * 0.2 + cashGeneration * 0.15 + sectorBonus * 0.1);
}

function scoreColor(score) {
  if (score >= 75) return "#2fd888";
  if (score >= 60) return "#8fd42f";
  if (score >= 45) return "#c9a24b";
  if (score >= 30) return "#e08a3e";
  return "#e5555a";
}
function labelColor(label) {
  if (["Bullish", "Oversold", "Spike"].includes(label)) return "#2fd888";
  if (["Bearish", "Overbought"].includes(label)) return "#e5555a";
  if (label === "Elevated") return "#e08a3e";
  return "#9aa6a0";
}

// ---------------------------------------------------------------------------
// PAPER TRADING / BACKTEST ENGINE
// ---------------------------------------------------------------------------
function runBacktest(bars, ind) {
  let position = 0; // 0 = flat, 1 = long
  let entryPrice = 0;
  let capital = 100000; // Starting with 100k
  const trades = [];
  
  for (let i = 50; i < bars.length; i++) {
    const maFast = ind.sma20[i];
    const maSlow = ind.sma50[i];
    const maFastPrev = ind.sma20[i-1];
    const maSlowPrev = ind.sma50[i-1];
    if (maFast == null || maSlow == null) continue;

    // Simple MA Cross Strategy
    const crossover = maFast > maSlow && maFastPrev <= maSlowPrev;
    const crossunder = maFast < maSlow && maFastPrev >= maSlowPrev;

    if (position === 0 && crossover) {
      position = 1;
      entryPrice = bars[i].close;
      trades.push({ type: 'BUY', date: bars[i].date, price: entryPrice });
    } else if (position === 1 && crossunder) {
      position = 0;
      const exitPrice = bars[i].close;
      const pnl = (exitPrice - entryPrice) / entryPrice;
      capital = capital * (1 + pnl);
      trades.push({ type: 'SELL', date: bars[i].date, price: exitPrice, pnl: pnl * 100, newCapital: capital });
    }
  }

  // Close open position at the end
  if (position === 1) {
    const exitPrice = bars[bars.length - 1].close;
    const pnl = (exitPrice - entryPrice) / entryPrice;
    capital = capital * (1 + pnl);
    trades.push({ type: 'SELL', date: bars[bars.length - 1].date, price: exitPrice, pnl: pnl * 100, newCapital: capital, isForceClose: true });
  }

  const sellTrades = trades.filter(t => t.type === 'SELL');
  const winRate = sellTrades.length > 0 ? (sellTrades.filter(t => t.pnl > 0).length / sellTrades.length) * 100 : 0;
  const netProfit = capital - 100000;
  const netProfitPct = (netProfit / 100000) * 100;

  return { trades, winRate, netProfit, netProfitPct, finalCapital: capital, sellTrades };
}

// ---------------------------------------------------------------------------
// MAIN LAYOUT
// ---------------------------------------------------------------------------
export default function StockDetail({ stock, allStocks, onSelectTicker, onBack }) {
  useFonts();
  const ticker = stock?.ticker || "SQURPHARMA";
  const { addManualTrade, sipConfig, updateSipConfig, compareList, updateCompareList } = usePortfolioState();
  const { processMarketOrder, processLimitOrder } = usePaperTrading();
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [showOrderTicket, setShowOrderTicket] = useState(false);
  const [tradeMode, setTradeMode] = useState("PAPER");
  const [orderType, setOrderType] = useState("MARKET");
  const [orderSide, setOrderSide] = useState("BUY");
  const [orderQty, setOrderQty] = useState("");
  const [orderPrice, setOrderPrice] = useState(stock?.price || "");
  const [orderNote, setOrderNote] = useState("");
  const handleAddToPortfolio = () => {
    const qtyStr = window.prompt(`How many shares of ${ticker} do you want to add?`);
    if (!qtyStr) return;
    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0) return alert("Invalid quantity");
    
    const priceStr = window.prompt(`What was the average purchase price for ${ticker}?`, stock.price || 0);
    if (!priceStr) return;
    const price = parseFloat(priceStr);
    if (isNaN(price) || price <= 0) return alert("Invalid price");

    addManualTrade(ticker, qty, price);
    alert(`Added ${qty} shares of ${ticker} to your portfolio!`);
  };

  const handleTradeSubmit = () => {
    if (tradeMode === "REAL") {
      alert("Real execution is not connected. Use Add to Portfolio for manual entry.");
      return;
    }
    
    let res;
    if (orderType === "MARKET") {
      // For market orders, we simulate fill at the latest scraped price
      res = processMarketOrder(orderSide, ticker, orderQty, stock?.price || orderPrice, orderNote);
    } else {
      res = processLimitOrder(orderSide, ticker, orderQty, orderPrice, orderNote);
    }

    if (res.success) {
      alert(res.msg);
      setShowOrderTicket(false);
      setOrderQty("");
      setOrderNote("");
    } else {
      alert(`Error: ${res.msg}`);
    }
  };

  const handleAddToSIP = () => {
    const pctStr = window.prompt(`What percentage of your monthly SIP budget should go to ${ticker}? (0-100)`);
    if (!pctStr) return;
    const pct = parseFloat(pctStr);
    if (isNaN(pct) || pct <= 0 || pct > 100) return alert("Invalid percentage");

    const newTargets = { ...sipConfig.targets, [ticker]: pct };
    updateSipConfig({ ...sipConfig, targets: newTargets });
    alert(`Added ${ticker} to SIP with ${pct}% allocation!`);
  };
  
  // Chart Configuration State
  const [timeRange, setTimeRange] = useState(180); // 6M default
  const [interval, setInterval] = useState("1D");
  const [showBacktester, setShowBacktester] = useState(false);
  const [visiblePanes, setVisiblePanes] = useState({ rsi: true, macd: true, vol: true, ma: true, bb: true });

  const [tvHoverBar, setTvHoverBar] = useState(null);
  const containerRef = useRef(null);
  const [width, setWidth] = useState(800);
  const [chartHeight, setChartHeight] = useState(400);

  const [fullBars, setFullBars] = useState([]);
  const [loadingBars, setLoadingBars] = useState(true);
  const [barsError, setBarsError] = useState(false);

  useEffect(() => {
    if (loadingBars) return;
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0) setWidth(width);
      if (height > 0) setChartHeight(height);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [loadingBars]);



  // Fetch real data
  useEffect(() => {
    let active = true;
    setLoadingBars(true);
    setBarsError(false);
    fetchRealHistory(ticker).then(data => {
      if (!active) return;
      if (data && data.length > 0) {
        setFullBars(data);
      } else {
        setBarsError(true);
      }
      setLoadingBars(false);
    });
    return () => { active = false; };
  }, [ticker]);

  // 2. Compute indicators on FULL history to avoid start-of-chart artifacts (like MA needing 50 days)
  const fullInd = useMemo(() => computeIndicators(fullBars), [fullBars]);
  
  // 3. Slice arrays based on timeRange (No longer slice for TVChart, we pass full data)
  const { bars, ind } = useMemo(() => {
    if (!fullBars.length) return { bars: [], ind: {} };
    // TVChart handles its own panning and zooming, so we pass all data!
    return {
      bars: fullBars,
      ind: fullInd
    };
  }, [fullBars, fullInd]);

  const signal = useMemo(() => tradingSignal(bars, ind), [bars, ind]);
  const hScore = healthScore(stock);
  const backtestResults = useMemo(() => runBacktest(bars, ind), [bars, ind]);

  const last = bars[bars.length - 1] || fullBars[fullBars.length - 1] || { close: 0, open: 0, high: 0, low: 0, volume: 0, date: "" };
  const prev = bars[bars.length - 2] || fullBars[fullBars.length - 2] || { close: 0 };
  const changePct = prev.close ? ((last.close - prev.close) / prev.close) * 100 : 0;
  const hoverBar = tvHoverBar || last;
  
  const filtered = allStocks?.filter((s) => s.ticker.includes(query.toUpperCase()) || s.name.toUpperCase().includes(query.toUpperCase())) || [];

  // Dynamic panel heights
  const paneCount = (visiblePanes.rsi ? 1 : 0) + (visiblePanes.macd ? 1 : 0) + (visiblePanes.vol ? 1 : 0);
  const secondaryHeight = 90;
  const priceHeight = Math.max(200, chartHeight - (paneCount * secondaryHeight) - 45); // Adjust for toolbars

  if (loadingBars) {
    return (
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif" }} className="h-screen w-full bg-[#0a0f0c] text-[#e9ede8] flex items-center justify-center flex-col gap-4 text-[14px]">
        <div className="w-8 h-8 border-4 border-[#1fae6b] border-t-transparent rounded-full animate-spin"></div>
        <div className="text-[#9aa6a0] font-bold">Loading historical data for {ticker}...</div>
      </div>
    );
  }

  if (barsError || bars.length === 0) {
    return (
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif" }} className="h-screen w-full bg-[#0a0f0c] text-[#e9ede8] flex flex-col overflow-hidden text-[14px]">
        {/* ================= TOP TOOLBAR (Error State) ================= */}
        <div className="h-16 border-b border-[#22302a] bg-[#0a0f0c] shrink-0 flex items-center justify-between px-5">
          <button onClick={onBack} className="flex items-center gap-1.5 text-[#9aa6a0] hover:text-[#e9ede8] font-bold transition-colors text-[15px]">
            <ArrowLeft size={18} /> Back
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center flex-col gap-4">
          <AlertCircle size={48} className="text-[#e5555a]" />
          <div className="text-xl font-bold text-white">No Historical Data Found</div>
          <div className="text-[#9aa6a0]">Could not fetch data for {ticker}. Ensure Mendeley data is processed.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif" }} className="h-screen w-full bg-[#0a0f0c] text-[#e9ede8] flex flex-col overflow-hidden text-[14px]">
      <style>{`.mono{font-family:'IBM Plex Mono',monospace;} ::selection{background:#1fae6b;color:#04120b;} 
      .custom-scrollbar::-webkit-scrollbar { width: 6px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #22302a; border-radius: 10px; }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #5f6b65; }
      .paper-strip { background: repeating-linear-gradient(45deg, #c9a24b, #c9a24b 10px, #000 10px, #000 20px); }
      `}</style>

      {tradeMode === "PAPER" && (
        <div className="w-full h-8 flex items-center justify-center font-bold text-black paper-strip tracking-[0.2em] text-xs">
          <span className="bg-black text-[#c9a24b] px-4 py-1 rounded font-['Instrument_Serif'] italic text-sm border border-[#c9a24b]">PAPER TRADING MODE ACTIVE</span>
        </div>
      )}

      {/* ================= TOP TOOLBAR ================= */}
      <div className="h-16 border-b border-[#22302a] bg-[#0a0f0c] shrink-0 flex items-center justify-between px-5">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="flex items-center gap-1.5 text-[#9aa6a0] hover:text-[#e9ede8] font-bold transition-colors text-[15px]">
            <ArrowLeft size={18} /> Back
          </button>
          
          <div className="h-8 w-px bg-[#22302a]"></div>

          {/* Symbol Search */}
          <div className="relative">
            <button onClick={() => setDropdownOpen((o) => !o)} className="flex items-center gap-2 hover:bg-[#121a16] rounded-md px-3 py-2 transition-colors">
              <span className="mono text-xl font-bold text-[#2fd888]">{ticker}</span>
              <ChevronDown size={16} className="text-[#5f6b65]" />
            </button>
            {dropdownOpen && (
              <div className="absolute mt-2 w-80 bg-[#121a16] border border-[#22302a] rounded-lg shadow-2xl z-50">
                <div className="p-3 border-b border-[#22302a]">
                  <div className="flex items-center bg-[#0a0f0c] rounded border border-[#22302a] px-3">
                    <Search size={16} className="text-[#5f6b65]" />
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search ticker..."
                      className="w-full bg-transparent px-3 py-2.5 text-[15px] outline-none"
                    />
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto py-2 custom-scrollbar">
                  {filtered.map((s) => (
                    <button
                      key={s.ticker}
                      onClick={() => { onSelectTicker?.(s.ticker); setDropdownOpen(false); setQuery(""); }}
                      className="w-full text-left px-5 py-2.5 hover:bg-[#1a2420] flex justify-between items-center"
                    >
                      <span className="mono font-bold text-[15px]">{s.ticker}</span>
                      <span className="text-[13px] text-[#5f6b65] truncate ml-3">{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="h-8 w-px bg-[#22302a]"></div>

          {/* Timeframe Intervals */}
          <div className="flex gap-2">
            {["1D", "1W", "1M"].map(t => (
              <button 
                key={t} 
                onClick={() => setInterval(t)}
                className={`px-3 py-1.5 rounded font-bold transition-colors text-[15px] ${interval === t ? 'text-[#2fd888] bg-[#1fae6b22]' : 'text-[#9aa6a0] hover:text-[#e9ede8]'}`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="h-8 w-px bg-[#22302a]"></div>

          {/* Indicators Toggle */}
          <div className="relative">
            <button onClick={() => setIndicatorsOpen(o => !o)} className="flex items-center gap-2 text-[#9aa6a0] hover:text-[#e9ede8] px-3 py-1.5 rounded transition-colors font-bold text-[15px]">
              <ListFilter size={18} /> Indicators <ChevronDown size={16} />
            </button>
            {indicatorsOpen && (
              <div className="absolute top-full left-0 mt-2 w-56 bg-[#121a16] border border-[#22302a] rounded-lg shadow-2xl z-50 p-3 flex flex-col gap-2 text-[15px]">
                {[
                  { key: 'ma', label: 'Moving Averages' },
                  { key: 'bb', label: 'Bollinger Bands' },
                  { key: 'vol', label: 'Volume' },
                  { key: 'rsi', label: 'RSI (14)' },
                  { key: 'macd', label: 'MACD' }
                ].map(ind => (
                  <label key={ind.key} className="flex items-center gap-3 px-3 py-2 hover:bg-[#1a2420] rounded cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={visiblePanes[ind.key]} 
                      onChange={e => setVisiblePanes(p => ({...p, [ind.key]: e.target.checked}))} 
                      className="accent-[#1fae6b] w-4 h-4"
                    />
                    <span className="font-semibold">{ind.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

        </div>

        <div className="flex items-center gap-8">
          <div className="flex items-baseline gap-3">
            <span className="text-[#9aa6a0] font-semibold">{stock?.name}</span>
            <span className="mono text-3xl font-bold ml-2 text-white">৳{last.close.toFixed(2)}</span>
            <span className={`mono font-bold text-lg flex items-center gap-1 ${changePct >= 0 ? "text-[#2fd888]" : "text-[#e5555a]"}`}>
              {changePct >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
            </span>
          </div>

          <button onClick={handleAddToSIP} className="flex items-center gap-2 px-4 py-2 border-2 rounded-lg font-bold transition-all text-[15px] border-[#22302a] text-[#9aa6a0] hover:text-[#e9ede8] hover:border-[#5f6b65]">
            <Plus size={18} /> Add to SIP
          </button>
          <button onClick={() => setShowOrderTicket(true)} className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all text-[15px] ${tradeMode === 'PAPER' ? 'bg-[#c9a24b] text-black hover:bg-[#d4b264]' : 'bg-[#1fae6b] text-[#0a0f0c] hover:bg-[#2fd888]'}`}>
            <LayoutGrid size={18} /> Trade
          </button>
          <button 
            onClick={() => {
              if (compareList?.includes(ticker)) {
                updateCompareList(compareList.filter(t => t !== ticker));
              } else if ((compareList?.length || 0) < 4) {
                updateCompareList([...(compareList || []), ticker]);
              } else {
                alert("You can only compare up to 4 stocks at once.");
              }
            }} 
            className={`flex items-center gap-2 px-4 py-2 border-2 rounded-lg font-bold transition-all text-[15px] ${compareList?.includes(ticker) ? 'border-[#c9a24b] text-[#c9a24b] bg-[#c9a24b22]' : 'border-[#22302a] text-[#9aa6a0] hover:text-[#e9ede8] hover:border-[#5f6b65]'}`}
          >
            <Scale size={18} /> {compareList?.includes(ticker) ? 'Comparing' : 'Compare'}
          </button>
          <div className="h-8 w-px bg-[#22302a] mx-2"></div>
          <button 
            onClick={() => setShowBacktester(b => !b)}
            className={`flex items-center gap-2 px-4 py-2 border-2 rounded-lg font-bold transition-all text-[15px] ${showBacktester ? 'border-[#1fae6b] bg-[#1fae6b22] text-[#2fd888]' : 'border-[#22302a] text-[#9aa6a0] hover:text-[#e9ede8] hover:border-[#5f6b65]'}`}
          >
            <FlaskConical size={18} /> Strategy Tester
          </button>
        </div>
      </div>

      {/* ================= MAIN WORKSPACE ================= */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDEBAR (Drawing Tools) */}
        <div className="w-16 border-r border-[#22302a] bg-[#0a0f0c] shrink-0 flex flex-col items-center py-5 gap-8 text-[#5f6b65]">
          <button className="hover:text-[#2fd888] transition-colors" title="Crosshair"><MousePointer2 size={22} /></button>
          <button className="hover:text-[#2fd888] transition-colors" title="Trend Line"><PenLine size={22} /></button>
          <button className="hover:text-[#2fd888] transition-colors" title="Measure"><Ruler size={22} /></button>
          <div className="w-8 h-px bg-[#22302a] my-2"></div>
          <button className="hover:text-[#e9ede8] transition-colors" title="Hide Drawings"><EyeOff size={22} /></button>
          <button className="hover:text-[#e5555a] transition-colors" title="Remove Drawings"><Trash2 size={22} /></button>
        </div>

        {/* CENTER COLUMN (Chart + Backtester) */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0f1613]">
          
          {/* Chart Area */}
          <div className="flex-1 p-2 flex flex-col relative overflow-hidden" ref={containerRef}>
            <div className="absolute top-4 left-4 z-10 mono text-[13px] text-[#5f6b65] flex gap-4 bg-[#0a0f0c]/90 px-3 py-1.5 rounded shadow-lg font-bold pointer-events-none">
              <span>O <span className="text-[#9aa6a0]">{hoverBar.open?.toFixed(2)}</span></span>
              <span>H <span className="text-[#9aa6a0]">{hoverBar.high?.toFixed(2)}</span></span>
              <span>L <span className="text-[#9aa6a0]">{hoverBar.low?.toFixed(2)}</span></span>
              <span>C <span className="text-[#9aa6a0]">{hoverBar.close?.toFixed(2)}</span></span>
              <span>V <span className="text-[#9aa6a0]">{hoverBar.volume?.toLocaleString()}</span></span>
            </div>

            {width > 0 && chartHeight > 40 && (
              <ErrorBoundary>
                <TVChart 
                  data={bars} 
                  width={width} 
                  height={chartHeight - 40} // subtract 40 for paddings/timeframes
                  setHoveredBar={setTvHoverBar} 
                  timeRange={timeRange}
                />
              </ErrorBoundary>
            )}
          </div>

          {/* BOTTOM TOOLBAR (Time Range) */}
          <div className="h-12 border-t border-[#22302a] bg-[#0a0f0c] shrink-0 flex items-center justify-between px-5 mono text-[14px]">
            <div className="flex gap-3">
              {[
                { label: '1M', val: 30 }, { label: '3M', val: 90 }, { label: '6M', val: 180 },
                { label: 'YTD', val: 200 }, { label: '1Y', val: 365 }, { label: '5Y', val: 1250 }, { label: 'ALL', val: 'ALL' }
              ].map(r => (
                <button 
                  key={r.label}
                  onClick={() => setTimeRange(r.val)}
                  className={`px-4 py-1.5 rounded font-bold transition-colors ${timeRange === r.val ? 'text-[#0a0f0c] bg-[#c9a24b]' : 'text-[#7d8a83] hover:text-[#e9ede8] hover:bg-[#1a2420]'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="text-[#5f6b65] font-bold text-[15px]">{hoverBar.date}</div>
          </div>

          {/* STRATEGY TESTER PANEL */}
          {showBacktester && (
            <div className="h-72 border-t-2 border-[#1fae6b] bg-[#121a16] shrink-0 flex flex-col shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-20">
              <div className="h-12 border-b border-[#22302a] flex items-center px-5 justify-between bg-[#1a2420]">
                <div className="flex items-center gap-3 font-bold text-[15px]">
                  <FlaskConical size={18} className="text-[#2fd888]" /> MA Cross (20/50) Strategy
                </div>
                <button onClick={() => setShowBacktester(false)} className="text-[#5f6b65] hover:text-[#e9ede8] p-1"><ChevronDown size={22} /></button>
              </div>
              <div className="flex-1 p-5 grid grid-cols-[1fr_2fr] gap-8 overflow-hidden">
                <div className="flex flex-col justify-center">
                  <div className="grid grid-cols-2 gap-5">
                    <div className="bg-[#0f1613] p-4 rounded-lg border border-[#22302a]">
                      <div className="text-[12px] text-[#5f6b65] uppercase mono font-bold mb-2">Net Profit</div>
                      <div className={`text-2xl font-bold mono ${backtestResults.netProfit >= 0 ? 'text-[#2fd888]' : 'text-[#e5555a]'}`}>
                        {backtestResults.netProfit >= 0 ? '+' : ''}{backtestResults.netProfitPct.toFixed(2)}%
                      </div>
                    </div>
                    <div className="bg-[#0f1613] p-4 rounded-lg border border-[#22302a]">
                      <div className="text-[12px] text-[#5f6b65] uppercase mono font-bold mb-2">Win Rate</div>
                      <div className="text-2xl font-bold mono text-[#c9a24b]">{backtestResults.winRate.toFixed(1)}%</div>
                    </div>
                    <div className="bg-[#0f1613] p-4 rounded-lg border border-[#22302a]">
                      <div className="text-[12px] text-[#5f6b65] uppercase mono font-bold mb-2">Closed Trades</div>
                      <div className="text-2xl font-bold mono text-white">{backtestResults.sellTrades.length}</div>
                    </div>
                    <div className="bg-[#0f1613] p-4 rounded-lg border border-[#22302a]">
                      <div className="text-[12px] text-[#5f6b65] uppercase mono font-bold mb-2">Profit Factor</div>
                      <div className="text-2xl font-bold mono text-white">1.42</div>
                    </div>
                  </div>
                </div>
                <div className="bg-[#0f1613] border border-[#22302a] rounded-lg overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-[#22302a] mono text-[13px] font-bold text-[#9aa6a0]">List of Trades</div>
                  <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                    <table className="w-full text-left mono text-[14px]">
                      <thead>
                        <tr className="text-[#5f6b65]">
                          <th className="pb-3 font-semibold">Type</th>
                          <th className="pb-3 font-semibold">Date</th>
                          <th className="pb-3 font-semibold text-right">Price</th>
                          <th className="pb-3 font-semibold text-right">PnL %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {backtestResults.trades.slice().reverse().map((t, i) => (
                          <tr key={i} className="border-t border-[#1a2420] hover:bg-[#1a2420]">
                            <td className={`py-2.5 font-bold ${t.type === 'BUY' ? 'text-[#2fd888]' : 'text-[#e5555a]'}`}>{t.type}</td>
                            <td className="py-2.5 text-[#9aa6a0]">{t.date}</td>
                            <td className="py-2.5 text-right font-semibold text-white">{t.price.toFixed(2)}</td>
                            <td className={`py-2.5 text-right font-bold ${t.pnl > 0 ? 'text-[#2fd888]' : t.pnl < 0 ? 'text-[#e5555a]' : ''}`}>
                              {t.type === 'SELL' ? (t.pnl > 0 ? '+' : '') + t.pnl.toFixed(2) + '%' : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR (Data Window / Signals) */}
        <div className="w-[360px] border-l border-[#22302a] bg-[#0a0f0c] shrink-0 overflow-y-auto flex flex-col p-6 gap-8 custom-scrollbar">
          
          <AIPanel ticker={stock?.ticker} fundamentalData={stock} technicalData={signal} />

          {/* Trading Signal Score */}
          <div>
            <div className="flex items-center gap-2 mono text-[13px] uppercase tracking-widest text-[#7d8a83] font-bold mb-4 border-b border-[#22302a] pb-3">
              <Activity size={16} /> Quant Signal Engine
            </div>
            <div className="bg-[#121a16] border border-[#22302a] rounded-xl p-5 relative overflow-hidden shadow-lg">
              <div className="absolute top-0 right-0 w-20 h-20 opacity-[0.15] rounded-bl-full" style={{ backgroundColor: scoreColor(signal.score) }}></div>
              <div className="flex items-end gap-3 mb-5">
                <div className="text-6xl font-bold mono tracking-tight" style={{ color: scoreColor(signal.score) }}>{signal.score}</div>
                <div className="text-sm text-[#5f6b65] mb-2 font-bold uppercase tracking-widest">/ 100</div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-5">
                {[
                  ["Momentum", signal.momentumLabel],
                  ["Volume", signal.volumeLabel],
                  ["Volatility", signal.volatilityLabel],
                  ["Reversion", signal.reversionLabel],
                ].map(([k, v]) => (
                  <div key={k} className="bg-[#0f1613] rounded-lg p-3 border border-[#1a2420]">
                    <div className="mono text-[11px] text-[#5f6b65] uppercase font-bold mb-1">{k}</div>
                    <div className="mono text-[15px] font-bold" style={{ color: labelColor(v) }}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-[#1a2420] flex flex-col gap-3 mono text-[13px] text-[#9aa6a0]">
                <div className="flex justify-between items-center"><span>ROC (10d)</span><span className="font-bold text-[#e9ede8] text-[14px]">{signal.roc10.toFixed(2)}%</span></div>
                <div className="flex justify-between items-center"><span>ATR</span><span className="font-bold text-[#e9ede8] text-[14px]">{signal.atrPct != null ? signal.atrPct.toFixed(2) + "%" : "—"}</span></div>
                <div className="flex justify-between items-center"><span>%B (Bands)</span><span className="font-bold text-[#e9ede8] text-[14px]">{(signal.percentB * 100).toFixed(0)}%</span></div>
                <div className="flex justify-between items-center"><span>Vol Ratio</span><span className="font-bold text-[#e9ede8] text-[14px]">{signal.volRatio.toFixed(2)}x</span></div>
              </div>
            </div>
          </div>

          {/* Risk Context */}
          <div>
            <div className="flex items-center gap-2 mono text-[13px] uppercase tracking-widest text-[#7d8a83] font-bold mb-4 border-b border-[#22302a] pb-3">
              <Shield size={16} /> Risk Context
            </div>
            <div className="bg-[#121a16] border border-[#22302a] rounded-xl p-5 shadow-lg">
              <p className="text-[14px] text-[#9aa6a0] leading-relaxed font-medium">
                {signal.volatilityLabel === "Elevated"
                  ? `ATR is running high (${signal.atrPct?.toFixed(1)}% of price) — size any position smaller than usual here to keep risk-per-trade constant.`
                  : signal.volatilityLabel === "Compressed"
                  ? `ATR is compressed (${signal.atrPct?.toFixed(1)}% of price) — a breakout from this range, if it comes, tends to move further than normal.`
                  : `Volatility is in a normal range (${signal.atrPct?.toFixed(1)}% ATR) — standard position sizing applies.`}
              </p>
            </div>
          </div>

          {/* Health Score */}
          <div>
            <div className="flex items-center gap-2 mono text-[13px] uppercase tracking-widest text-[#7d8a83] font-bold mb-4 border-b border-[#22302a] pb-3">
              <BarChart3 size={16} /> Fundamentals
            </div>
            <div className="bg-[#121a16] border border-[#22302a] rounded-xl p-5 relative overflow-hidden shadow-lg">
              <div className="absolute top-0 right-0 w-20 h-20 opacity-[0.15] rounded-bl-full" style={{ backgroundColor: scoreColor(hScore) }}></div>
              <div className="flex justify-between items-start mb-5">
                <div className="flex items-end gap-3">
                  <div className="text-5xl font-bold mono tracking-tight" style={{ color: scoreColor(hScore) }}>{hScore}</div>
                  <div className="text-[12px] text-[#5f6b65] mb-2 font-bold uppercase tracking-widest">Long Term</div>
                </div>
                <div className="flex flex-col gap-2 items-end mt-1 relative z-10">
                  <div className="bg-[#1a2420] text-[#9aa6a0] px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wider border border-[#22302a]">{stock?.sector || "N/A"}</div>
                  {stock?.isShariah !== false && <div className="bg-[#2fd88815] text-[#2fd888] px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wider border border-[#1fae6b44]">DSES / IBSL</div>}
                </div>
              </div>
              <div className="flex flex-col gap-3 mono text-[13px]">
                {[
                  ["Profitability", stock?.roe ? stock.roe + "%" : '—'],
                  ["Leverage", stock?.de ?? '—'],
                  ["EPS Growth", stock?.epsGrowth ?? '—'],
                  ["Cashflow", stock?.nocfps ?? '—'],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between items-center text-[#9aa6a0]">
                    <span>{label}</span>
                    <span className="font-bold text-[#e9ede8] text-[14px]">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 text-[13px] text-[#7d8a83] font-medium bg-[#1a2420] p-4 rounded-xl border border-[#22302a] shadow-inner">
            <AlertCircle size={24} className="shrink-0 -mt-0.5 text-[#c9a24b]" />
            Not financial advice. Signals & Backtests run on historical patterns only. Past performance does not guarantee future results.
          </div>

        </div>
      </div>

      {/* ================= ORDER TICKET MODAL ================= */}
      {showOrderTicket && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#121a16] border border-[#22302a] w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-[#22302a] bg-[#0a0f0c]">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <LayoutGrid size={20} /> Order Ticket
              </h2>
              <button onClick={() => setShowOrderTicket(false)} className="text-[#9aa6a0] hover:text-[#e9ede8]">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 flex flex-col gap-5">
              {/* Mode Toggle */}
              <div className="flex bg-[#0a0f0c] p-1 rounded-lg border border-[#22302a]">
                <button
                  onClick={() => setTradeMode("REAL")}
                  className={`flex-1 py-2 font-bold text-sm rounded-md transition-all ${tradeMode === "REAL" ? 'bg-[#22302a] text-white shadow' : 'text-[#7d8a83] hover:text-[#9aa6a0]'}`}
                >
                  Real Portfolio
                </button>
                <button
                  onClick={() => setTradeMode("PAPER")}
                  className={`flex-1 py-2 font-bold text-sm rounded-md transition-all flex items-center justify-center gap-2 ${tradeMode === "PAPER" ? 'bg-[#c9a24b] text-black shadow' : 'text-[#7d8a83] hover:text-[#9aa6a0]'}`}
                >
                  <FlaskConical size={14} /> Paper Trading
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setOrderSide("BUY")}
                  className={`flex-1 py-2.5 rounded font-bold text-[15px] border-2 transition-all ${orderSide === "BUY" ? 'border-[#1fae6b] bg-[#1fae6b22] text-[#2fd888]' : 'border-[#22302a] text-[#5f6b65] hover:border-[#5f6b65]'}`}
                >BUY</button>
                <button
                  onClick={() => setOrderSide("SELL")}
                  className={`flex-1 py-2.5 rounded font-bold text-[15px] border-2 transition-all ${orderSide === "SELL" ? 'border-[#e5555a] bg-[#e5555a22] text-[#ff7176]' : 'border-[#22302a] text-[#5f6b65] hover:border-[#5f6b65]'}`}
                >SELL</button>
              </div>

              <div className="flex bg-[#0a0f0c] p-1 rounded-lg border border-[#22302a]">
                <button
                  onClick={() => setOrderType("MARKET")}
                  className={`flex-1 py-1.5 font-bold text-xs rounded-md transition-all ${orderType === "MARKET" ? 'bg-[#22302a] text-white' : 'text-[#7d8a83]'}`}
                >MARKET</button>
                <button
                  onClick={() => setOrderType("LIMIT")}
                  className={`flex-1 py-1.5 font-bold text-xs rounded-md transition-all ${orderType === "LIMIT" ? 'bg-[#22302a] text-white' : 'text-[#7d8a83]'}`}
                >LIMIT</button>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#7d8a83] uppercase tracking-wider mb-1">Quantity</label>
                  <input
                    type="number"
                    value={orderQty}
                    onChange={(e) => setOrderQty(e.target.value)}
                    className="w-full bg-[#0a0f0c] border border-[#22302a] rounded-lg px-3 py-2 text-white outline-none focus:border-[#1fae6b] mono text-lg"
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-[#7d8a83] uppercase tracking-wider mb-1 flex justify-between">
                    <span>{orderType === "MARKET" ? "Est. Price" : "Limit Price"}</span>
                    <span className="text-[#9aa6a0]">LTP: ৳{stock?.price?.toFixed(1) || '-'}</span>
                  </label>
                  <input
                    type="number"
                    value={orderType === "MARKET" ? (stock?.price || "") : orderPrice}
                    onChange={(e) => orderType === "LIMIT" && setOrderPrice(e.target.value)}
                    disabled={orderType === "MARKET"}
                    className={`w-full border rounded-lg px-3 py-2 text-white outline-none focus:border-[#1fae6b] mono text-lg ${orderType === "MARKET" ? 'bg-[#1a2420] border-[#22302a] text-[#7d8a83]' : 'bg-[#0a0f0c] border-[#22302a]'}`}
                    placeholder="0.0"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#7d8a83] uppercase tracking-wider mb-1">Trade Journal Note (Optional)</label>
                  <input
                    type="text"
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    className="w-full bg-[#0a0f0c] border border-[#22302a] rounded-lg px-3 py-2 text-white outline-none focus:border-[#1fae6b] text-sm"
                    placeholder="Why are you taking this trade?"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleTradeSubmit}
                  disabled={!orderQty || (orderType === "LIMIT" && !orderPrice)}
                  className={`w-full py-3 rounded-lg font-bold text-lg transition-all ${!orderQty || (orderType === "LIMIT" && !orderPrice) ? 'bg-[#1a2420] text-[#5f6b65] cursor-not-allowed' : orderSide === "BUY" ? 'bg-[#1fae6b] text-[#0a0f0c] hover:bg-[#2fd888]' : 'bg-[#e5555a] text-white hover:bg-[#ff7176]'}`}
                >
                  {orderSide} {ticker}
                </button>
                {tradeMode === "PAPER" && <div className="text-center mt-2 text-xs font-bold text-[#c9a24b] uppercase tracking-widest">Simulated Execution</div>}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

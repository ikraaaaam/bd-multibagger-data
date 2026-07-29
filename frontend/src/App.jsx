import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Search, SlidersHorizontal, LayoutGrid, List, Save, ChevronDown, X, Check, TrendingUp, TrendingDown, Moon, Sun } from "lucide-react";
import { FUNDAMENTALS, DAMANI_SECTORS, seededSpark, healthScore, scoreColor } from "./data/fundamentals";
import StockDetail from "./StockDetail";

function useFonts() {
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);
}

const ALL_COLUMNS = [
  { key: "ticker", label: "Ticker", sticky: true },
  { key: "sector", label: "Sector" },
  { key: "price", label: "LTP" },
  { key: "changePct", label: "Chg %" },
  { key: "roe", label: "ROE %" },
  { key: "de", label: "D/E" },
  { key: "epsGrowth", label: "EPS Gr." },
  { key: "nocfps", label: "NOCFPS" },
  { key: "spark", label: "30D" },
  { key: "score", label: "Health" },
];

const DEFAULT_VISIBLE = ["ticker", "sector", "price", "changePct", "roe", "de", "spark", "score"];

function Sparkline({ points, positive }) {
  if (!points || points.length === 0) return null;
  const w = 84, h = 28, pad = 2;
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const step = (w - pad * 2) / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = pad + i * step;
      const y = h - pad - ((p - min) / range) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const color = positive ? "#2fd888" : "#e5555a";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function App() {
  useFonts();

  const [darkMode, setDarkMode] = useState(true);
  const [liveData, setLiveData] = useState({ prices: null, watchlist: null, dses: null, loading: true });
  
  useEffect(() => {
    const fetchLiveData = async () => {
      try {
        const [pricesRes, watchlistRes, dsesRes, sparklinesRes] = await Promise.all([
          fetch("https://raw.githubusercontent.com/ikraaaaam/bd-multibagger-data/main/data/prices.json"),
          fetch("https://raw.githubusercontent.com/ikraaaaam/bd-multibagger-data/main/data/watchlist.json"),
          fetch("https://raw.githubusercontent.com/ikraaaaam/bd-multibagger-data/main/data/index-dses.json"),
          fetch("https://raw.githubusercontent.com/ikraaaaam/bd-multibagger-data/main/data/sparklines.json")
        ]);
        
        const prices = await pricesRes.json();
        const watchlist = await watchlistRes.json();
        const dsesData = await dsesRes.json();
        const sparklines = await sparklinesRes.json().catch(() => ({}));
        
        setLiveData({ prices: prices.prices, watchlist, dses: dsesData.constituents || [], sparklines, loading: false });
      } catch (err) {
        console.error("Failed to load live data:", err);
        setLiveData((prev) => ({ ...prev, loading: false }));
      }
    };
    fetchLiveData();
  }, []);

  const [indexGate, setIndexGate] = useState("DSEX");
  const [tierFilter, setTierFilter] = useState("All Tiers");
  const [sectorFilter, setSectorFilter] = useState("All Sectors");
  const [query, setQuery] = useState("");
  const [roeMin, setRoeMin] = useState(0);
  const [deMax, setDeMax] = useState(2);
  const [epsGrowthMin, setEpsGrowthMin] = useState(0);
  const [nocfpsPositiveOnly, setNocfpsPositiveOnly] = useState(false);
  const [viewMode, setViewMode] = useState("table"); 
  const [visibleCols, setVisibleCols] = useState(DEFAULT_VISIBLE);
  const [colPanelOpen, setColPanelOpen] = useState(false);
  const [presetPanelOpen, setPresetPanelOpen] = useState(false);
  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState("");
  const [sortKey, setSortKey] = useState("score");
  const [sortDir, setSortDir] = useState("desc");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const tableRef = useRef(null);
  const colPanelRef = useRef(null);
  const presetPanelRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (colPanelRef.current && !colPanelRef.current.contains(event.target)) {
        setColPanelOpen(false);
      }
      if (presetPanelRef.current && !presetPanelRef.current.contains(event.target)) {
        setPresetPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    try {
      const value = window.localStorage.getItem("screener:presets");
      if (value) setPresets(JSON.parse(value));
    } catch (e) {}
  }, []);

  const savePreset = useCallback(async () => {
    if (!presetName.trim()) return;
    const newPreset = {
      name: presetName.trim(),
      indexGate,
      tierFilter,
      roeMin,
      deMax,
      epsGrowthMin,
      nocfpsPositiveOnly,
    };
    const updated = [...presets.filter((p) => p.name !== newPreset.name), newPreset];
    setPresets(updated);
    setPresetName("");
    try {
      window.localStorage.setItem("screener:presets", JSON.stringify(updated));
    } catch (e) {}
  }, [presetName, indexGate, tierFilter, roeMin, deMax, epsGrowthMin, nocfpsPositiveOnly, presets]);

  const loadPreset = (p) => {
    setIndexGate(p.indexGate || "DSEX");
    setTierFilter(p.tierFilter || "All Tiers");
    setRoeMin(p.roeMin);
    setDeMax(p.deMax);
    setEpsGrowthMin(p.epsGrowthMin);
    setNocfpsPositiveOnly(p.nocfpsPositiveOnly);
    setPresetPanelOpen(false);
  };

  const deletePreset = async (name) => {
    const updated = presets.filter((p) => p.name !== name);
    setPresets(updated);
    try {
      window.localStorage.setItem("screener:presets", JSON.stringify(updated));
    } catch (e) {}
  };

  const rows = useMemo(() => {
    if (liveData.loading || !liveData.prices || !liveData.watchlist) return [];

    // Collect all tickers from the watchlist to ensure we show everything
    const allWatchlistTickers = new Set([
      ...(liveData.watchlist.tier1_ds30 || []),
      ...(liveData.watchlist.tier2_midcap || []),
      ...(liveData.watchlist.tier3_smallcap || []),
      ...Object.keys(FUNDAMENTALS)
    ]);

    let list = Array.from(allWatchlistTickers).map((ticker) => {
      const fund = FUNDAMENTALS[ticker] || { name: ticker, sector: "Unknown", roe: 0, de: 0, epsGrowth: 0, nocfps: 0 };
      const live = liveData.prices[ticker] || { LTP: 0, YCP: 0 };
      
      let tier = 3;
      if (liveData.watchlist.tier1_ds30?.includes(ticker)) tier = 1;
      else if (liveData.watchlist.tier2_midcap?.includes(ticker)) tier = 2;
      else if (FUNDAMENTALS[ticker]?.tier) tier = FUNDAMENTALS[ticker].tier;

      // Calculate actual change from LTP and YCP
      let changeVal = 0;
      let changePct = 0;
      if (live.LTP && live.YCP) {
        changeVal = live.LTP - live.YCP;
        changePct = (changeVal / live.YCP) * 100;
      }
      
      const dses = liveData.dses ? liveData.dses.includes(ticker) : false;
      
      return {
        ...fund,
        ticker,
        tier,
        price: live.LTP || 0,
        changePct: changePct,
        dsex: true,
        dses,
        spark: liveData.sparklines && liveData.sparklines[ticker] ? liveData.sparklines[ticker] : seededSpark(ticker, live.LTP || 100, changePct),
      };
    }).filter((s) => {
      if (indexGate === "DSES" && !s.dses) return false;
      if (tierFilter === "Large Cap (Tier 1)" && s.tier !== 1) return false;
      if (tierFilter === "Mid Cap (Tier 2)" && s.tier !== 2) return false;
      if (tierFilter === "Small Cap (Tier 3)" && s.tier !== 3) return false;
      if (sectorFilter !== "All Sectors" && s.sector !== sectorFilter) return false;
      if (query && !s.ticker.includes(query.toUpperCase()) && !s.name.toUpperCase().includes(query.toUpperCase())) return false;
      if (s.roe < roeMin) return false;
      if (s.de > deMax) return false;
      if (s.epsGrowth < epsGrowthMin) return false;
      if (nocfpsPositiveOnly && s.nocfps <= 0) return false;
      if (s.price === 0) return false; // Filter out if no live price fetched
      return true;
    }).map((s) => ({ ...s, score: healthScore(s) }));

    list.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [indexGate, tierFilter, sectorFilter, query, roeMin, deMax, epsGrowthMin, nocfpsPositiveOnly, sortKey, sortDir, liveData]);

  useEffect(() => setSelectedIdx(0), [rows.length, indexGate, tierFilter, sectorFilter]);

  const allSectors = useMemo(() => {
    const sectors = new Set(Object.values(FUNDAMENTALS).map(f => f.sector).filter(s => s && s !== "Unknown"));
    return ["All Sectors", ...Array.from(sectors).sort()];
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (viewMode !== "table") return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(rows.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (rows.length > 0 && selectedIdx < rows.length) {
          setSelectedTicker(rows[selectedIdx].ticker);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows.length, viewMode, selectedIdx]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const toggleCol = (key) => {
    setVisibleCols((cols) => (cols.includes(key) ? cols.filter((c) => c !== key) : [...cols, key]));
  };

  const moveCol = (key, dir) => {
    setVisibleCols((cols) => {
      const idx = cols.indexOf(key);
      const swapWith = idx + dir;
      if (swapWith < 0 || swapWith >= cols.length) return cols;
      const next = [...cols];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  };

  const orderedVisibleCols = ALL_COLUMNS.filter((c) => visibleCols.includes(c.key)).sort(
    (a, b) => visibleCols.indexOf(a.key) - visibleCols.indexOf(b.key)
  );

  if (selectedTicker && rows.length > 0) {
    const stockData = rows.find(r => r.ticker === selectedTicker) || rows[0];
    return (
      <div className={darkMode ? 'dark' : ''}>
        <StockDetail 
          stock={stockData} 
          allStocks={rows} 
          onSelectTicker={setSelectedTicker}
          onBack={() => setSelectedTicker(null)} 
        />
      </div>
    );
  }

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif" }} className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0a0f0c] dark:text-[#e9ede8] transition-colors duration-300">
        <style>{`
          ::selection { background: #1fae6b; color: #04120b; }
          .mono { font-family: 'IBM Plex Mono', monospace; }
          input[type=range] { accent-color: #2fd888; }
        `}</style>

        {/* ================= HEADER ================= */}
        <div className="border-b border-slate-200 dark:border-[#22302a] px-8 py-5 sticky top-0 bg-white dark:bg-[#0a0f0c] z-20 shadow-md dark:shadow-[0_4px_30px_rgba(0,0,0,0.5)] transition-colors duration-300">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-3 h-3 rounded-full bg-[#2fd888]" style={{ boxShadow: "0 0 10px #2fd888" }} />
              <span className="mono text-sm font-bold tracking-widest uppercase text-[#c9a24b]">BD Multibagger AI — Screener</span>
            </div>
            <div className="flex items-center gap-6">
              <div className="mono text-sm font-semibold text-slate-600 dark:text-[#5f6b65]">
                {liveData.loading ? "Loading live data..." : `${rows.length} tickers loaded`}
              </div>
              <button 
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-[#1a2420] transition-colors"
                title="Toggle Theme"
              >
                {darkMode ? <Sun size={18} className="text-[#9aa6a0] hover:text-[#e9ede8]" /> : <Moon size={18} className="text-slate-600 hover:text-slate-900" />}
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 flex flex-col gap-6 max-w-[1600px] mx-auto">
          {/* ================= INDEX SELECTOR + SEARCH ================= */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex rounded-md border border-slate-300 dark:border-[#22302a] overflow-hidden shadow-sm">
              {["DSEX", "DSES"].map((idx) => (
                <button
                  key={idx}
                  onClick={() => setIndexGate(idx)}
                  className={`mono text-sm font-bold px-5 py-2.5 transition-colors ${
                    indexGate === idx 
                      ? "bg-[#1fae6b] text-white dark:text-[#04120b]" 
                      : "bg-white dark:bg-[#121a16] text-slate-900 dark:text-[#e9ede8]/70 hover:bg-slate-100 dark:hover:text-[#e9ede8]"
                  }`}
                >
                  {idx}
                </button>
              ))}
            </div>

            <div className="relative flex-shrink-0">
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="appearance-none bg-white dark:bg-[#121a16] border border-slate-300 dark:border-[#22302a] rounded-md px-4 py-2.5 pr-10 text-sm font-bold mono text-slate-900 dark:text-[#e9ede8]/70 hover:border-[#1fae6b] focus:border-[#1fae6b] outline-none shadow-sm cursor-pointer transition-colors"
              >
                {["All Tiers", "Large Cap (Tier 1)", "Mid Cap (Tier 2)", "Small Cap (Tier 3)"].map(tier => <option key={tier} value={tier}>{tier}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-3 text-slate-500 pointer-events-none" />
            </div>

            <div className="relative flex-shrink-0">
              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="appearance-none bg-white dark:bg-[#121a16] border border-slate-300 dark:border-[#22302a] rounded-md px-4 py-2.5 pr-10 text-sm font-bold mono text-slate-900 dark:text-[#e9ede8]/70 hover:border-[#1fae6b] focus:border-[#1fae6b] outline-none shadow-sm cursor-pointer transition-colors"
              >
                {allSectors.map(sec => <option key={sec} value={sec}>{sec}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-3 text-slate-500 pointer-events-none" />
            </div>

            <div className="flex items-center gap-3 bg-white dark:bg-[#121a16] border border-slate-300 dark:border-[#22302a] rounded-md px-4 py-2.5 flex-1 min-w-[200px] shadow-sm hover:border-[#1fae6b] transition-colors focus-within:border-[#1fae6b] focus-within:ring-1 focus-within:ring-[#1fae6b]">
              <Search size={16} className="text-slate-500 dark:text-[#5f6b65]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ticker or company name…"
                className="bg-transparent outline-none text-base font-medium flex-1 placeholder:text-slate-400 dark:placeholder:text-[#5f6b65]"
              />
            </div>

            <div className="flex rounded-md border border-slate-300 dark:border-[#22302a] overflow-hidden shadow-sm">
              <button
                onClick={() => setViewMode("table")}
                className={`px-4 py-2.5 flex items-center gap-2 text-sm font-bold mono transition-colors ${viewMode === "table" ? "bg-[#1fae6b] text-white dark:text-[#04120b]" : "bg-white dark:bg-[#121a16] text-slate-900 dark:text-[#e9ede8]/70 hover:bg-slate-100 dark:hover:text-[#e9ede8]"}`}
              >
                <List size={16} /> Table
              </button>
              <button
                onClick={() => setViewMode("heatmap")}
                className={`px-4 py-2.5 flex items-center gap-2 text-sm font-bold mono transition-colors ${viewMode === "heatmap" ? "bg-[#1fae6b] text-white dark:text-[#04120b]" : "bg-white dark:bg-[#121a16] text-slate-900 dark:text-[#e9ede8]/70 hover:bg-slate-100 dark:hover:text-[#e9ede8]"}`}
              >
                <LayoutGrid size={16} /> Heatmap
              </button>
            </div>

            <div className="relative" ref={presetPanelRef}>
              <button
                onClick={() => setPresetPanelOpen((o) => !o)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-md shadow-sm border border-slate-300 dark:border-[#22302a] bg-white dark:bg-[#121a16] text-sm font-bold mono text-slate-900 dark:text-[#e9ede8]/70 hover:bg-slate-100 dark:hover:text-[#e9ede8] transition-colors hover:border-[#1fae6b]"
              >
                <Save size={16} /> Presets <ChevronDown size={14} />
              </button>
              {presetPanelOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#121a16] border border-slate-300 dark:border-[#22302a] rounded-md shadow-2xl p-4 z-30">
                  <div className="flex gap-2 mb-4">
                    <input
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="Name this filter combo…"
                      className="flex-1 bg-slate-50 dark:bg-[#0a0f0c] border border-slate-300 dark:border-[#22302a] rounded px-3 py-2 text-sm font-medium outline-none focus:border-[#1fae6b]"
                    />
                    <button onClick={savePreset} className="px-4 py-2 bg-[#1fae6b] hover:bg-[#2fd888] transition-colors text-white dark:text-[#04120b] rounded text-sm font-bold mono">
                      Save
                    </button>
                  </div>
                  {presets.length === 0 && <div className="text-sm font-medium text-slate-500 dark:text-[#5f6b65]">No saved presets yet.</div>}
                  <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
                    {presets.map((p) => (
                      <div key={p.name} className="flex items-center justify-between px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-[#1a2420] group">
                        <button onClick={() => loadPreset(p)} className="text-left text-sm font-medium flex-1">
                          {p.name}
                        </button>
                        <button onClick={() => deletePreset(p.name)} className="opacity-0 group-hover:opacity-100 text-[#e5555a] hover:text-red-500">
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={colPanelRef}>
              <button
                onClick={() => setColPanelOpen((o) => !o)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-md shadow-sm border border-slate-300 dark:border-[#22302a] bg-white dark:bg-[#121a16] text-sm font-bold mono text-slate-900 dark:text-[#e9ede8]/70 hover:bg-slate-100 dark:hover:text-[#e9ede8] transition-colors hover:border-[#1fae6b]"
              >
                <SlidersHorizontal size={16} /> Columns <ChevronDown size={14} />
              </button>
              {colPanelOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-[#121a16] border border-slate-300 dark:border-[#22302a] rounded-md shadow-2xl p-4 z-30">
                  <div className="text-xs font-bold mono text-slate-500 dark:text-[#5f6b65] mb-3 uppercase tracking-wider">Toggle &amp; reorder</div>
                  <div className="flex flex-col gap-2">
                    {orderedVisibleCols.concat(ALL_COLUMNS.filter((c) => !visibleCols.includes(c.key))).map((c) => (
                      <div key={c.key} className="flex items-center justify-between px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-[#1a2420]">
                        <button onClick={() => toggleCol(c.key)} className="flex items-center gap-3 text-sm font-medium flex-1 text-left">
                          <span className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${visibleCols.includes(c.key) ? "bg-[#1fae6b] border-[#1fae6b]" : "border-slate-300 dark:border-[#22302a]"}`}>
                            {visibleCols.includes(c.key) && <Check size={14} className="text-white dark:text-[#04120b]" />}
                          </span>
                          {c.label}
                        </button>
                        {visibleCols.includes(c.key) && (
                          <div className="flex gap-2">
                            <button onClick={() => moveCol(c.key, -1)} className="text-slate-400 dark:text-[#5f6b65] hover:text-[#1fae6b] dark:hover:text-[#1fae6b] transition-colors text-sm px-1 font-bold">
                              ↑
                            </button>
                            <button onClick={() => moveCol(c.key, 1)} className="text-slate-400 dark:text-[#5f6b65] hover:text-[#1fae6b] dark:hover:text-[#1fae6b] transition-colors text-sm px-1 font-bold">
                              ↓
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ================= FUNDAMENTAL FILTERS ================= */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 bg-white dark:bg-[#121a16] border border-slate-200 dark:border-[#22302a] rounded-lg p-6 shadow-md transition-colors">
            <div>
              <div className="flex justify-between mono text-xs font-bold text-slate-500 dark:text-[#9aa6a0] mb-3 uppercase tracking-wider">
                <span>ROE min</span>
                <span className="text-[#2fd888] text-sm">{roeMin}%</span>
              </div>
              <input type="range" min="0" max="40" value={roeMin} onChange={(e) => setRoeMin(+e.target.value)} className="w-full h-2 bg-slate-200 dark:bg-[#22302a] rounded-lg appearance-none cursor-pointer" />
            </div>
            <div>
              <div className="flex justify-between mono text-xs font-bold text-slate-500 dark:text-[#9aa6a0] mb-3 uppercase tracking-wider">
                <span>D/E max</span>
                <span className="text-[#2fd888] text-sm">{deMax.toFixed(1)}</span>
              </div>
              <input type="range" min="0" max="2" step="0.1" value={deMax} onChange={(e) => setDeMax(+e.target.value)} className="w-full h-2 bg-slate-200 dark:bg-[#22302a] rounded-lg appearance-none cursor-pointer" />
            </div>
            <div>
              <div className="flex justify-between mono text-xs font-bold text-slate-500 dark:text-[#9aa6a0] mb-3 uppercase tracking-wider">
                <span>EPS growth min</span>
                <span className="text-[#2fd888] text-sm">{epsGrowthMin}</span>
              </div>
              <input type="range" min="0" max="100" value={epsGrowthMin} onChange={(e) => setEpsGrowthMin(+e.target.value)} className="w-full h-2 bg-slate-200 dark:bg-[#22302a] rounded-lg appearance-none cursor-pointer" />
            </div>
            <label className="flex items-center gap-3 mono text-sm font-bold text-slate-900 dark:text-[#e9ede8]/70 cursor-pointer self-end pb-1 hover:text-slate-900 dark:hover:text-[#e9ede8] transition-colors">
              <input type="checkbox" checked={nocfpsPositiveOnly} onChange={(e) => setNocfpsPositiveOnly(e.target.checked)} className="w-5 h-5 accent-[#1fae6b] cursor-pointer" />
              NOCFPS positive only
            </label>
          </div>

          {/* ================= TABLE VIEW ================= */}
          {viewMode === "table" && (
            <div className="border border-slate-200 dark:border-[#22302a] rounded-lg overflow-hidden bg-white dark:bg-[#0c120e] shadow-xl transition-colors" ref={tableRef}>
              <div className="overflow-x-auto">
                <table className="w-full text-base">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-[#0f1613] border-b border-slate-200 dark:border-[#22302a]">
                      {orderedVisibleCols.map((c) => (
                        <th
                          key={c.key}
                          onClick={() => c.key !== "spark" && toggleSort(c.key)}
                          className={`mono text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-[#5f6b65] text-left px-6 py-5 select-none ${c.key !== "spark" ? "cursor-pointer hover:text-[#1fae6b] transition-colors" : ""}`}
                        >
                          {c.label}
                          {sortKey === c.key && <span className="ml-2 text-[#2fd888]">{sortDir === "asc" ? "▲" : "▼"}</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s, i) => (
                      <tr
                        key={s.ticker}
                        onClick={() => setSelectedTicker(s.ticker)}
                        className={`border-b border-slate-100 dark:border-[#1a2420] cursor-pointer transition-colors ${
                          i === selectedIdx ? "bg-green-50 dark:bg-[#152019] shadow-[inset_3px_0_0_#1fae6b]" : "hover:bg-slate-50 dark:hover:bg-[#121a16]"
                        }`}
                      >
                        {orderedVisibleCols.map((c) => (
                          <td key={c.key} className="px-6 py-4 mono text-sm font-semibold">
                            {c.key === "ticker" && (
                              <div>
                                <div className="text-slate-900 dark:text-[#e9ede8] font-bold tracking-wide text-base">{s.ticker}</div>
                                <div className="text-xs text-slate-500 dark:text-[#5f6b65] font-sans font-medium mt-1">{s.name}</div>
                              </div>
                            )}
                            {c.key === "sector" && <span className="text-slate-500 dark:text-[#9aa6a0] font-medium">{s.sector}</span>}
                            {c.key === "price" && <span className="text-slate-800 dark:text-slate-200 font-bold">৳{s.price.toFixed(2)}</span>}
                            {c.key === "changePct" && (
                              <span className={`flex items-center gap-1.5 font-bold ${s.changePct >= 0 ? "text-[#2fd888]" : "text-[#e5555a]"}`}>
                                {s.changePct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {s.changePct >= 0 ? "+" : ""}
                                {s.changePct.toFixed(2)}%
                              </span>
                            )}
                            {c.key === "roe" && <span className="text-slate-600 dark:text-[#9aa6a0]">{s.roe.toFixed(1)}%</span>}
                            {c.key === "de" && <span className="text-slate-600 dark:text-[#9aa6a0]">{s.de.toFixed(2)}</span>}
                            {c.key === "epsGrowth" && <span className="text-slate-600 dark:text-[#9aa6a0]">{s.epsGrowth}</span>}
                            {c.key === "nocfps" && <span className="text-slate-600 dark:text-[#9aa6a0]">{s.nocfps}</span>}
                            {c.key === "spark" && <Sparkline points={s.spark} positive={s.changePct >= 0} />}
                            {c.key === "score" && (
                              <span className="font-bold px-3 py-1.5 rounded-full text-xs shadow-sm" style={{ color: scoreColor(s.score), backgroundColor: scoreColor(s.score) + (darkMode ? "22" : "33") }}>
                                {s.score}
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={orderedVisibleCols.length} className="text-center py-24 text-slate-500 dark:text-[#5f6b65] mono text-base font-medium">
                          {liveData.loading ? "Loading market data..." : "No tickers match these filters. Widen ROE / D/E / EPS growth thresholds."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 border-t border-slate-200 dark:border-[#22302a] mono text-xs font-bold text-slate-500 dark:text-[#5f6b65] bg-slate-50 dark:bg-[#0a0f0c] uppercase tracking-wider transition-colors">
                ↑ / ↓ to move row selection · click column header to sort
              </div>
            </div>
          )}

          {/* ================= HEATMAP VIEW ================= */}
          {viewMode === "heatmap" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {rows.map((s) => (
                <div
                  key={s.ticker}
                  onClick={() => setSelectedTicker(s.ticker)}
                  className="rounded-xl p-5 flex flex-col justify-between h-32 border-2 transition-transform hover:scale-105 cursor-pointer shadow-md bg-white dark:bg-transparent"
                  style={{ 
                    backgroundColor: darkMode ? scoreColor(s.score) + "15" : scoreColor(s.score) + "10", 
                    borderColor: scoreColor(s.score) + (darkMode ? "44" : "88") 
                  }}
                >
                  <div className="flex justify-between items-start">
                    <span className="mono text-base font-bold text-slate-900 dark:text-[#e9ede8]">{s.ticker}</span>
                    <span className="mono text-xs font-bold px-2 py-1 rounded shadow-sm" style={{ color: scoreColor(s.score), backgroundColor: scoreColor(s.score) + (darkMode ? "22" : "33") }}>
                      {s.score}
                    </span>
                  </div>
                  <div>
                    <div className="mono text-lg font-bold text-slate-800 dark:text-slate-200">৳{s.price.toFixed(2)}</div>
                    <div className={`mono text-sm font-bold flex items-center gap-1.5 mt-1 ${s.changePct >= 0 ? "text-[#2fd888]" : "text-[#e5555a]"}`}>
                      {s.changePct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {s.changePct >= 0 ? "+" : ""}
                      {s.changePct.toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Search, SlidersHorizontal, LayoutGrid, List, Save, ChevronDown, X, Check, TrendingUp, TrendingDown } from "lucide-react";

// ---------------------------------------------------------------------------
// FONTS — matches the architecture doc's terminal identity (IBM Plex family)
// ---------------------------------------------------------------------------
function useFonts() {
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);
}

// ---------------------------------------------------------------------------
// SAMPLE DATA — placeholder until Phase 01's data/prices.json + data/watchlist.json
// are live. Swap SAMPLE_STOCKS for a fetch() against raw.githubusercontent.com
// once the pipeline repo is running. Fundamentals here are illustrative, not
// verified — Phase 02's job is proving the screener mechanics, not sourcing
// real numbers yet.
// ---------------------------------------------------------------------------
const DAMANI_SECTORS = new Set(["Pharma", "Engineering", "Consumer Staples", "Steel"]);

function seededSpark(seed, base, len = 30) {
  let x = 0;
  for (let i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) % 100000;
  const points = [];
  let v = base;
  for (let i = 0; i < len; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    const drift = ((x / 2147483648) - 0.48) * base * 0.02;
    v = Math.max(base * 0.7, v + drift);
    points.push(v);
  }
  return points;
}

const RAW_STOCKS = [
  { ticker: "SQURPHARMA", name: "Square Pharmaceuticals", sector: "Pharma", tier: 1, dsex: true, dses: true, ds30: true, price: 218.3, changePct: 1.2, roe: 19.4, de: 0.31, epsGrowth: 82, nocfps: 78 },
  { ticker: "GP", name: "Grameenphone", sector: "Telecom", tier: 1, dsex: true, dses: true, ds30: true, price: 268.9, changePct: -0.4, roe: 34.1, de: 0.62, epsGrowth: 55, nocfps: 88 },
  { ticker: "WALTONHIL", name: "Walton Hi-Tech", sector: "Consumer Staples", tier: 1, dsex: true, dses: true, ds30: true, price: 612.0, changePct: 0.8, roe: 15.2, de: 0.44, epsGrowth: 61, nocfps: 66 },
  { ticker: "RENATA", name: "Renata Limited", sector: "Pharma", tier: 1, dsex: true, dses: true, ds30: true, price: 1450.0, changePct: 0.5, roe: 21.7, de: 0.28, epsGrowth: 74, nocfps: 80 },
  { ticker: "BATBC", name: "BAT Bangladesh", sector: "Tobacco", tier: 1, dsex: true, dses: false, ds30: true, price: 940.0, changePct: -0.2, roe: 41.3, de: 0.55, epsGrowth: 48, nocfps: 90 },
  { ticker: "BEXIMCO", name: "Beximco Limited", sector: "Conglomerate", tier: 1, dsex: true, dses: false, ds30: true, price: 142.1, changePct: -0.9, roe: 8.1, de: 1.42, epsGrowth: 22, nocfps: 30 },
  { ticker: "BSRM", name: "BSRM Steel", sector: "Steel", tier: 1, dsex: true, dses: true, ds30: true, price: 96.7, changePct: 2.1, roe: 14.8, de: 0.51, epsGrowth: 58, nocfps: 62 },
  { ticker: "MPETROLEUM", name: "Meghna Petroleum", sector: "Energy", tier: 1, dsex: true, dses: true, ds30: true, price: 184.0, changePct: 0.3, roe: 18.6, de: 0.35, epsGrowth: 40, nocfps: 70 },
  { ticker: "BERGERPBL", name: "Berger Paints BD", sector: "Consumer Staples", tier: 1, dsex: true, dses: true, ds30: true, price: 2410.5, changePct: -0.2, roe: 28.9, de: 0.19, epsGrowth: 65, nocfps: 84 },
  { ticker: "ISLAMIBANK", name: "Islami Bank BD", sector: "Banking", tier: 1, dsex: true, dses: true, ds30: true, price: 33.4, changePct: 1.5, roe: 11.2, de: 0.88, epsGrowth: 35, nocfps: 40 },
  { ticker: "IPDC", name: "IPDC Finance", sector: "Financial Services", tier: 2, dsex: true, dses: false, ds30: false, price: 52.1, changePct: 3.4, roe: 13.5, de: 0.95, epsGrowth: 44, nocfps: 38 },
  { ticker: "GENEXIL", name: "Genex Infosys", sector: "Tech/IT", tier: 2, dsex: true, dses: true, ds30: false, price: 71.8, changePct: 2.6, roe: 17.1, de: 0.22, epsGrowth: 59, nocfps: 55 },
  { ticker: "ALIF", name: "Alif Industries", sector: "Engineering", tier: 2, dsex: true, dses: true, ds30: false, price: 28.9, changePct: 4.1, roe: 9.8, de: 0.71, epsGrowth: 37, nocfps: 33 },
  { ticker: "DOMINAGE", name: "Dominage Steel", sector: "Steel", tier: 2, dsex: true, dses: true, ds30: false, price: 19.6, changePct: 5.8, roe: 7.4, de: 1.1, epsGrowth: 29, nocfps: 25 },
  { ticker: "SUNLIFEINS", name: "Sunlife Insurance", sector: "Insurance", tier: 2, dsex: true, dses: false, ds30: false, price: 44.2, changePct: -1.1, roe: 10.6, de: 0.4, epsGrowth: 31, nocfps: 45 },
  { ticker: "RUPALILIFE", name: "Rupali Life Insurance", sector: "Insurance", tier: 2, dsex: true, dses: false, ds30: false, price: 38.7, changePct: 0.6, roe: 9.1, de: 0.38, epsGrowth: 27, nocfps: 41 },
  { ticker: "PUBALIBANK", name: "Pubali Bank", sector: "Banking", tier: 2, dsex: true, dses: false, ds30: false, price: 24.5, changePct: -0.5, roe: 12.4, de: 0.92, epsGrowth: 33, nocfps: 36 },
  { ticker: "CITYGENINS", name: "City General Insurance", sector: "Insurance", tier: 2, dsex: true, dses: false, ds30: false, price: 21.3, changePct: 1.8, roe: 8.7, de: 0.29, epsGrowth: 24, nocfps: 39 },
  { ticker: "LAVELLO", name: "Lavello Ice-cream", sector: "Consumer Staples", tier: 3, dsex: true, dses: true, ds30: false, price: 14.2, changePct: 6.9, roe: 6.5, de: 0.6, epsGrowth: 18, nocfps: 20 },
  { ticker: "GQBALLPEN", name: "GQ Ball Pen", sector: "Consumer Staples", tier: 3, dsex: true, dses: true, ds30: false, price: 31.5, changePct: 3.2, roe: 11.9, de: 0.33, epsGrowth: 42, nocfps: 47 },
  { ticker: "PEOPLESINS", name: "Peoples Insurance", sector: "Insurance", tier: 3, dsex: true, dses: false, ds30: false, price: 12.8, changePct: -2.3, roe: 5.8, de: 0.25, epsGrowth: 15, nocfps: 22 },
];

const SAMPLE_STOCKS = RAW_STOCKS.map((s) => ({
  ...s,
  spark: seededSpark(s.ticker, s.price),
}));

// ---------------------------------------------------------------------------
// HEALTH SCORE ENGINE — deterministic, matches the architecture doc formula:
// 30% profitability, 25% balance sheet, 20% earnings consistency,
// 15% cash generation, 10% sector-cycle (Damani leadership) bonus.
// Pure function, no LLM involved — this is exactly the "calc engine" from
// the agent architecture section.
// ---------------------------------------------------------------------------
function healthScore(stock) {
  const profitability = Math.min(100, (stock.roe / 30) * 100);
  const balanceSheet = Math.min(100, Math.max(0, (1 - stock.de / 2) * 100));
  const earningsConsistency = stock.epsGrowth;
  const cashGeneration = stock.nocfps;
  const sectorBonus = DAMANI_SECTORS.has(stock.sector) ? 100 : 50;

  const score =
    profitability * 0.3 +
    balanceSheet * 0.25 +
    earningsConsistency * 0.2 +
    cashGeneration * 0.15 +
    sectorBonus * 0.1;

  return Math.round(score);
}

function scoreColor(score) {
  if (score >= 75) return "#2fd888";
  if (score >= 60) return "#8fd42f";
  if (score >= 45) return "#c9a24b";
  if (score >= 30) return "#e08a3e";
  return "#e5555a";
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

// ---------------------------------------------------------------------------
// Sparkline — lightweight inline SVG, no chart library needed for 30 points
// ---------------------------------------------------------------------------
function Sparkline({ points, positive }) {
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
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// MAIN APP
// ---------------------------------------------------------------------------
export default function BDMultibaggerScreener() {
  useFonts();

  const [indexFilter, setIndexFilter] = useState("DSEX");
  const [query, setQuery] = useState("");
  const [roeMin, setRoeMin] = useState(0);
  const [deMax, setDeMax] = useState(2);
  const [epsGrowthMin, setEpsGrowthMin] = useState(0);
  const [nocfpsPositiveOnly, setNocfpsPositiveOnly] = useState(false);
  const [viewMode, setViewMode] = useState("table"); // table | heatmap
  const [visibleCols, setVisibleCols] = useState(DEFAULT_VISIBLE);
  const [colPanelOpen, setColPanelOpen] = useState(false);
  const [presetPanelOpen, setPresetPanelOpen] = useState(false);
  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState("");
  const [sortKey, setSortKey] = useState("score");
  const [sortDir, setSortDir] = useState("desc");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [storageReady, setStorageReady] = useState(false);
  const tableRef = useRef(null);

  // ---- load saved presets from persistent storage ----
  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage?.get("screener:presets", false);
        if (result?.value) setPresets(JSON.parse(result.value));
      } catch (e) {
        // no presets saved yet — fine
      } finally {
        setStorageReady(true);
      }
    })();
  }, []);

  const savePreset = useCallback(async () => {
    if (!presetName.trim()) return;
    const newPreset = {
      name: presetName.trim(),
      indexFilter,
      roeMin,
      deMax,
      epsGrowthMin,
      nocfpsPositiveOnly,
    };
    const updated = [...presets.filter((p) => p.name !== newPreset.name), newPreset];
    setPresets(updated);
    setPresetName("");
    try {
      await window.storage?.set("screener:presets", JSON.stringify(updated), false);
    } catch (e) {
      console.error("Could not save preset", e);
    }
  }, [presetName, indexFilter, roeMin, deMax, epsGrowthMin, nocfpsPositiveOnly, presets]);

  const loadPreset = (p) => {
    setIndexFilter(p.indexFilter);
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
      await window.storage?.set("screener:presets", JSON.stringify(updated), false);
    } catch (e) {
      console.error(e);
    }
  };

  // ---- filtering + scoring ----
  const rows = useMemo(() => {
    let list = SAMPLE_STOCKS.filter((s) => {
      if (indexFilter === "DSES" && !s.dses) return false;
      if (indexFilter === "DS30" && !s.ds30) return false;
      if (query && !s.ticker.includes(query.toUpperCase()) && !s.name.toUpperCase().includes(query.toUpperCase())) return false;
      if (s.roe < roeMin) return false;
      if (s.de > deMax) return false;
      if (s.epsGrowth < epsGrowthMin) return false;
      if (nocfpsPositiveOnly && s.nocfps <= 0) return false;
      return true;
    }).map((s) => ({ ...s, score: healthScore(s) }));

    list.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [indexFilter, query, roeMin, deMax, epsGrowthMin, nocfpsPositiveOnly, sortKey, sortDir]);

  useEffect(() => setSelectedIdx(0), [rows.length, indexFilter]);

  // ---- keyboard row navigation ----
  useEffect(() => {
    function onKey(e) {
      if (viewMode !== "table") return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(rows.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(0, i - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows.length, viewMode]);

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

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif" }} className="min-h-screen bg-[#0a0f0c] text-[#e9ede8]">
      <style>{`
        ::selection { background: #1fae6b; color: #04120b; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        input[type=range] { accent-color: #2fd888; }
      `}</style>

      {/* ================= HEADER ================= */}
      <div className="border-b border-[#22302a] px-6 py-4 sticky top-0 bg-[#0a0f0c] z-20">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#2fd888]" style={{ boxShadow: "0 0 8px #2fd888" }} />
            <span className="mono text-[11px] tracking-[0.14em] uppercase text-[#c9a24b]">BD Multibagger AI — Screener</span>
          </div>
          <div className="mono text-[11px] text-[#5f6b65]">
            {rows.length} of {SAMPLE_STOCKS.length} tickers · sample data
          </div>
        </div>
      </div>

      {/* sample-data notice */}
      <div className="px-6 py-2 bg-[#1a1408] border-b border-[#22302a] mono text-[11px] text-[#c9a24b]">
        ⚠ Showing illustrative sample data. Connect Phase 01's data/prices.json feed to replace this with live DSEX/DSES/DS30 figures.
      </div>

      <div className="px-6 py-5 flex flex-col gap-4">
        {/* ================= INDEX SELECTOR + SEARCH ================= */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-md border border-[#22302a] overflow-hidden">
            {["DSEX", "DSES", "DS30"].map((idx) => (
              <button
                key={idx}
                onClick={() => setIndexFilter(idx)}
                className={`mono text-[12px] px-4 py-2 transition-colors ${
                  indexFilter === idx ? "bg-[#1fae6b] text-[#04120b] font-semibold" : "bg-[#121a16] text-[#9aa6a0] hover:text-[#e9ede8]"
                }`}
              >
                {idx}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-[#121a16] border border-[#22302a] rounded-md px-3 py-2 flex-1 min-w-[200px]">
            <Search size={14} className="text-[#5f6b65]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ticker or company name…"
              className="bg-transparent outline-none text-sm flex-1 placeholder:text-[#5f6b65]"
            />
          </div>

          <div className="flex rounded-md border border-[#22302a] overflow-hidden">
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-2 flex items-center gap-2 text-[12px] mono ${viewMode === "table" ? "bg-[#1fae6b] text-[#04120b]" : "bg-[#121a16] text-[#9aa6a0]"}`}
            >
              <List size={14} /> Table
            </button>
            <button
              onClick={() => setViewMode("heatmap")}
              className={`px-3 py-2 flex items-center gap-2 text-[12px] mono ${viewMode === "heatmap" ? "bg-[#1fae6b] text-[#04120b]" : "bg-[#121a16] text-[#9aa6a0]"}`}
            >
              <LayoutGrid size={14} /> Heatmap
            </button>
          </div>

          <div className="relative">
            <button
              onClick={() => setPresetPanelOpen((o) => !o)}
              className="flex items-center gap-2 px-3 py-2 rounded-md border border-[#22302a] bg-[#121a16] text-[12px] mono text-[#9aa6a0] hover:text-[#e9ede8]"
            >
              <Save size={14} /> Presets <ChevronDown size={12} />
            </button>
            {presetPanelOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-[#121a16] border border-[#22302a] rounded-md shadow-xl p-3 z-30">
                <div className="flex gap-2 mb-3">
                  <input
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Name this filter combo…"
                    className="flex-1 bg-[#0a0f0c] border border-[#22302a] rounded px-2 py-1.5 text-sm outline-none"
                  />
                  <button onClick={savePreset} className="px-2.5 py-1.5 bg-[#1fae6b] text-[#04120b] rounded text-[12px] font-semibold mono">
                    Save
                  </button>
                </div>
                {presets.length === 0 && <div className="text-[12px] text-[#5f6b65]">No saved presets yet.</div>}
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                  {presets.map((p) => (
                    <div key={p.name} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#1a2420] group">
                      <button onClick={() => loadPreset(p)} className="text-left text-sm flex-1">
                        {p.name}
                      </button>
                      <button onClick={() => deletePreset(p.name)} className="opacity-0 group-hover:opacity-100 text-[#e5555a]">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setColPanelOpen((o) => !o)}
              className="flex items-center gap-2 px-3 py-2 rounded-md border border-[#22302a] bg-[#121a16] text-[12px] mono text-[#9aa6a0] hover:text-[#e9ede8]"
            >
              <SlidersHorizontal size={14} /> Columns <ChevronDown size={12} />
            </button>
            {colPanelOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-[#121a16] border border-[#22302a] rounded-md shadow-xl p-3 z-30">
                <div className="text-[11px] mono text-[#5f6b65] mb-2 uppercase tracking-wide">Toggle &amp; reorder</div>
                <div className="flex flex-col gap-1">
                  {orderedVisibleCols.concat(ALL_COLUMNS.filter((c) => !visibleCols.includes(c.key))).map((c) => (
                    <div key={c.key} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#1a2420]">
                      <button onClick={() => toggleCol(c.key)} className="flex items-center gap-2 text-sm flex-1 text-left">
                        <span className={`w-4 h-4 rounded border flex items-center justify-center ${visibleCols.includes(c.key) ? "bg-[#1fae6b] border-[#1fae6b]" : "border-[#22302a]"}`}>
                          {visibleCols.includes(c.key) && <Check size={11} className="text-[#04120b]" />}
                        </span>
                        {c.label}
                      </button>
                      {visibleCols.includes(c.key) && (
                        <div className="flex gap-1">
                          <button onClick={() => moveCol(c.key, -1)} className="text-[#5f6b65] hover:text-[#e9ede8] text-xs px-1">
                            ↑
                          </button>
                          <button onClick={() => moveCol(c.key, 1)} className="text-[#5f6b65] hover:text-[#e9ede8] text-xs px-1">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#121a16] border border-[#22302a] rounded-md p-4">
          <div>
            <div className="flex justify-between mono text-[11px] text-[#9aa6a0] mb-1">
              <span>ROE min</span>
              <span className="text-[#2fd888]">{roeMin}%</span>
            </div>
            <input type="range" min="0" max="40" value={roeMin} onChange={(e) => setRoeMin(+e.target.value)} className="w-full" />
          </div>
          <div>
            <div className="flex justify-between mono text-[11px] text-[#9aa6a0] mb-1">
              <span>D/E max</span>
              <span className="text-[#2fd888]">{deMax.toFixed(1)}</span>
            </div>
            <input type="range" min="0" max="2" step="0.1" value={deMax} onChange={(e) => setDeMax(+e.target.value)} className="w-full" />
          </div>
          <div>
            <div className="flex justify-between mono text-[11px] text-[#9aa6a0] mb-1">
              <span>EPS growth min</span>
              <span className="text-[#2fd888]">{epsGrowthMin}</span>
            </div>
            <input type="range" min="0" max="100" value={epsGrowthMin} onChange={(e) => setEpsGrowthMin(+e.target.value)} className="w-full" />
          </div>
          <label className="flex items-center gap-2 mono text-[11px] text-[#9aa6a0] cursor-pointer self-end pb-1.5">
            <input type="checkbox" checked={nocfpsPositiveOnly} onChange={(e) => setNocfpsPositiveOnly(e.target.checked)} className="accent-[#1fae6b]" />
            NOCFPS positive only
          </label>
        </div>

        {/* ================= TABLE VIEW ================= */}
        {viewMode === "table" && (
          <div className="border border-[#22302a] rounded-md overflow-hidden" ref={tableRef}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0f1613] border-b border-[#22302a]">
                    {orderedVisibleCols.map((c) => (
                      <th
                        key={c.key}
                        onClick={() => c.key !== "spark" && toggleSort(c.key)}
                        className={`mono text-[11px] uppercase tracking-wide text-[#5f6b65] text-left px-4 py-3 select-none ${c.key !== "spark" ? "cursor-pointer hover:text-[#e9ede8]" : ""}`}
                      >
                        {c.label}
                        {sortKey === c.key && <span className="ml-1 text-[#2fd888]">{sortDir === "asc" ? "▲" : "▼"}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s, i) => (
                    <tr
                      key={s.ticker}
                      onClick={() => setSelectedIdx(i)}
                      className={`border-b border-[#1a2420] cursor-pointer transition-colors ${
                        i === selectedIdx ? "bg-[#152019]" : "hover:bg-[#0f1613]"
                      }`}
                    >
                      {orderedVisibleCols.map((c) => (
                        <td key={c.key} className="px-4 py-2.5 mono text-[13px]">
                          {c.key === "ticker" && (
                            <div>
                              <div className="text-[#e9ede8] font-semibold">{s.ticker}</div>
                              <div className="text-[10px] text-[#5f6b65] font-sans">{s.name}</div>
                            </div>
                          )}
                          {c.key === "sector" && <span className="text-[#9aa6a0]">{s.sector}</span>}
                          {c.key === "price" && <span>৳{s.price.toFixed(2)}</span>}
                          {c.key === "changePct" && (
                            <span className={`flex items-center gap-1 ${s.changePct >= 0 ? "text-[#2fd888]" : "text-[#e5555a]"}`}>
                              {s.changePct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                              {s.changePct >= 0 ? "+" : ""}
                              {s.changePct.toFixed(1)}%
                            </span>
                          )}
                          {c.key === "roe" && <span className="text-[#9aa6a0]">{s.roe.toFixed(1)}%</span>}
                          {c.key === "de" && <span className="text-[#9aa6a0]">{s.de.toFixed(2)}</span>}
                          {c.key === "epsGrowth" && <span className="text-[#9aa6a0]">{s.epsGrowth}</span>}
                          {c.key === "nocfps" && <span className="text-[#9aa6a0]">{s.nocfps}</span>}
                          {c.key === "spark" && <Sparkline points={s.spark} positive={s.changePct >= 0} />}
                          {c.key === "score" && (
                            <span className="font-semibold px-2 py-0.5 rounded" style={{ color: scoreColor(s.score), backgroundColor: scoreColor(s.score) + "1a" }}>
                              {s.score}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={orderedVisibleCols.length} className="text-center py-10 text-[#5f6b65] mono text-sm">
                        No tickers match these filters. Widen ROE / D/E / EPS growth thresholds.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-[#22302a] mono text-[10px] text-[#5f6b65]">
              ↑ / ↓ to move row selection · click column header to sort
            </div>
          </div>
        )}

        {/* ================= HEATMAP VIEW ================= */}
        {viewMode === "heatmap" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {rows.map((s) => (
              <div
                key={s.ticker}
                className="rounded-md p-3 flex flex-col justify-between h-24 border"
                style={{ backgroundColor: scoreColor(s.score) + "22", borderColor: scoreColor(s.score) + "55" }}
              >
                <div className="flex justify-between items-start">
                  <span className="mono text-[12px] font-semibold">{s.ticker}</span>
                  <span className="mono text-[11px]" style={{ color: scoreColor(s.score) }}>
                    {s.score}
                  </span>
                </div>
                <div>
                  <div className="mono text-[13px]">৳{s.price.toFixed(2)}</div>
                  <div className={`mono text-[11px] ${s.changePct >= 0 ? "text-[#2fd888]" : "text-[#e5555a]"}`}>
                    {s.changePct >= 0 ? "+" : ""}
                    {s.changePct.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Search, ChevronDown, Plus, Shield, Activity, BarChart3, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";

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
// SAMPLE UNIVERSE — same watchlist as Phase 02. Swap for the real
// data/watchlist.json + data/history/{ticker}.json feed once Phase 01 is live.
// ---------------------------------------------------------------------------
const DAMANI_SECTORS = new Set(["Pharma", "Engineering", "Consumer Staples", "Steel"]);

const UNIVERSE = [
  { ticker: "SQURPHARMA", name: "Square Pharmaceuticals", sector: "Pharma", dses: true, ds30: true, roe: 19.4, de: 0.31, epsGrowth: 82, nocfps: 78, basePrice: 218.3 },
  { ticker: "GP", name: "Grameenphone", sector: "Telecom", dses: true, ds30: true, roe: 34.1, de: 0.62, epsGrowth: 55, nocfps: 88, basePrice: 268.9 },
  { ticker: "BEXIMCO", name: "Beximco Limited", sector: "Conglomerate", dses: false, ds30: true, roe: 8.1, de: 1.42, epsGrowth: 22, nocfps: 30, basePrice: 142.1 },
  { ticker: "BSRM", name: "BSRM Steel", sector: "Steel", dses: true, ds30: true, roe: 14.8, de: 0.51, epsGrowth: 58, nocfps: 62, basePrice: 96.7 },
  { ticker: "BERGERPBL", name: "Berger Paints BD", sector: "Consumer Staples", dses: true, ds30: true, roe: 28.9, de: 0.19, epsGrowth: 65, nocfps: 84, basePrice: 2410.5 },
  { ticker: "IPDC", name: "IPDC Finance", sector: "Financial Services", dses: false, ds30: false, roe: 13.5, de: 0.95, epsGrowth: 44, nocfps: 38, basePrice: 52.1 },
  { ticker: "GENEXIL", name: "Genex Infosys", sector: "Tech/IT", dses: true, ds30: false, roe: 17.1, de: 0.22, epsGrowth: 59, nocfps: 55, basePrice: 71.8 },
  { ticker: "ALIF", name: "Alif Industries", sector: "Engineering", dses: true, ds30: false, roe: 9.8, de: 0.71, epsGrowth: 37, nocfps: 33, basePrice: 28.9 },
  { ticker: "DOMINAGE", name: "Dominage Steel", sector: "Steel", dses: true, ds30: false, roe: 7.4, de: 1.1, epsGrowth: 29, nocfps: 25, basePrice: 19.6 },
  { ticker: "LAVELLO", name: "Lavello Ice-cream", sector: "Consumer Staples", dses: true, ds30: false, roe: 6.5, de: 0.6, epsGrowth: 18, nocfps: 20, basePrice: 14.2 },
];

// ---------------------------------------------------------------------------
// Synthetic OHLCV generator — deterministic per ticker. Replace with real
// history:{ticker}.json entries from Phase 01 once available.
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFromString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function generateOHLCV(ticker, basePrice, days = 90) {
  const rand = mulberry32(seedFromString(ticker));
  let close = basePrice * 0.85;
  const bars = [];
  const today = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const drift = (rand() - 0.48) * basePrice * 0.025;
    const open = close;
    close = Math.max(basePrice * 0.5, open + drift);
    const spread = Math.abs(drift) + basePrice * 0.006;
    const high = Math.max(open, close) + rand() * spread;
    const low = Math.min(open, close) - rand() * spread;
    const volSpike = rand() > 0.92 ? 2.2 + rand() * 1.5 : 1;
    const volume = Math.round((80000 + rand() * 60000) * volSpike);
    bars.push({ date: date.toISOString().slice(0, 10), open, high, low, close, volume });
  }
  return bars;
}

// ---------------------------------------------------------------------------
// QUANT SIGNAL ENGINE — pure deterministic code, no LLM. Momentum, volume,
// volatility, mean-reversion. This is the "Calc Engine" box from the agent
// architecture diagram — the Technical/Quant Agent only narrates these numbers.
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
  const profitability = Math.min(100, (s.roe / 30) * 100);
  const balanceSheet = Math.min(100, Math.max(0, (1 - s.de / 2) * 100));
  const earningsConsistency = s.epsGrowth;
  const cashGeneration = s.nocfps;
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
// CHART — custom SVG, multi-pane (price + RSI + MACD + volume), synced
// crosshair driven by a single hoveredIndex shared across panes.
// ---------------------------------------------------------------------------
function useChartGeometry(bars, width) {
  return useMemo(() => {
    const n = bars.length;
    const padL = 46, padR = 8;
    const step = (width - padL - padR) / (n - 1 || 1);
    const x = (i) => padL + i * step;
    return { n, padL, padR, step, x };
  }, [bars, width]);
}

function PricePane({ bars, ind, showMA, showBB, width, height, hoverIdx, setHoverIdx }) {
  const geo = useChartGeometry(bars, width);
  const highs = bars.map((b) => b.high), lows = bars.map((b) => b.low);
  const vals = [...highs, ...lows, ...ind.bbUpper.filter((v) => v != null), ...ind.bbLower.filter((v) => v != null)];
  const max = Math.max(...vals), min = Math.min(...vals);
  const padTop = 10, padBot = 8;
  const y = (v) => padTop + (1 - (v - min) / (max - min || 1)) * (height - padTop - padBot);

  const linePath = (series) => {
    let d = "";
    series.forEach((v, i) => {
      if (v == null) return;
      d += `${d ? "L" : "M"}${geo.x(i).toFixed(1)},${y(v).toFixed(1)} `;
    });
    return d;
  };

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const idx = Math.round((mx - geo.padL) / geo.step);
    setHoverIdx(Math.max(0, Math.min(bars.length - 1, idx)));
  };

  const candleW = Math.max(2, Math.min(9, geo.step * 0.6));

  return (
    <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)} className="block">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={geo.padL} x2={width - geo.padR} y1={padTop + f * (height - padTop - padBot)} y2={padTop + f * (height - padTop - padBot)} stroke="#1a2420" strokeWidth="1" />
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <text key={f} x={4} y={padTop + f * (height - padTop - padBot) + 3} fontSize="9" fill="#5f6b65" fontFamily="'IBM Plex Mono',monospace">
          {(max - f * (max - min)).toFixed(1)}
        </text>
      ))}

      {showBB && ind.bbUpper.some((v) => v != null) && (
        <>
          <path d={linePath(ind.bbUpper)} fill="none" stroke="#c9a24b" strokeWidth="1" strokeDasharray="2,2" opacity="0.6" />
          <path d={linePath(ind.bbLower)} fill="none" stroke="#c9a24b" strokeWidth="1" strokeDasharray="2,2" opacity="0.6" />
        </>
      )}
      {showMA && (
        <>
          <path d={linePath(ind.sma20)} fill="none" stroke="#2fd888" strokeWidth="1.3" />
          <path d={linePath(ind.sma50)} fill="none" stroke="#e08a3e" strokeWidth="1.3" />
        </>
      )}

      {bars.map((b, i) => {
        const up = b.close >= b.open;
        const color = up ? "#2fd888" : "#e5555a";
        return (
          <g key={i}>
            <line x1={geo.x(i)} x2={geo.x(i)} y1={y(b.high)} y2={y(b.low)} stroke={color} strokeWidth="1" />
            <rect x={geo.x(i) - candleW / 2} y={y(Math.max(b.open, b.close))} width={candleW} height={Math.max(1, Math.abs(y(b.open) - y(b.close)))} fill={color} />
          </g>
        );
      })}

      {hoverIdx != null && (
        <line x1={geo.x(hoverIdx)} x2={geo.x(hoverIdx)} y1={0} y2={height} stroke="#5f6b65" strokeWidth="1" strokeDasharray="3,3" />
      )}
    </svg>
  );
}

function IndicatorPane({ label, width, height, hoverIdx, setHoverIdx, children, x }) {
  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    // handled by parent via shared x() closure passed down in children render, so just forward move
  };
  return (
    <div className="relative">
      <div className="absolute left-2 top-1 mono text-[9px] text-[#5f6b65] uppercase tracking-wide z-10">{label}</div>
      {children}
    </div>
  );
}

function RSIPane({ bars, ind, width, height, hoverIdx, setHoverIdx }) {
  const geo = useChartGeometry(bars, width);
  const padTop = 14, padBot = 4;
  const y = (v) => padTop + (1 - v / 100) * (height - padTop - padBot);
  const path = () => {
    let d = "";
    ind.rsi.forEach((v, i) => {
      if (v == null) return;
      d += `${d ? "L" : "M"}${geo.x(i).toFixed(1)},${y(v).toFixed(1)} `;
    });
    return d;
  };
  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const idx = Math.round((mx - geo.padL) / geo.step);
    setHoverIdx(Math.max(0, Math.min(bars.length - 1, idx)));
  };
  return (
    <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)} className="block">
      <line x1={geo.padL} x2={width - geo.padR} y1={y(70)} y2={y(70)} stroke="#22302a" strokeDasharray="2,2" />
      <line x1={geo.padL} x2={width - geo.padR} y1={y(30)} y2={y(30)} stroke="#22302a" strokeDasharray="2,2" />
      <text x={4} y={y(70) + 3} fontSize="9" fill="#5f6b65" fontFamily="'IBM Plex Mono',monospace">70</text>
      <text x={4} y={y(30) + 3} fontSize="9" fill="#5f6b65" fontFamily="'IBM Plex Mono',monospace">30</text>
      <path d={path()} fill="none" stroke="#c9a24b" strokeWidth="1.3" />
      {hoverIdx != null && <line x1={geo.x(hoverIdx)} x2={geo.x(hoverIdx)} y1={0} y2={height} stroke="#5f6b65" strokeWidth="1" strokeDasharray="3,3" />}
    </svg>
  );
}

function MACDPane({ bars, ind, width, height, hoverIdx, setHoverIdx }) {
  const geo = useChartGeometry(bars, width);
  const vals = [...ind.macdLine, ...ind.signalLine, ...ind.histogram].filter((v) => v != null);
  const max = Math.max(...vals, 0.001), min = Math.min(...vals, -0.001);
  const padTop = 14, padBot = 4;
  const y = (v) => padTop + (1 - (v - min) / (max - min)) * (height - padTop - padBot);
  const path = (series) => {
    let d = "";
    series.forEach((v, i) => {
      if (v == null) return;
      d += `${d ? "L" : "M"}${geo.x(i).toFixed(1)},${y(v).toFixed(1)} `;
    });
    return d;
  };
  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const idx = Math.round((mx - geo.padL) / geo.step);
    setHoverIdx(Math.max(0, Math.min(bars.length - 1, idx)));
  };
  return (
    <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)} className="block">
      <line x1={geo.padL} x2={width - geo.padR} y1={y(0)} y2={y(0)} stroke="#22302a" />
      {ind.histogram.map((v, i) => v == null ? null : (
        <rect key={i} x={geo.x(i) - 1.5} y={Math.min(y(0), y(v))} width={3} height={Math.max(1, Math.abs(y(0) - y(v)))} fill={v >= 0 ? "#1fae6b55" : "#e5555a55"} />
      ))}
      <path d={path(ind.macdLine)} fill="none" stroke="#2fd888" strokeWidth="1.2" />
      <path d={path(ind.signalLine)} fill="none" stroke="#e08a3e" strokeWidth="1.2" />
      {hoverIdx != null && <line x1={geo.x(hoverIdx)} x2={geo.x(hoverIdx)} y1={0} y2={height} stroke="#5f6b65" strokeWidth="1" strokeDasharray="3,3" />}
    </svg>
  );
}

function VolumePane({ bars, ind, width, height, hoverIdx, setHoverIdx }) {
  const geo = useChartGeometry(bars, width);
  const max = Math.max(...bars.map((b) => b.volume));
  const padTop = 14, padBot = 4;
  const y = (v) => padTop + (1 - v / max) * (height - padTop - padBot);
  const barW = Math.max(2, Math.min(9, geo.step * 0.6));
  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const idx = Math.round((mx - geo.padL) / geo.step);
    setHoverIdx(Math.max(0, Math.min(bars.length - 1, idx)));
  };
  return (
    <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)} className="block">
      {bars.map((b, i) => {
        const up = i === 0 || b.close >= bars[i - 1].close;
        return <rect key={i} x={geo.x(i) - barW / 2} y={y(b.volume)} width={barW} height={height - padBot - y(b.volume)} fill={up ? "#1fae6b66" : "#e5555a66"} />;
      })}
      {hoverIdx != null && <line x1={geo.x(hoverIdx)} x2={geo.x(hoverIdx)} y1={0} y2={height} stroke="#5f6b65" strokeWidth="1" strokeDasharray="3,3" />}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
export default function StockDetail() {
  useFonts();
  const [ticker, setTicker] = useState("SQURPHARMA");
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showMA, setShowMA] = useState(true);
  const [showBB, setShowBB] = useState(true);
  const [hoverIdx, setHoverIdx] = useState(null);
  const containerRef = useRef(null);
  const [width, setWidth] = useState(760);

  useEffect(() => {
    function onResize() {
      if (containerRef.current) setWidth(containerRef.current.offsetWidth);
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const stock = UNIVERSE.find((s) => s.ticker === ticker);
  const bars = useMemo(() => generateOHLCV(stock.ticker, stock.basePrice), [stock.ticker]);
  const ind = useMemo(() => computeIndicators(bars), [bars]);
  const signal = useMemo(() => tradingSignal(bars, ind), [bars, ind]);
  const hScore = healthScore(stock);

  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const changePct = ((last.close - prev.close) / prev.close) * 100;

  const hoverBar = hoverIdx != null ? bars[hoverIdx] : last;
  const filtered = UNIVERSE.filter((s) => s.ticker.includes(query.toUpperCase()) || s.name.toUpperCase().includes(query.toUpperCase()));

  const paneWidth = width;

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif" }} className="min-h-screen bg-[#0a0f0c] text-[#e9ede8]">
      <style>{`.mono{font-family:'IBM Plex Mono',monospace;} ::selection{background:#1fae6b;color:#04120b;}`}</style>

      {/* ================= HEADER ================= */}
      <div className="border-b border-[#22302a] px-6 py-4 sticky top-0 bg-[#0a0f0c] z-30">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative">
              <button onClick={() => setDropdownOpen((o) => !o)} className="flex items-center gap-2 bg-[#121a16] border border-[#22302a] rounded-md px-3 py-2">
                <Search size={14} className="text-[#5f6b65]" />
                <span className="mono text-sm font-semibold">{stock.ticker}</span>
                <ChevronDown size={13} className="text-[#5f6b65]" />
              </button>
              {dropdownOpen && (
                <div className="absolute mt-2 w-72 bg-[#121a16] border border-[#22302a] rounded-md shadow-xl z-40">
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search ticker or name…"
                    className="w-full bg-[#0a0f0c] border-b border-[#22302a] px-3 py-2 text-sm outline-none rounded-t-md"
                  />
                  <div className="max-h-64 overflow-y-auto">
                    {filtered.map((s) => (
                      <button
                        key={s.ticker}
                        onClick={() => { setTicker(s.ticker); setDropdownOpen(false); setQuery(""); }}
                        className="w-full text-left px-3 py-2 hover:bg-[#1a2420] flex justify-between items-center"
                      >
                        <span className="mono text-sm">{s.ticker}</span>
                        <span className="text-[11px] text-[#5f6b65]">{s.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="text-sm text-[#9aa6a0]">{stock.name}</div>
              <div className="flex items-baseline gap-2">
                <span className="mono text-2xl font-semibold">৳{last.close.toFixed(2)}</span>
                <span className={`mono text-sm flex items-center gap-1 ${changePct >= 0 ? "text-[#2fd888]" : "text-[#e5555a]"}`}>
                  {changePct >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <span className="mono text-[10px] px-2 py-1 rounded border border-[#22302a] text-[#9aa6a0]">{stock.sector}</span>
              <span className={`mono text-[10px] px-2 py-1 rounded border ${stock.dses ? "border-[#1fae6b] text-[#2fd888]" : "border-[#22302a] text-[#5f6b65]"}`}>
                {stock.dses ? "DSES ✓ Shariah" : "Not in DSES"}
              </span>
              {stock.ds30 && <span className="mono text-[10px] px-2 py-1 rounded border border-[#c9a24b] text-[#c9a24b]">DS30</span>}
            </div>
          </div>

          <div className="flex gap-2">
            <button title="Coming in Phase 04" className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#22302a] bg-[#121a16] text-[12px] mono text-[#9aa6a0] opacity-60 cursor-not-allowed">
              <Plus size={13} /> Add to Portfolio
            </button>
            <button title="Coming in Phase 04" className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#22302a] bg-[#121a16] text-[12px] mono text-[#9aa6a0] opacity-60 cursor-not-allowed">
              <Plus size={13} /> Add to SIP
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-2 bg-[#1a1408] border-b border-[#22302a] mono text-[11px] text-[#c9a24b]">
        ⚠ Synthetic sample OHLCV — connect Phase 01's history/{`{ticker}`}.json feed for real price data.
      </div>

      {/* ================= BODY ================= */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* ---- Chart column ---- */}
        <div ref={containerRef} className="flex flex-col gap-1">
          <div className="flex items-center justify-between mb-1">
            <div className="flex gap-3">
              <label className="flex items-center gap-1.5 mono text-[11px] text-[#9aa6a0] cursor-pointer">
                <input type="checkbox" checked={showMA} onChange={(e) => setShowMA(e.target.checked)} className="accent-[#1fae6b]" />
                <span className="text-[#2fd888]">MA20</span>/<span className="text-[#e08a3e]">MA50</span>
              </label>
              <label className="flex items-center gap-1.5 mono text-[11px] text-[#9aa6a0] cursor-pointer">
                <input type="checkbox" checked={showBB} onChange={(e) => setShowBB(e.target.checked)} className="accent-[#1fae6b]" />
                <span className="text-[#c9a24b]">Bollinger Bands</span>
              </label>
            </div>
            <div className="mono text-[11px] text-[#5f6b65]">
              O {hoverBar.open.toFixed(2)} H {hoverBar.high.toFixed(2)} L {hoverBar.low.toFixed(2)} C {hoverBar.close.toFixed(2)} · Vol {hoverBar.volume.toLocaleString()}
            </div>
          </div>

          <div className="border border-[#22302a] rounded-t-md bg-[#0f1613] overflow-hidden">
            <PricePane bars={bars} ind={ind} showMA={showMA} showBB={showBB} width={paneWidth} height={320} hoverIdx={hoverIdx} setHoverIdx={setHoverIdx} />
          </div>
          <div className="border-x border-b border-[#22302a] bg-[#0f1613] overflow-hidden relative">
            <div className="absolute left-2 top-1 mono text-[9px] text-[#5f6b65] uppercase tracking-wide z-10">RSI (14)</div>
            <RSIPane bars={bars} ind={ind} width={paneWidth} height={90} hoverIdx={hoverIdx} setHoverIdx={setHoverIdx} />
          </div>
          <div className="border-x border-b border-[#22302a] bg-[#0f1613] overflow-hidden relative">
            <div className="absolute left-2 top-1 mono text-[9px] text-[#5f6b65] uppercase tracking-wide z-10">MACD (12,26,9)</div>
            <MACDPane bars={bars} ind={ind} width={paneWidth} height={90} hoverIdx={hoverIdx} setHoverIdx={setHoverIdx} />
          </div>
          <div className="border-x border-b border-[#22302a] rounded-b-md bg-[#0f1613] overflow-hidden relative">
            <div className="absolute left-2 top-1 mono text-[9px] text-[#5f6b65] uppercase tracking-wide z-10">Volume</div>
            <VolumePane bars={bars} ind={ind} width={paneWidth} height={70} hoverIdx={hoverIdx} setHoverIdx={setHoverIdx} />
          </div>
        </div>

        {/* ---- Side panel ---- */}
        <div className="flex flex-col gap-4">
          {/* Trading Signal Score */}
          <div className="border border-[#22302a] rounded-md bg-[#121a16] p-4">
            <div className="flex items-center gap-2 mono text-[11px] uppercase tracking-wide text-[#5f6b65] mb-2">
              <Activity size={13} /> Trading Signal Score
            </div>
            <div className="text-3xl font-semibold mono mb-1" style={{ color: scoreColor(signal.score) }}>{signal.score}</div>
            <div className="text-[11px] text-[#5f6b65] mb-3">Short-term — "is this doing something unusual right now"</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Momentum", signal.momentumLabel],
                ["Volume", signal.volumeLabel],
                ["Volatility", signal.volatilityLabel],
                ["Mean-Reversion", signal.reversionLabel],
              ].map(([k, v]) => (
                <div key={k} className="bg-[#0f1613] rounded px-2.5 py-2">
                  <div className="mono text-[9px] text-[#5f6b65] uppercase">{k}</div>
                  <div className="mono text-[12px] font-semibold" style={{ color: labelColor(v) }}>{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-[#1a2420] flex flex-col gap-1 mono text-[10.5px] text-[#9aa6a0]">
              <div className="flex justify-between"><span>ROC (10d)</span><span>{signal.roc10.toFixed(2)}%</span></div>
              <div className="flex justify-between"><span>ATR</span><span>{signal.atrPct != null ? signal.atrPct.toFixed(2) + "%" : "—"}</span></div>
              <div className="flex justify-between"><span>%B (Bollinger)</span><span>{(signal.percentB * 100).toFixed(0)}%</span></div>
              <div className="flex justify-between"><span>Vol vs 20D avg</span><span>{signal.volRatio.toFixed(2)}×</span></div>
            </div>
          </div>

          {/* Risk context */}
          <div className="border border-[#22302a] rounded-md bg-[#121a16] p-4">
            <div className="flex items-center gap-2 mono text-[11px] uppercase tracking-wide text-[#5f6b65] mb-2">
              <Shield size={13} /> Risk Context
            </div>
            <p className="text-[12px] text-[#9aa6a0] leading-relaxed">
              {signal.volatilityLabel === "Elevated"
                ? `ATR is running high (${signal.atrPct?.toFixed(1)}% of price) — size any position smaller than usual here to keep risk-per-trade constant.`
                : signal.volatilityLabel === "Compressed"
                ? `ATR is compressed (${signal.atrPct?.toFixed(1)}% of price) — a breakout from this range, if it comes, tends to move further than normal.`
                : `Volatility is in a normal range (${signal.atrPct?.toFixed(1)}% ATR) — standard position sizing applies.`}
            </p>
          </div>

          {/* Health Score breakdown */}
          <div className="border border-[#22302a] rounded-md bg-[#121a16] p-4">
            <div className="flex items-center gap-2 mono text-[11px] uppercase tracking-wide text-[#5f6b65] mb-2">
              <BarChart3 size={13} /> Health Score
            </div>
            <div className="text-3xl font-semibold mono mb-1" style={{ color: scoreColor(hScore) }}>{hScore}</div>
            <div className="text-[11px] text-[#5f6b65] mb-3">Long-term — "should I hold this for years"</div>
            <div className="flex flex-col gap-1.5 mono text-[11px]">
              {[
                ["Profitability (ROE)", "30%", stock.roe + "%"],
                ["Balance sheet (D/E)", "25%", stock.de],
                ["Earnings consistency", "20%", stock.epsGrowth],
                ["Cash generation (NOCFPS)", "15%", stock.nocfps],
                ["Sector-cycle bonus", "10%", DAMANI_SECTORS.has(stock.sector) ? "Damani leadership" : "Standard"],
              ].map(([label, weight, val]) => (
                <div key={label} className="flex justify-between text-[#9aa6a0]">
                  <span>{label} <span className="text-[#5f6b65]">({weight})</span></span>
                  <span className="text-[#e9ede8]">{val}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2 text-[10.5px] text-[#5f6b65] px-1">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            Not financial advice — Trading Signal and Health Scores are computed from sample data for this phase. Verify independently before acting.
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import {
  TrendingUp, TrendingDown, Plus, Trash2, Bot, ChevronDown, ChevronUp,
  Wallet, CalendarDays, ListChecks, Sparkles, CheckCircle2, XCircle, Pause,
  ArrowRight, BarChart2, ShieldAlert, Microscope, Loader2, AlertCircle
} from "lucide-react";
import { useSIPPortfolio } from "../utils/useSIPPortfolio.js";

const TAB_DEFS = [
  { key: "portfolio", label: "Portfolio",    Icon: Wallet },
  { key: "log",       label: "Monthly Log",  Icon: CalendarDays },
  { key: "picks",     label: "AI Picks",     Icon: Sparkles },
  { key: "watchlist", label: "Watchlist",    Icon: ListChecks },
];

const REC_COLORS = {
  PICK:  { bg: "bg-[#1fae6b22]", border: "border-[#1fae6b]", text: "text-[#2fd888]", Icon: CheckCircle2 },
  HOLD:  { bg: "bg-[#c9a24b22]", border: "border-[#c9a24b]", text: "text-[#c9a24b]", Icon: Pause },
  SKIP:  { bg: "bg-[#e5555a22]", border: "border-[#e5555a]", text: "text-[#ff7176]", Icon: XCircle },
};

function fmt(n)    { return typeof n === "number" ? n.toFixed(2) : "—"; }
function fmtK(n)   { return n >= 1000 ? `${(n/1000).toFixed(1)}k` : n?.toFixed(0) ?? "—"; }
function sign(n)   { return n >= 0 ? "+" : ""; }

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "text-white" }) {
  return (
    <div className="bg-[#121a16] border border-[#22302a] rounded-xl p-4 flex flex-col gap-1">
      <div className="text-[11px] font-bold text-[#7d8a83] uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mono ${color}`}>{value}</div>
      {sub && <div className="text-xs text-[#5f6b65]">{sub}</div>}
    </div>
  );
}

function AgentBadge({ label, Icon, points, reasons, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const col = points >= 2 ? "text-[#2fd888]" : points >= 0 ? "text-[#c9a24b]" : "text-[#ff7176]";
  return (
    <div className="bg-[#0a0f0c] border border-[#22302a] rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#1a2420] transition-colors">
        <div className="flex items-center gap-2 text-[13px] font-bold">
          <Icon size={14} className="text-[#9aa6a0]" /> {label}
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-bold mono text-sm ${col}`}>{sign(points)}{points} pts</span>
          {open ? <ChevronUp size={14} className="text-[#5f6b65]" /> : <ChevronDown size={14} className="text-[#5f6b65]" />}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1">
          {reasons.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-[12px] text-[#9aa6a0]">
              <ArrowRight size={11} className="shrink-0 mt-0.5 text-[#5f6b65]" />
              {r}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function PortfolioTab({ holdings, livePrices, months, onSelectTicker }) {
  const rows = Object.entries(holdings).map(([ticker, h]) => {
    const ltp = livePrices?.find(p => p.ticker === ticker)?.price ?? 0;
    const marketVal = h.qty * ltp;
    const invested = h.qty * h.avgCost;
    const pnl = marketVal - invested;
    const pnlPct = invested ? (pnl / invested) * 100 : 0;
    return { ticker, ...h, ltp, marketVal, invested, pnl, pnlPct };
  });

  const totalMarketVal = rows.reduce((s, r) => s + r.marketVal, 0);
  const totalInvested  = rows.reduce((s, r) => s + r.invested,  0);
  const totalPnl       = totalMarketVal - totalInvested;
  const totalPnlPct    = totalInvested ? (totalPnl / totalInvested) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Portfolio Value" value={`৳${fmtK(totalMarketVal)}`} sub="Market price × Qty" />
        <StatCard label="Total Invested" value={`৳${fmtK(totalInvested)}`} sub="Avg cost × Qty" />
        <StatCard label="Unrealized P&L" value={`${sign(totalPnl)}৳${fmt(totalPnl)}`}
          color={totalPnl >= 0 ? "text-[#2fd888]" : "text-[#ff7176]"}
          sub={`${sign(totalPnlPct)}${totalPnlPct.toFixed(2)}%`} />
        <StatCard label="Holdings" value={rows.length} sub="Active positions" />
      </div>

      {/* Holdings table */}
      <div className="bg-[#121a16] border border-[#22302a] rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[#1a2420] text-[#7d8a83] text-[11px] uppercase tracking-wider">
              <th className="px-4 py-3">Ticker</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Avg Cost</th>
              <th className="px-4 py-3 text-right">LTP</th>
              <th className="px-4 py-3 text-right">Market Val</th>
              <th className="px-4 py-3 text-right">P&L</th>
              <th className="px-4 py-3 text-right">P&L %</th>
            </tr>
          </thead>
          <tbody>
            {rows.sort((a, b) => b.marketVal - a.marketVal).map((r, i) => (
              <tr key={r.ticker}
                onClick={() => onSelectTicker?.(r.ticker)}
                className={`border-t border-[#22302a] hover:bg-[#1a2420] cursor-pointer transition-colors ${i % 2 === 0 ? "" : "bg-[#0d1410]"}`}>
                <td className="px-4 py-3 font-bold text-white">{r.ticker}</td>
                <td className="px-4 py-3 text-right mono text-[#9aa6a0]">{r.qty}</td>
                <td className="px-4 py-3 text-right mono text-[#9aa6a0]">৳{fmt(r.avgCost)}</td>
                <td className="px-4 py-3 text-right mono text-white">৳{fmt(r.ltp)}</td>
                <td className="px-4 py-3 text-right mono text-white">৳{fmt(r.marketVal)}</td>
                <td className={`px-4 py-3 text-right mono font-bold ${r.pnl >= 0 ? "text-[#2fd888]" : "text-[#ff7176]"}`}>
                  {sign(r.pnl)}৳{fmt(Math.abs(r.pnl))}
                </td>
                <td className={`px-4 py-3 text-right mono font-bold flex items-center justify-end gap-1 ${r.pnlPct >= 0 ? "text-[#2fd888]" : "text-[#ff7176]"}`}>
                  {r.pnlPct >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {sign(r.pnlPct)}{r.pnlPct.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MonthLogTab({ months, holdings, livePrices, addPurchaseToMonth, removePurchaseFromMonth, updateMonthBaseBudget, ensureCurrentMonth, getCurrentMonthId }) {
  const [activeMonth, setActiveMonth] = useState(months[0]?.id ?? "");
  const [form, setForm] = useState({ ticker: "", qty: "", price: "", date: new Date().toISOString().slice(0, 10) });
  const [editBudget, setEditBudget] = useState(false);
  const [budgetVal, setBudgetVal] = useState("");

  const curMonthId = getCurrentMonthId();
  const month = months.find(m => m.id === activeMonth);

  const handleNewMonth = () => {
    ensureCurrentMonth();
    setActiveMonth(curMonthId);
  };

  const handleAddPurchase = () => {
    if (!form.ticker || !form.qty || !form.price || !activeMonth) return;
    addPurchaseToMonth(activeMonth, {
      ticker: form.ticker.toUpperCase().trim(),
      qty: parseFloat(form.qty),
      price: parseFloat(form.price),
      date: form.date,
    });
    setForm(f => ({ ...f, ticker: "", qty: "", price: "" }));
  };

  return (
    <div className="flex gap-4">
      {/* Sidebar: month list */}
      <div className="w-44 shrink-0 space-y-1">
        {!months.find(m => m.id === curMonthId) && (
          <button onClick={handleNewMonth}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-bold text-[#2fd888] border border-dashed border-[#22302a] rounded-lg hover:border-[#1fae6b] transition-colors">
            <Plus size={14} /> New Month
          </button>
        )}
        {months.map(m => (
          <button key={m.id} onClick={() => setActiveMonth(m.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-colors ${m.id === activeMonth ? "bg-[#1fae6b22] border border-[#1fae6b] text-[#2fd888]" : "text-[#9aa6a0] hover:bg-[#1a2420]"}`}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Main content */}
      {month ? (
        <div className="flex-1 space-y-4">
          {/* Budget bar */}
          <div className="bg-[#121a16] border border-[#22302a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-bold text-[#9aa6a0]">Effective Budget (Base + Carry Forward)</div>
              <div className="flex items-center gap-2">
                {editBudget ? (
                  <>
                    <input type="number" value={budgetVal} onChange={e => setBudgetVal(e.target.value)}
                      className="w-28 bg-[#0a0f0c] border border-[#22302a] rounded px-2 py-1 text-sm mono outline-none focus:border-[#1fae6b] text-white" />
                    <button onClick={() => { updateMonthBaseBudget(month.id, parseFloat(budgetVal)); setEditBudget(false); }}
                      className="text-xs font-bold text-[#2fd888] hover:text-white">Save Base</button>
                  </>
                ) : (
                  <button onClick={() => { setBudgetVal(month.baseBudget); setEditBudget(true); }}
                    className="text-xs font-bold text-[#9aa6a0] hover:text-white">Edit Base ৳{fmtK(month.baseBudget)}</button>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-xs font-bold mb-3">
              <span className="text-[#5f6b65] bg-[#1a2420] px-2 py-1 rounded">Base: ৳{fmtK(month.baseBudget)}</span>
              <span className="text-[#5f6b65] bg-[#1a2420] px-2 py-1 rounded">Carry In: ৳{fmt(month.carryIn)}</span>
              <span className="text-white bg-[#22302a] px-2 py-1 rounded">Effective: ৳{fmt(month.effectiveBudget)}</span>
            </div>

            <div className="flex items-end gap-3">
              <span className="text-2xl font-bold mono text-white">৳{fmt(month.totalSpent)} <span className="text-sm text-[#7d8a83]">spent</span></span>
              <span className={`ml-auto text-sm font-bold mono ${month.remaining >= 0 ? "text-[#2fd888]" : "text-[#ff7176]"}`}>
                ৳{fmt(Math.abs(month.remaining))} {month.remaining >= 0 ? "carry forward" : "deficit"}
              </span>
            </div>
            <div className="mt-2 h-2 bg-[#1a2420] rounded-full overflow-hidden">
              <div className="h-full bg-[#1fae6b] rounded-full transition-all"
                style={{ width: `${Math.min(100, (month.totalSpent / month.effectiveBudget) * 100)}%` }} />
            </div>
          </div>

          {/* Purchases list */}
          <div className="bg-[#121a16] border border-[#22302a] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#22302a] text-sm font-bold text-[#9aa6a0]">
              Confirmed Purchases — {month.label}
            </div>
            {month.purchases.length === 0 ? (
              <div className="px-4 py-8 text-center text-[#5f6b65] text-sm">No purchases confirmed yet</div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#1a2420] text-[10px] text-[#7d8a83] uppercase tracking-wider">
                    <th className="px-4 py-2">Ticker</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Price</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-right">Date</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {month.purchases.map((p, i) => (
                    <tr key={i} className="border-t border-[#22302a] hover:bg-[#1a2420]">
                      <td className="px-4 py-2 font-bold text-white">{p.ticker}</td>
                      <td className="px-4 py-2 text-right mono text-[#9aa6a0]">{p.qty}</td>
                      <td className="px-4 py-2 text-right mono text-[#9aa6a0]">৳{fmt(p.price)}</td>
                      <td className="px-4 py-2 text-right mono font-bold text-white">৳{fmt(p.amount)}</td>
                      <td className="px-4 py-2 text-right text-[#5f6b65] text-xs">{p.date}</td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => removePurchaseFromMonth(month.id, i)} className="text-[#5f6b65] hover:text-[#e5555a]"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Add purchase form */}
          <div className="bg-[#121a16] border border-[#22302a] rounded-xl p-4">
            <div className="text-sm font-bold text-[#9aa6a0] mb-3 flex items-center gap-2">
              <Plus size={14} /> Confirm a Purchase
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <input placeholder="Ticker" value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}
                list="sip-log-tickers"
                className="bg-[#0a0f0c] border border-[#22302a] rounded px-3 py-2 text-sm font-bold mono uppercase outline-none focus:border-[#1fae6b] text-white" />
              <datalist id="sip-log-tickers">
                {["SQURPHARMA","BXPHARMA","IBNSINA","BERGERPBL","MARICO","LHB","MPETROLEUM","BSRMSTEEL"].map(t => <option key={t} value={t} />)}
              </datalist>
              <input type="number" placeholder="Qty" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                className="bg-[#0a0f0c] border border-[#22302a] rounded px-3 py-2 text-sm mono outline-none focus:border-[#1fae6b] text-white" />
              <input type="number" placeholder="Price ৳" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                className="bg-[#0a0f0c] border border-[#22302a] rounded px-3 py-2 text-sm mono outline-none focus:border-[#1fae6b] text-white" />
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="bg-[#0a0f0c] border border-[#22302a] rounded px-3 py-2 text-sm mono outline-none focus:border-[#1fae6b] text-white" />
              <button onClick={handleAddPurchase}
                className="bg-[#1fae6b] hover:bg-[#2fd888] text-[#0a0f0c] font-bold rounded px-4 py-2 text-sm transition-colors">
                + Add
              </button>
            </div>
            {form.qty && form.price && (
              <div className="mt-2 text-xs text-[#7d8a83]">
                Total: ৳{(parseFloat(form.qty || 0) * parseFloat(form.price || 0)).toFixed(2)}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-[#5f6b65]">
          Select a month to view
        </div>
      )}
    </div>
  );
}

function AIPicksTab({ months, watchlist, holdings, livePrices, allStocks, setAgentPicks, getCurrentMonthId, ensureCurrentMonth }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ step: "", pct: 0 });
  const [expandedTicker, setExpandedTicker] = useState(null);

  const curMonthId = getCurrentMonthId();
  const curMonth = months.find(m => m.id === curMonthId) ?? months[0];
  const hasPicks = curMonth?.agentPicks?.length > 0;

  const handleRun = async () => {
    if (running) return;
    setRunning(true);
    setProgress({ step: "Fetching AI picks from server...", pct: 50 });
    try {
      ensureCurrentMonth();
      // Fetch latest_picks.json generated by ai_pipeline.py
      const res = await fetch(`https://raw.githubusercontent.com/ikraaaaam/bd-multibagger-data/main/data/latest_picks.json?v=${Date.now()}`);
      if (!res.ok) throw new Error("No AI picks found. Please run ai_pipeline.py first.");
      const picks = await res.json();
      setAgentPicks(curMonthId, picks);
    } catch (e) {
      console.error(e);
      alert(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Bot size={20} className="text-[#c9a24b]" /> Monthly Pick Agent
          </h2>
          <p className="text-xs text-[#7d8a83] mt-0.5">
            Technical · Research · Risk agents collaborate → Orchestrator decides
          </p>
        </div>
        <button onClick={handleRun} disabled={running}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${running ? "bg-[#1a2420] text-[#5f6b65] cursor-not-allowed" : "bg-[#c9a24b] text-black hover:bg-[#d4b264]"}`}>
          {running ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {running ? "Running..." : hasPicks ? "Re-run This Month" : "Run for This Month"}
        </button>
      </div>

      {/* Progress bar */}
      {running && (
        <div className="bg-[#121a16] border border-[#22302a] rounded-xl p-4 space-y-2">
          <div className="text-sm text-[#9aa6a0] flex items-center gap-2">
            <Loader2 size={13} className="animate-spin text-[#c9a24b]" /> {progress.step}
          </div>
          <div className="h-1.5 bg-[#1a2420] rounded-full overflow-hidden">
            <div className="h-full bg-[#c9a24b] rounded-full transition-all duration-300" style={{ width: `${progress.pct}%` }} />
          </div>
        </div>
      )}

      {/* Results */}
      {!running && hasPicks && (
        <>
          <div className="text-xs text-[#7d8a83] flex items-center gap-1">
            <AlertCircle size={12} /> Analysis for {curMonth?.label}
            {curMonth.agentRunAt && ` · Run ${new Date(curMonth.agentRunAt).toLocaleString()}`}
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3">
            {["PICK","HOLD","SKIP"].map(rec => {
              const { bg, border, text, Icon } = REC_COLORS[rec];
              const cnt = curMonth.agentPicks.filter(p => p.recommendation === rec).length;
              return (
                <div key={rec} className={`${bg} border ${border} rounded-xl p-3 text-center`}>
                  <Icon size={18} className={`${text} mx-auto mb-1`} />
                  <div className={`text-2xl font-bold mono ${text}`}>{cnt}</div>
                  <div className="text-xs text-[#7d8a83] font-bold uppercase tracking-wider">{rec}</div>
                </div>
              );
            })}
          </div>

          {/* Picks list */}
          <div className="space-y-3">
            {curMonth.agentPicks.map(pick => {
              const { bg, border, text, Icon } = REC_COLORS[pick.recommendation] ?? REC_COLORS.HOLD;
              const isOpen = expandedTicker === pick.ticker;
              return (
                <div key={pick.ticker} className={`${bg} border ${border} rounded-xl overflow-hidden`}>
                  <button onClick={() => setExpandedTicker(isOpen ? null : pick.ticker)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#ffffff08] transition-colors">
                    <Icon size={18} className={text} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{pick.ticker}</span>
                        <span className={`text-xs font-bold ${text} border ${border} rounded px-1.5 py-0.5`}>{pick.recommendation}</span>
                      </div>
                      <p className="text-[12px] text-[#9aa6a0] mt-0.5 line-clamp-1">{pick.orchestratorReason}</p>
                    </div>
                    <div className="text-right">
                      <div className="mono font-bold text-white text-sm">৳{fmt(pick.ltp)}</div>
                      <div className={`text-xs font-bold ${text}`}>Score {pick.totalScore >= 0 ? "+" : ""}{pick.totalScore}</div>
                    </div>
                    {isOpen ? <ChevronUp size={16} className="text-[#5f6b65]" /> : <ChevronDown size={16} className="text-[#5f6b65]" />}
                  </button>

                  {isOpen && (
                    <div className="border-t border-[#ffffff15] px-4 pt-3 pb-4 space-y-3">
                      <p className="text-sm text-[#9aa6a0]">{pick.orchestratorReason}</p>
                      {pick.agents?.map(a => (
                        <AgentBadge key={a.agent} label={a.agent}
                          Icon={a.agent.includes("Technical") ? BarChart2 : a.agent.includes("Research") ? Microscope : ShieldAlert}
                          points={a.points} reasons={a.reasons} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#5f6b65] bg-[#1a2420] p-3 rounded-lg border border-[#22302a]">
            <AlertCircle size={13} className="shrink-0 text-[#c9a24b]" />
            Not financial advice. Agent signals are based on deterministic rules over scraped fundamentals and live prices. Always verify independently before placing orders.
          </div>
        </>
      )}

      {!running && !hasPicks && (
        <div className="bg-[#121a16] border border-[#22302a] rounded-xl p-10 text-center text-[#5f6b65]">
          <Bot size={40} className="mx-auto mb-3 text-[#22302a]" />
          <p className="text-sm font-bold">No picks yet for this month</p>
          <p className="text-xs mt-1">Click "Run for This Month" to start the agent analysis</p>
        </div>
      )}
    </div>
  );
}

function WatchlistTab({ watchlist, addToWatchlist, removeFromWatchlist, livePrices, allStocks }) {
  const [input, setInput] = useState("");

  const enriched = watchlist.map(ticker => {
    const row = allStocks?.find(s => s.ticker === ticker);
    const lp  = livePrices?.find(p => p.ticker === ticker);
    return { ticker, ltp: lp?.price ?? 0, changePct: row?.changePct ?? 0, score: row?.score ?? null };
  });

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && input.trim()) { addToWatchlist(input); setInput(""); } }}
          placeholder="Add ticker (e.g. OLYMPIC)…"
          list="sip-wl-tickers"
          className="flex-1 bg-[#0a0f0c] border border-[#22302a] rounded-lg px-3 py-2 font-bold mono uppercase outline-none focus:border-[#1fae6b] text-white" />
        <datalist id="sip-wl-tickers">
          {livePrices?.map(p => <option key={p.ticker} value={p.ticker} />)}
        </datalist>
        <button onClick={() => { if (input.trim()) { addToWatchlist(input); setInput(""); } }}
          className="bg-[#1fae6b] hover:bg-[#2fd888] text-[#0a0f0c] font-bold rounded-lg px-4 text-sm transition-colors">
          Add
        </button>
      </div>

      <div className="bg-[#121a16] border border-[#22302a] rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[#1a2420] text-[11px] text-[#7d8a83] uppercase tracking-wider">
              <th className="px-4 py-3">Ticker</th>
              <th className="px-4 py-3 text-right">LTP</th>
              <th className="px-4 py-3 text-right">Change %</th>
              <th className="px-4 py-3 text-right">Health</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((r, i) => (
              <tr key={r.ticker} className={`border-t border-[#22302a] ${i % 2 === 0 ? "" : "bg-[#0d1410]"}`}>
                <td className="px-4 py-3 font-bold text-white">{r.ticker}</td>
                <td className="px-4 py-3 text-right mono text-white">{r.ltp ? `৳${fmt(r.ltp)}` : "—"}</td>
                <td className={`px-4 py-3 text-right mono font-bold ${r.changePct >= 0 ? "text-[#2fd888]" : "text-[#ff7176]"}`}>
                  {r.ltp ? `${sign(r.changePct)}${r.changePct.toFixed(2)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {r.score != null ? (
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${r.score >= 70 ? "bg-[#1fae6b22] text-[#2fd888]" : r.score >= 50 ? "bg-[#c9a24b22] text-[#c9a24b]" : "bg-[#e5555a22] text-[#ff7176]"}`}>
                      {r.score}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => removeFromWatchlist(r.ticker)} className="text-[#5f6b65] hover:text-[#e5555a]"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SIPTracker({ livePrices, allStocks, onSelectTicker }) {
  const [tab, setTab] = useState("portfolio");
  const {
    watchlist, addToWatchlist, removeFromWatchlist,
    holdings, months,
    getCurrentMonthId, ensureCurrentMonth,
    updateMonthBaseBudget, addPurchaseToMonth, removePurchaseFromMonth,
    setAgentPicks,
  } = useSIPPortfolio();

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
      className="min-h-screen bg-[#0a0f0c] text-[#e9ede8] px-4 md:px-8 py-6">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-full bg-[#1fae6b] flex items-center justify-center">
          <BarChart2 size={16} className="text-[#0a0f0c]" />
        </div>
        <div>
          <h1 className="text-xl font-bold">SIP Portfolio Engine</h1>
          <p className="text-xs text-[#7d8a83]">Dynamic month-wise investment tracker · AI-powered stock selection</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#22302a] mb-6 gap-1">
        {TAB_DEFS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-all -mb-px ${tab === key ? "border-[#1fae6b] text-[#2fd888]" : "border-transparent text-[#7d8a83] hover:text-[#9aa6a0]"}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "portfolio" && (
        <PortfolioTab holdings={holdings} livePrices={livePrices} months={months} onSelectTicker={onSelectTicker} />
      )}
      {tab === "log" && (
        <MonthLogTab months={months} holdings={holdings} livePrices={livePrices}
          addPurchaseToMonth={addPurchaseToMonth} removePurchaseFromMonth={removePurchaseFromMonth}
          updateMonthBaseBudget={updateMonthBaseBudget} ensureCurrentMonth={ensureCurrentMonth} getCurrentMonthId={getCurrentMonthId} />
      )}
      {tab === "picks" && (
        <AIPicksTab months={months} watchlist={watchlist} holdings={holdings} livePrices={livePrices}
          allStocks={allStocks} setAgentPicks={setAgentPicks}
          getCurrentMonthId={getCurrentMonthId} ensureCurrentMonth={ensureCurrentMonth} />
      )}
      {tab === "watchlist" && (
        <WatchlistTab watchlist={watchlist} addToWatchlist={addToWatchlist} removeFromWatchlist={removeFromWatchlist}
          livePrices={livePrices} allStocks={allStocks} />
      )}
    </div>
  );
}

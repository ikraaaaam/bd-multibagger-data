import React, { useState } from 'react';
import { Target, Play, Trash2, ArrowRight, Settings2 } from 'lucide-react';
import { usePortfolioState } from '../utils/usePortfolioState';

export default function SIPTracker({ livePrices }) {
  const { portfolio, updatePortfolio, sipConfig, updateSipConfig, carryForward, updateCarryForward, history, addHistory } = usePortfolioState();
  
  const [amountInput, setAmountInput] = useState(sipConfig.amount);
  const [stepUpInput, setStepUpInput] = useState(sipConfig.stepUpPct);
  const [newTicker, setNewTicker] = useState("");
  const [newPct, setNewPct] = useState(10);

  const totalTargetPct = Object.values(sipConfig.targets).reduce((a, b) => a + b, 0);

  const getLivePrice = (ticker) => {
    if (!livePrices) return 0;
    const s = livePrices.find(s => s.ticker === ticker);
    return s ? s.price : 0;
  };

  const handleSaveConfig = () => {
    updateSipConfig({ ...sipConfig, amount: Number(amountInput), stepUpPct: Number(stepUpInput) });
  };

  const handleAddTarget = () => {
    if (!newTicker.trim()) return;
    const t = newTicker.trim().toUpperCase();
    updateSipConfig({
      ...sipConfig,
      targets: { ...sipConfig.targets, [t]: Number(newPct) }
    });
    setNewTicker("");
  };

  const handleRemoveTarget = (t) => {
    const newTargets = { ...sipConfig.targets };
    delete newTargets[t];
    updateSipConfig({ ...sipConfig, targets: newTargets });
  };

  const runMonthlySIP = () => {
    if (totalTargetPct !== 100) {
      alert("Total target allocation must equal 100% before running SIP.");
      return;
    }
    
    const executionDate = new Date().toISOString().split('T')[0];
    const buys = [];
    const newCarryForward = { ...carryForward };
    const newPortfolio = { ...portfolio };

    for (const [ticker, pct] of Object.entries(sipConfig.targets)) {
      const ltp = getLivePrice(ticker);
      if (!ltp) continue; // Skip if no live price

      const monthlyBudget = sipConfig.amount * (pct / 100);
      const previousCf = newCarryForward[ticker] || 0;
      const totalAvailable = monthlyBudget + previousCf;

      const qty = Math.floor(totalAvailable / ltp);
      const spent = qty * ltp;
      const leftover = totalAvailable - spent;

      newCarryForward[ticker] = leftover;

      if (qty > 0) {
        if (!newPortfolio[ticker]) newPortfolio[ticker] = { qty: 0, totalInvested: 0 };
        newPortfolio[ticker].qty += qty;
        newPortfolio[ticker].totalInvested += spent;
        buys.push({ ticker, qty, price: ltp, spent });
      }
    }

    // Save state
    updatePortfolio(newPortfolio);
    updateCarryForward(newCarryForward);
    addHistory({ date: executionDate, buys });
    
    alert(`SIP Executed! Bought ${buys.length} stocks.`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#0a0f0c] text-[#e9ede8] font-['IBM_Plex_Sans']">
      
      <div className="flex gap-8">
        
        {/* SIP CONFIGURATION */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2"><Settings2 className="text-[#2fd888]" /> SIP Configuration</h2>
          </div>
          
          <div className="bg-[#121a16] border border-[#22302a] rounded-xl p-5 mb-8">
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-[12px] font-bold text-[#7d8a83] uppercase tracking-wider mb-2">Monthly Amount (৳)</label>
                <input 
                  type="number" 
                  value={amountInput} 
                  onChange={e => setAmountInput(e.target.value)}
                  onBlur={handleSaveConfig}
                  className="w-full bg-[#0a0f0c] border border-[#22302a] rounded p-2.5 outline-none font-bold font-['IBM_Plex_Mono'] focus:border-[#1fae6b]" 
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[#7d8a83] uppercase tracking-wider mb-2">Annual Step-Up (%)</label>
                <input 
                  type="number" 
                  value={stepUpInput} 
                  onChange={e => setStepUpInput(e.target.value)}
                  onBlur={handleSaveConfig}
                  className="w-full bg-[#0a0f0c] border border-[#22302a] rounded p-2.5 outline-none font-bold font-['IBM_Plex_Mono'] focus:border-[#1fae6b]" 
                />
              </div>
            </div>

            <div className="mb-4 flex items-center justify-between">
              <label className="block text-[12px] font-bold text-[#7d8a83] uppercase tracking-wider">Target Allocation</label>
              <div className={`font-bold font-['IBM_Plex_Mono'] text-[14px] ${totalTargetPct === 100 ? 'text-[#2fd888]' : 'text-[#e5555a]'}`}>
                Total: {totalTargetPct}%
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {Object.entries(sipConfig.targets).map(([t, pct]) => (
                <div key={t} className="flex items-center gap-4 bg-[#0a0f0c] border border-[#22302a] p-3 rounded">
                  <div className="font-bold font-['IBM_Plex_Mono'] w-24 text-white">{t}</div>
                  <div className="flex-1 bg-[#1a2420] h-2 rounded-full overflow-hidden">
                    <div className="bg-[#1fae6b] h-full" style={{ width: `${pct}%` }}></div>
                  </div>
                  <div className="font-bold font-['IBM_Plex_Mono'] w-12 text-right">{pct}%</div>
                  <button onClick={() => handleRemoveTarget(t)} className="text-[#5f6b65] hover:text-[#e5555a]"><Trash2 size={18}/></button>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <input 
                placeholder="Ticker (e.g. BATBC)" 
                value={newTicker} onChange={e => setNewTicker(e.target.value)}
                className="flex-1 bg-[#0a0f0c] border border-[#22302a] rounded px-3 outline-none font-bold font-['IBM_Plex_Mono'] uppercase" 
              />
              <input 
                type="number" placeholder="%" 
                value={newPct} onChange={e => setNewPct(e.target.value)}
                className="w-20 bg-[#0a0f0c] border border-[#22302a] rounded px-3 outline-none font-bold font-['IBM_Plex_Mono']" 
              />
              <button onClick={handleAddTarget} className="bg-[#22302a] hover:bg-[#1fae6b] hover:text-[#0a0f0c] px-4 rounded font-bold transition-colors">Add</button>
            </div>
          </div>

          {/* CARRY FORWARD ENGINE */}
          <div className="flex items-center justify-between mb-4 mt-8">
            <h2 className="text-xl font-bold flex items-center gap-2"><ArrowRight className="text-[#c9a24b]" /> Carry-Forward Balances</h2>
          </div>
          <div className="bg-[#121a16] border border-[#22302a] rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#1a2420] text-[#7d8a83] text-[12px] uppercase tracking-wider">
                  <th className="p-4 font-bold">Ticker</th>
                  <th className="p-4 font-bold text-right">LTP</th>
                  <th className="p-4 font-bold text-right">Target Budget</th>
                  <th className="p-4 font-bold text-right">Carry Forward</th>
                </tr>
              </thead>
              <tbody className="font-['IBM_Plex_Mono'] text-[14px]">
                {Object.entries(sipConfig.targets).map(([ticker, pct]) => {
                  const monthlyBudget = sipConfig.amount * (pct / 100);
                  const cf = carryForward[ticker] || 0;
                  return (
                    <tr key={ticker} className="border-b border-[#1a2420]">
                      <td className="p-4 font-bold text-white">{ticker}</td>
                      <td className="p-4 text-right text-[#9aa6a0]">{getLivePrice(ticker).toFixed(2)}</td>
                      <td className="p-4 text-right">{monthlyBudget.toLocaleString()}</td>
                      <td className="p-4 text-right font-bold text-[#c9a24b]">{cf.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* SIP EXECUTION & LEDGER */}
        <div className="w-[400px]">
          <div className="bg-[#1fae6b22] border border-[#1fae6b] rounded-xl p-6 mb-8 flex flex-col items-center text-center">
            <h3 className="font-bold text-lg text-white mb-2">Ready for Execution?</h3>
            <p className="text-[#9aa6a0] text-sm mb-6">Clicking execute will buy shares at Current Live Market Price based on your allocation + carry forward.</p>
            <button 
              onClick={runMonthlySIP}
              disabled={totalTargetPct !== 100}
              className="w-full flex items-center justify-center gap-2 bg-[#1fae6b] text-[#0a0f0c] hover:bg-[#2fd888] disabled:bg-[#22302a] disabled:text-[#5f6b65] py-3 rounded-lg font-bold text-lg transition-colors"
            >
              <Play fill="currentColor" size={20} /> Execute This Month
            </button>
          </div>

          <h2 className="text-xl font-bold mb-4">SIP Ledger</h2>
          <div className="space-y-4">
            {history.length === 0 ? (
              <div className="text-[#5f6b65] text-sm italic">No execution history yet.</div>
            ) : (
              history.map((h, i) => (
                <div key={i} className="bg-[#121a16] border border-[#22302a] rounded-lg p-4">
                  <div className="font-bold text-[#9aa6a0] mb-3 border-b border-[#22302a] pb-2">{h.date}</div>
                  {h.buys.length === 0 ? (
                    <div className="text-[#5f6b65] text-sm">No shares bought (all budget carried forward).</div>
                  ) : (
                    <div className="space-y-2 font-['IBM_Plex_Mono'] text-[13px]">
                      {h.buys.map((b, j) => (
                        <div key={j} className="flex justify-between items-center">
                          <span className="font-bold text-white">{b.ticker}</span>
                          <span className="text-[#5f6b65]">{b.qty} @ {b.price.toFixed(2)}</span>
                          <span className="text-[#2fd888]">+৳{b.spent.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

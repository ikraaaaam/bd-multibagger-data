import React from 'react';
import { Briefcase, TrendingUp, TrendingDown, Target, LayoutGrid } from 'lucide-react';
import { usePortfolioState } from '../utils/usePortfolioState';

export default function Portfolio({ livePrices, onSelectTicker }) {
  const { portfolio, sipConfig } = usePortfolioState();
  const holdings = Object.entries(portfolio);

  let totalInvested = 0;
  let totalCurrentValue = 0;

  const getLivePrice = (ticker) => {
    if (!livePrices) return 0;
    const s = livePrices.find(s => s.ticker === ticker);
    return s ? s.price : 0;
  };

  const rows = holdings.map(([ticker, data]) => {
    const ltp = getLivePrice(ticker);
    const avgCost = data.qty > 0 ? data.totalInvested / data.qty : 0;
    const currentVal = data.qty * ltp;
    const pnl = currentVal - data.totalInvested;
    const pnlPct = data.totalInvested > 0 ? (pnl / data.totalInvested) * 100 : 0;
    
    totalInvested += data.totalInvested;
    totalCurrentValue += currentVal;

    return { ticker, qty: data.qty, avgCost, ltp, totalInvested: data.totalInvested, currentVal, pnl, pnlPct };
  });

  const totalPnl = totalCurrentValue - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  if (rows.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-[#9aa6a0]">
        <Briefcase size={48} className="mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-white mb-2">Your Portfolio is Empty</h2>
        <p>Add stocks manually from their detail page or execute a SIP.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#0a0f0c] text-[#e9ede8] font-['IBM_Plex_Sans']">
      
      {/* Portfolio Summary Header */}
      <div className="bg-[#121a16] border border-[#22302a] rounded-xl p-6 mb-8 flex gap-12 shadow-lg">
        <div>
          <div className="text-[13px] text-[#5f6b65] font-bold uppercase tracking-widest mb-1">Current Value</div>
          <div className="text-4xl font-bold font-['IBM_Plex_Mono']">৳{totalCurrentValue.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
        </div>
        <div>
          <div className="text-[13px] text-[#5f6b65] font-bold uppercase tracking-widest mb-1">Total Invested</div>
          <div className="text-3xl font-bold text-[#9aa6a0] font-['IBM_Plex_Mono']">৳{totalInvested.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
        </div>
        <div>
          <div className="text-[13px] text-[#5f6b65] font-bold uppercase tracking-widest mb-1">Total P&L</div>
          <div className={`text-3xl font-bold font-['IBM_Plex_Mono'] flex items-center gap-2 ${totalPnl >= 0 ? 'text-[#2fd888]' : 'text-[#e5555a]'}`}>
            {totalPnl >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
            {totalPnl >= 0 ? '+' : ''}{totalPnl.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} 
            <span className="text-xl">({totalPnlPct > 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%)</span>
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-[#121a16] border border-[#22302a] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#22302a] flex items-center gap-3 font-bold">
          <LayoutGrid className="text-[#c9a24b]" size={20} /> Your Holdings
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#1a2420] text-[#7d8a83] text-[12px] uppercase tracking-wider">
              <th className="p-4 font-bold">Ticker</th>
              <th className="p-4 font-bold text-right">Qty</th>
              <th className="p-4 font-bold text-right">Avg Cost</th>
              <th className="p-4 font-bold text-right">LTP</th>
              <th className="p-4 font-bold text-right">Invested</th>
              <th className="p-4 font-bold text-right">Value</th>
              <th className="p-4 font-bold text-right">P&L %</th>
            </tr>
          </thead>
          <tbody className="font-['IBM_Plex_Mono'] text-[14px]">
            {rows.sort((a,b) => b.currentVal - a.currentVal).map(row => (
              <tr key={row.ticker} className="border-b border-[#1a2420] hover:bg-[#1a2420] transition-colors cursor-pointer" onClick={() => onSelectTicker?.(row.ticker)}>
                <td className="p-4 font-bold text-white">{row.ticker}</td>
                <td className="p-4 text-right">{row.qty.toLocaleString()}</td>
                <td className="p-4 text-right">{row.avgCost.toFixed(2)}</td>
                <td className="p-4 text-right text-[#9aa6a0]">{row.ltp.toFixed(2)}</td>
                <td className="p-4 text-right">{row.totalInvested.toLocaleString()}</td>
                <td className="p-4 text-right font-bold text-white">{row.currentVal.toLocaleString()}</td>
                <td className={`p-4 text-right font-bold ${row.pnlPct > 0 ? 'text-[#2fd888]' : row.pnlPct < 0 ? 'text-[#e5555a]' : 'text-[#7d8a83]'}`}>
                  {row.pnlPct > 0 ? '+' : ''}{row.pnlPct.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

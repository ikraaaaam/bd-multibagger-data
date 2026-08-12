import React from 'react';
import { usePaperTrading } from '../utils/usePaperTrading';
import { FlaskConical, TrendingUp, TrendingDown, Clock, RotateCcw, Activity } from 'lucide-react';

export default function PaperDashboard({ livePrices = [], onSelectTicker }) {
  const { cash, positions, trades, limitOrders, cancelLimitOrder, resetAccount } = usePaperTrading();

  // Calculate portfolio value
  let totalEquity = cash;
  let totalUnrealized = 0;
  
  const positionsWithLive = Object.keys(positions).map(ticker => {
    const p = positions[ticker];
    const liveData = livePrices.find(l => l.ticker === ticker);
    const currentPrice = liveData?.price || p.avgPrice;
    
    const invested = p.qty * p.avgPrice;
    const currentVal = p.qty * currentPrice;
    const pnl = currentVal - invested;
    const pnlPct = (pnl / invested) * 100;
    
    totalEquity += currentVal;
    totalUnrealized += pnl;

    return { ticker, ...p, currentPrice, currentVal, pnl, pnlPct };
  });

  const realizedPnl = trades.reduce((acc, t) => acc + (t.pnl || 0), 0);
  
  // Basic analytics
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl < 0);
  const winRate = trades.length > 0 ? ((winningTrades.length / trades.filter(t => t.type === 'SELL').length) * 100).toFixed(1) : 0;

  return (
    <div className="p-6 text-[#e9ede8]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-['Instrument_Serif'] italic text-white flex items-center gap-3">
            <div className="flex items-center justify-center bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjMDAwIj48L3JlY3Q+CjxwYXRoIGQ9Ik0wIDBMOCA4Wk04IDBMMCA4WiIgc3Ryb2tlPSIjYzlhMjRiMjIiIHN0cm9rZS13aWR0aD0iMSI+PC9wYXRoPgo8L3N2Zz4=')] text-[#c9a24b] px-3 py-1 rounded border border-[#c9a24b]">
              <FlaskConical size={24} className="mr-2" /> Paper Trading
            </div>
          </h1>
          <p className="text-[#9aa6a0] text-sm mt-2">Simulated portfolio using 10-minute delayed scraping feed.</p>
        </div>
        <button 
          onClick={() => {
            if (window.confirm("Are you sure you want to reset your paper trading account? This will wipe all virtual cash, positions, and history.")) {
              resetAccount();
            }
          }}
          className="flex items-center gap-2 text-[#e5555a] hover:bg-[#e5555a22] px-4 py-2 rounded-lg font-bold transition-all text-sm border border-[#e5555a44]"
        >
          <RotateCcw size={16} /> Reset Account
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-[#121a16] border border-[#22302a] p-5 rounded-xl shadow-lg relative overflow-hidden">
          <div className="text-sm font-bold tracking-widest uppercase text-[#7d8a83] mb-1">Total Equity</div>
          <div className="text-3xl font-bold mono">৳{totalEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className={`mt-2 text-sm font-bold flex items-center gap-1 ${totalEquity >= 1000000 ? 'text-[#2fd888]' : 'text-[#e5555a]'}`}>
            {totalEquity >= 1000000 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {((totalEquity - 1000000) / 10000).toFixed(2)}% All-Time
          </div>
        </div>
        <div className="bg-[#121a16] border border-[#22302a] p-5 rounded-xl shadow-lg">
          <div className="text-sm font-bold tracking-widest uppercase text-[#7d8a83] mb-1">Available Cash</div>
          <div className="text-3xl font-bold mono">৳{cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="bg-[#121a16] border border-[#22302a] p-5 rounded-xl shadow-lg">
          <div className="text-sm font-bold tracking-widest uppercase text-[#7d8a83] mb-1">Open P&L</div>
          <div className={`text-3xl font-bold mono ${totalUnrealized >= 0 ? 'text-[#2fd888]' : 'text-[#e5555a]'}`}>
            {totalUnrealized >= 0 ? '+' : ''}৳{totalUnrealized.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="bg-[#121a16] border border-[#22302a] p-5 rounded-xl shadow-lg">
          <div className="text-sm font-bold tracking-widest uppercase text-[#7d8a83] mb-1">Win Rate</div>
          <div className="text-3xl font-bold mono flex items-center gap-2">
            <Activity size={24} className={winRate >= 50 ? 'text-[#2fd888]' : 'text-[#e5555a]'} />
            {winRate}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Open Positions */}
        <div className="bg-[#121a16] border border-[#22302a] rounded-xl shadow-lg flex flex-col">
          <div className="p-5 border-b border-[#22302a]">
            <h2 className="text-lg font-bold">Open Positions</h2>
          </div>
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#1a2420] text-[#9aa6a0] text-xs uppercase tracking-widest border-b border-[#22302a]">
                  <th className="px-5 py-3 font-semibold">Ticker</th>
                  <th className="px-5 py-3 font-semibold text-right">Qty</th>
                  <th className="px-5 py-3 font-semibold text-right">Avg Px</th>
                  <th className="px-5 py-3 font-semibold text-right">Curr Px</th>
                  <th className="px-5 py-3 font-semibold text-right">Unrealized P&L</th>
                </tr>
              </thead>
              <tbody>
                {positionsWithLive.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-5 py-8 text-center text-[#7d8a83] italic">No open positions. Use the screener to place trades.</td>
                  </tr>
                ) : (
                  positionsWithLive.map(pos => (
                    <tr key={pos.ticker} className="border-b border-[#22302a] hover:bg-[#1a2420] cursor-pointer" onClick={() => onSelectTicker(pos.ticker)}>
                      <td className="px-5 py-4 font-bold">{pos.ticker}</td>
                      <td className="px-5 py-4 mono text-right">{pos.qty}</td>
                      <td className="px-5 py-4 mono text-right">৳{pos.avgPrice.toFixed(1)}</td>
                      <td className="px-5 py-4 mono text-right">৳{pos.currentPrice.toFixed(1)}</td>
                      <td className={`px-5 py-4 mono font-bold text-right ${pos.pnl >= 0 ? 'text-[#2fd888]' : 'text-[#e5555a]'}`}>
                        {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({pos.pnlPct > 0 ? '+' : ''}{pos.pnlPct.toFixed(2)}%)
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Working Orders */}
        <div className="bg-[#121a16] border border-[#22302a] rounded-xl shadow-lg flex flex-col">
          <div className="p-5 border-b border-[#22302a]">
            <h2 className="text-lg font-bold">Working Limit Orders</h2>
          </div>
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#1a2420] text-[#9aa6a0] text-xs uppercase tracking-widest border-b border-[#22302a]">
                  <th className="px-5 py-3 font-semibold">Side</th>
                  <th className="px-5 py-3 font-semibold">Ticker</th>
                  <th className="px-5 py-3 font-semibold text-right">Qty</th>
                  <th className="px-5 py-3 font-semibold text-right">Limit Px</th>
                  <th className="px-5 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {limitOrders.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-5 py-8 text-center text-[#7d8a83] italic">No working orders.</td>
                  </tr>
                ) : (
                  limitOrders.map(order => (
                    <tr key={order.id} className="border-b border-[#22302a] hover:bg-[#1a2420]">
                      <td className={`px-5 py-4 font-bold ${order.type === 'BUY' ? 'text-[#2fd888]' : 'text-[#e5555a]'}`}>{order.type}</td>
                      <td className="px-5 py-4 font-bold">{order.ticker}</td>
                      <td className="px-5 py-4 mono text-right">{order.qty}</td>
                      <td className="px-5 py-4 mono text-right">৳{order.limitPrice.toFixed(1)}</td>
                      <td className="px-5 py-4 text-right">
                        <button onClick={() => cancelLimitOrder(order.id)} className="text-[#e5555a] hover:underline text-sm font-bold">Cancel</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-[#121a16] border border-[#22302a] rounded-xl shadow-lg flex flex-col">
        <div className="p-5 border-b border-[#22302a] flex justify-between items-center">
          <h2 className="text-lg font-bold">Trade Journal & History</h2>
          <div className="text-sm font-bold text-[#9aa6a0]">Total Realized: <span className={realizedPnl >= 0 ? 'text-[#2fd888]' : 'text-[#e5555a]'}>৳{realizedPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
        </div>
        <div className="p-0 overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#1a2420] text-[#9aa6a0] text-xs uppercase tracking-widest border-b border-[#22302a] sticky top-0">
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 font-semibold">Action</th>
                <th className="px-5 py-3 font-semibold">Ticker</th>
                <th className="px-5 py-3 font-semibold text-right">Qty @ Px</th>
                <th className="px-5 py-3 font-semibold text-right">Realized P&L</th>
                <th className="px-5 py-3 font-semibold">Journal Note</th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-5 py-8 text-center text-[#7d8a83] italic">No trades executed yet.</td>
                </tr>
              ) : (
                trades.map((t, i) => (
                  <tr key={i} className="border-b border-[#22302a] hover:bg-[#1a2420]">
                    <td className="px-5 py-4 text-sm text-[#9aa6a0] whitespace-nowrap">
                      {new Date(t.date).toLocaleString()}
                    </td>
                    <td className={`px-5 py-4 font-bold ${t.type === 'BUY' ? 'text-[#2fd888]' : 'text-[#e5555a]'}`}>{t.type}</td>
                    <td className="px-5 py-4 font-bold">{t.ticker}</td>
                    <td className="px-5 py-4 mono text-right">{t.qty} @ ৳{t.price.toFixed(1)}</td>
                    <td className={`px-5 py-4 mono font-bold text-right ${t.pnl > 0 ? 'text-[#2fd888]' : t.pnl < 0 ? 'text-[#e5555a]' : 'text-[#5f6b65]'}`}>
                      {t.type === 'SELL' ? `${t.pnl >= 0 ? '+' : ''}${t.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                    </td>
                    <td className="px-5 py-4 text-sm text-[#9aa6a0] max-w-xs truncate" title={t.note}>
                      {t.note || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

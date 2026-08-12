import React from 'react';
import { ArrowLeft, Scale, X, Activity, BarChart3, ShieldAlert } from 'lucide-react';
import { healthScore, scoreColor } from '../data/fundamentals';

export default function CompareView({ compareList = [], onRemove, allRows = [], livePrices = [] }) {
  if (compareList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-[#7d8a83]">
        <Scale size={48} className="mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-[#e9ede8] mb-2 font-['Instrument_Serif'] italic">No stocks selected</h2>
        <p className="text-sm max-w-md text-center">Add stocks to comparison from the Screener or Stock Detail pages.</p>
      </div>
    );
  }

  const data = compareList.map(ticker => {
    const row = allRows.find(r => r.ticker === ticker) || { ticker };
    const live = livePrices.find(p => p.ticker === ticker);
    const score = healthScore(row);
    // Since we don't have historical data loaded for everything in App (only in StockDetail),
    // we'll use a mocked signal here or minimal available signals.
    // To do this properly, we'd need history. But since we just want a unified Compare View:
    return {
      ticker,
      row,
      live,
      score
    };
  });

  return (
    <div className="p-6 custom-scrollbar text-[#e9ede8]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-['Instrument_Serif'] italic text-white flex items-center gap-3">
            <Scale className="text-[#c9a24b]" /> Side-by-Side Comparison
          </h1>
          <p className="text-[#9aa6a0] text-sm mt-1">{compareList.length} / 4 stocks selected</p>
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {data.map(item => (
            <div key={item.ticker} className="w-[300px] shrink-0 bg-[#121a16] border border-[#22302a] rounded-xl overflow-hidden shadow-lg flex flex-col">
              
              {/* Header */}
              <div className="p-5 border-b border-[#22302a] bg-[#1a2420] relative">
                <button 
                  onClick={() => onRemove(item.ticker)}
                  className="absolute top-4 right-4 text-[#7d8a83] hover:text-[#e5555a] transition-colors"
                >
                  <X size={16} />
                </button>
                <div className="font-bold text-2xl tracking-tight mb-1">{item.ticker}</div>
                <div className="text-xs text-[#9aa6a0] truncate pr-6">{item.row.name || 'Unknown Company'}</div>
                
                <div className="mt-4 flex items-end gap-2">
                  <div className="text-xl font-bold mono">
                    {item.live?.price?.toFixed(1) || item.row.ltp || '0.0'}
                  </div>
                  {item.row.change !== undefined && (
                    <div className={`text-sm font-bold mb-[2px] ${item.row.change >= 0 ? 'text-[#2fd888]' : 'text-[#e5555a]'}`}>
                      {item.row.change >= 0 ? '+' : ''}{item.row.change.toFixed(2)}%
                    </div>
                  )}
                </div>
              </div>

              {/* Health Score */}
              <div className="p-5 border-b border-[#22302a] flex items-center justify-between">
                <div className="flex items-center gap-2 mono text-[11px] uppercase tracking-widest text-[#7d8a83] font-bold">
                  <BarChart3 size={14} /> Health
                </div>
                <div className="text-2xl font-bold mono tracking-tight" style={{ color: scoreColor(item.score) }}>
                  {item.score}
                </div>
              </div>

              {/* Fundamentals */}
              <div className="p-5 border-b border-[#22302a] flex flex-col gap-3 mono text-[12px]">
                <div className="flex justify-between items-center text-[#9aa6a0]">
                  <span>ROE</span>
                  <span className="text-[#e9ede8] font-bold">{item.row.roe ? `${item.row.roe}%` : '—'}</span>
                </div>
                <div className="flex justify-between items-center text-[#9aa6a0]">
                  <span>Leverage (D/E)</span>
                  <span className="text-[#e9ede8] font-bold">{item.row.de ?? '—'}</span>
                </div>
                <div className="flex justify-between items-center text-[#9aa6a0]">
                  <span>EPS Grw</span>
                  <span className="text-[#e9ede8] font-bold">{item.row.epsGrowth ?? '—'}</span>
                </div>
                <div className="flex justify-between items-center text-[#9aa6a0]">
                  <span>NOCFPS</span>
                  <span className="text-[#e9ede8] font-bold">{item.row.nocfps ?? '—'}</span>
                </div>
              </div>

              {/* Tags */}
              <div className="p-5 flex gap-2 flex-wrap text-[10px] font-bold uppercase tracking-widest">
                <span className="bg-[#1a2420] text-[#9aa6a0] px-2 py-1 rounded border border-[#22302a]">
                  {item.row.sector || 'N/A'}
                </span>
                {item.row.isShariah !== false && (
                  <span className="bg-[#2fd88815] text-[#2fd888] px-2 py-1 rounded border border-[#1fae6b44]">
                    DSES / IBSL
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Add Placeholder */}
          {data.length < 4 && (
            <div className="w-[300px] shrink-0 border-2 border-dashed border-[#22302a] rounded-xl flex flex-col items-center justify-center text-[#5f6b65] hover:text-[#9aa6a0] hover:border-[#5f6b65] transition-colors cursor-default">
              <span className="text-sm font-bold uppercase tracking-widest">Available Slot</span>
              <span className="text-xs mt-2 opacity-60">Add from Screener</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

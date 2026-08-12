/**
 * SIP Orchestrator — Monthly Pick Agent
 * Coordinates Technical, Research, and Risk sub-agents to rank watchlist
 * tickers and decide which ones to buy this month.
 */

import { FUNDAMENTALS } from "../data/fundamentals.js";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Sub-agents ──────────────────────────────────────────────────────────────

function technicalAgent(ticker, livePrices, allStocks) {
  const row = allStocks?.find(s => s.ticker === ticker);
  const score = row?.score ?? 50;
  const changePct = row?.changePct ?? 0;

  let signal = "Neutral";
  let points = 0;
  let reasons = [];

  if (score >= 75) { signal = "Bullish"; points += 3; reasons.push(`Health score ${score}/100 — strong quality signal`); }
  else if (score >= 55) { signal = "Moderate"; points += 1; reasons.push(`Health score ${score}/100 — moderate signal`); }
  else { signal = "Weak"; points -= 1; reasons.push(`Health score ${score}/100 — below threshold`); }

  if (changePct > 0.5) { points += 1; reasons.push(`Up ${changePct.toFixed(2)}% today — positive momentum`); }
  else if (changePct < -2) { points -= 1; reasons.push(`Down ${Math.abs(changePct).toFixed(2)}% today — selling pressure`); }

  return { agent: "Technical Agent", signal, points, reasons };
}

function researchAgent(ticker) {
  const f = FUNDAMENTALS[ticker];
  if (!f) return { agent: "Research Agent", signal: "No Data", points: 0, reasons: ["No fundamental data available"] };

  const reasons = [];
  let points = 0;

  if (f.roe >= 20) { points += 3; reasons.push(`ROE ${f.roe}% — exceptional capital efficiency`); }
  else if (f.roe >= 12) { points += 1; reasons.push(`ROE ${f.roe}% — solid profitability`); }
  else { points -= 1; reasons.push(`ROE ${f.roe}% — below minimum threshold`); }

  if (f.de <= 0.5) { points += 2; reasons.push(`D/E ${f.de} — strong balance sheet with low leverage`); }
  else if (f.de <= 1.5) { points += 1; reasons.push(`D/E ${f.de} — manageable leverage`); }
  else { points -= 1; reasons.push(`D/E ${f.de} — elevated debt warrants caution`); }

  if (f.epsGrowth > 10) { points += 2; reasons.push(`EPS growth ${f.epsGrowth}% — accelerating earnings`); }
  else if (f.epsGrowth > 0) { points += 1; reasons.push(`EPS growth ${f.epsGrowth}% — positive trajectory`); }
  else { points -= 1; reasons.push(`EPS growth ${f.epsGrowth}% — earnings declining`); }

  if (f.nocfps > 0) { points += 1; reasons.push("Operating cash flow positive — earnings backed by real cash"); }

  const signal = points >= 5 ? "Strong Buy" : points >= 3 ? "Accumulate" : points >= 1 ? "Hold" : "Avoid";
  return { agent: "Research Agent", signal, points, reasons };
}

function riskAgent(ticker, holdings, livePrices) {
  const holding = holdings[ticker];
  const liveRow = livePrices?.find(p => p.ticker === ticker);
  const ltp = liveRow?.price ?? 0;

  const reasons = [];
  let points = 0;

  if (holding) {
    const marketVal = holding.qty * ltp;
    const pnlPct = ltp && holding.avgCost ? ((ltp - holding.avgCost) / holding.avgCost) * 100 : 0;

    if (pnlPct > 20) { points -= 1; reasons.push(`Already up ${pnlPct.toFixed(1)}% — reducing marginal priority vs fresh entries`); }
    else if (pnlPct < -15) { points += 1; reasons.push(`Down ${Math.abs(pnlPct).toFixed(1)}% from cost — averaging down opportunity`); }
    else { reasons.push(`P&L ${pnlPct.toFixed(1)}% — within normal range`); }

    if (marketVal > 10000) { points -= 1; reasons.push(`Position size ৳${marketVal.toFixed(0)} — already significant allocation`); }
  } else {
    points += 1;
    reasons.push("No existing position — fresh entry lowers concentration risk");
  }

  return { agent: "Risk Agent", points, reasons };
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export async function runSIPMonthlyPicks({ watchlist, holdings, livePrices, allStocks, onProgress }) {
  const results = [];

  for (let i = 0; i < watchlist.length; i++) {
    const ticker = watchlist[i];
    onProgress?.({ step: `Analysing ${ticker}... (${i + 1}/${watchlist.length})`, pct: Math.round(((i + 1) / watchlist.length) * 90) });
    await sleep(600); // Simulates per-agent reasoning delay

    const tech     = technicalAgent(ticker, livePrices, allStocks);
    const research = researchAgent(ticker);
    const risk     = riskAgent(ticker, holdings, livePrices);

    const totalScore = tech.points + research.points + risk.points;

    // Orchestrator decision
    let pick = false;
    let recommendation = "HOLD";
    let orchestratorReason = "";

    if (totalScore >= 6) {
      pick = true;
      recommendation = "PICK";
      orchestratorReason = "All three agents converge on a buy signal this month. Strong fundamentals, positive technicals, and manageable risk profile make this a high-conviction entry.";
    } else if (totalScore >= 3) {
      pick = true;
      recommendation = "PICK";
      orchestratorReason = "Moderate conviction — fundamentals or technicals are strong enough to warrant adding to position this month, though sizing should be conservative.";
    } else if (totalScore >= 1) {
      pick = false;
      recommendation = "HOLD";
      orchestratorReason = "Mixed signals across agents. The position can be held but no new capital is warranted this month — wait for clearer technical confirmation.";
    } else {
      pick = false;
      recommendation = "SKIP";
      orchestratorReason = "One or more agents raised red flags. Weak fundamentals, poor momentum, or risk concentration means capital is better deployed elsewhere this month.";
    }

    const liveRow = livePrices?.find(p => p.ticker === ticker);
    results.push({
      ticker,
      pick,
      recommendation,
      totalScore,
      ltp: liveRow?.price ?? 0,
      agents: [tech, research, risk],
      orchestratorReason,
    });
  }

  onProgress?.({ step: "Orchestrator ranking picks...", pct: 97 });
  await sleep(400);

  // Sort: PICK first (by score desc), then HOLD, then SKIP
  results.sort((a, b) => {
    const orderA = a.recommendation === "PICK" ? 0 : a.recommendation === "HOLD" ? 1 : 2;
    const orderB = b.recommendation === "PICK" ? 0 : b.recommendation === "HOLD" ? 1 : 2;
    return orderA - orderB || b.totalScore - a.totalScore;
  });

  onProgress?.({ step: "Done.", pct: 100 });
  return results;
}

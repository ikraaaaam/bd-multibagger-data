// Mock AI Agent Service
// In a real app, this would hit the Claude API endpoint.

const CACHE_PREFIX = "multibagger:ai:cache:";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Orchestrator routes the request and invokes the appropriate sub-agent
export async function getAIInsight(ticker, intent, fundamentalData, technicalData) {
  const cacheKey = `${CACHE_PREFIX}${ticker}:${intent}`;
  
  // 1. Check Cache
  const cachedStr = window.localStorage.getItem(cacheKey);
  if (cachedStr) {
    try {
      const cached = JSON.parse(cachedStr);
      // Rules: Regenerate if > 24 hours old or score changed significantly.
      const now = Date.now();
      const age = now - cached.timestamp;
      if (age < 24 * 60 * 60 * 1000) {
        return cached.data;
      }
    } catch (e) {
      console.warn("Cache corrupted for", cacheKey);
    }
  }

  // 2. Fetch from Agent (Mocking the delay and response)
  await sleep(1500); // Simulate network latency

  let response = {};

  switch (intent) {
    case 'news':
      response = simulateNewsAgent(ticker);
      break;
    case 'research':
      response = simulateResearchAgent(ticker, fundamentalData);
      break;
    case 'technical':
      response = simulateTechnicalAgent(ticker, technicalData);
      break;
    case 'risk':
      response = simulateRiskAgent(ticker, technicalData);
      break;
    default:
      response = { text: "Unknown intent.", agent: "System" };
  }

  // 3. Save to Cache
  window.localStorage.setItem(cacheKey, JSON.stringify({
    timestamp: Date.now(),
    data: response
  }));

  return response;
}

function simulateNewsAgent(ticker) {
  return { 
    text: `Recent corporate announcements for ${ticker} show standard quarterly disclosures with no major red flags or unscheduled price-sensitive information released in the past 14 days.`, 
    agent: "News Agent" 
  };
}

function simulateResearchAgent(ticker, fund) {
  const roe = fund?.roe || 0;
  let text = `Based on long-term fundamentals, ${ticker} shows `;
  if (roe > 20) text += "strong profitability with a healthy return on equity. ";
  else if (roe > 10) text += "moderate profitability. ";
  else text += "sub-optimal return on equity. ";
  
  if (fund?.de < 1) text += "The balance sheet is unlevered, reducing long-term financial risk.";
  else text += "Leverage is somewhat elevated, requiring careful monitoring of interest coverage.";

  return { text, agent: "Research Agent" };
}

function simulateTechnicalAgent(ticker, tech) {
  const mom = tech?.momentumLabel || 'Neutral';
  let text = `Short-term signals point to a ${mom.toLowerCase()} momentum phase. `;
  
  if (tech?.maCross > 0) text += "The fast moving average has crossed above the slow, confirming an upward trend. ";
  else if (tech?.maCross < 0) text += "Moving averages indicate downward pressure. ";

  if (tech?.volRatio > 1.5) text += "Recent volume is abnormally high, suggesting institutional interest or capitulation.";
  
  return { text, agent: "Technical Agent" };
}

function simulateRiskAgent(ticker, tech) {
  const vol = tech?.volatilityLabel || 'Normal';
  let text = `Volatility is currently ${vol.toLowerCase()}. `;
  
  if (vol === 'Elevated') text += "Position sizes should be reduced to account for wider true ranges.";
  else if (vol === 'Compressed') text += "Price is consolidating; expect an imminent breakout. Normal position sizing applies.";
  else text += "Standard position sizing is recommended.";

  return { text, agent: "Risk Agent" };
}

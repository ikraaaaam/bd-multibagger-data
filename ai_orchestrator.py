import os
import json
import re
import datetime
import traceback
import urllib.request
import urllib.parse
import time

try:
    import google.generativeai as genai
    has_gemini = True
except ImportError:
    has_gemini = False

try:
    import groq
    has_groq = True
except ImportError:
    has_groq = False

from dotenv import load_dotenv

load_dotenv()

def send_telegram_message(text):
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        print("Telegram credentials missing, skipping notification.")
        return
    
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = urllib.parse.urlencode({"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}).encode("utf-8")
    try:
        req = urllib.request.Request(url, data=data)
        with urllib.request.urlopen(req) as response:
            res = response.read()
            print("Telegram message sent successfully.")
    except Exception as e:
        print(f"Failed to send Telegram message: {e}")

def call_llm(prompt):
    # Throttle to avoid free tier rate limits (15 RPM for Gemini Flash)
    time.sleep(4)
    
    gemini_key = os.environ.get("GEMINI_API_KEY")
    groq_key = os.environ.get("GROQ_API_KEY")

    if has_gemini and gemini_key and gemini_key != "your_gemini_api_key_here":
        try:
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            print(f"Gemini failed: {e}. Falling back to Groq...")

    if has_groq and groq_key and groq_key != "your_groq_api_key_here":
        try:
            client = groq.Groq(api_key=groq_key)
            chat_completion = client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama3-70b-8192",
            )
            return chat_completion.choices[0].message.content
        except Exception as e:
            print(f"Groq failed: {e}")
            raise Exception("Both Gemini and Groq failed or keys are missing.")

    raise Exception("No valid API keys found for Gemini or Groq.")

def load_data():
    with open("data/watchlist.json", "r", encoding="utf-8") as f:
        watchlist = json.load(f)
    
    with open("data/prices.json", "r", encoding="utf-8") as f:
        prices = json.load(f)["prices"]
        
    try:
        with open("data/research_log.json", "r", encoding="utf-8") as f:
            logs = json.load(f)
    except Exception:
        logs = {}
        
    try:
        with open("data/budget.json", "r", encoding="utf-8") as f:
            budget = json.load(f)
    except Exception:
        budget = {"monthly_budget": 8000, "carry_forward": 0}
        
    with open("frontend/src/data/fundamentals.js", "r", encoding="utf-8") as f:
        f_text = f.read()
    
    match = re.search(r'export const FUNDAMENTALS = (\{.*?\});', f_text, re.DOTALL)
    obj_str = match.group(1) if match else "No fundamentals found."

    return watchlist, prices, logs, budget, obj_str

def quant_signal_engine(ticker, prices):
    """Pure deterministic code, no LLM. Outputs math signals."""
    ltp = prices.get(ticker, {}).get("LTP", 0)
    ycp = prices.get(ticker, {}).get("YCP", 0)
    vol = prices.get(ticker, {}).get("Volume", 0)
    
    change_pct = 0
    if ltp and ycp and ycp > 0:
        change_pct = round(((ltp - ycp) / ycp) * 100, 2)
        
    return {
        "ltp": ltp,
        "ycp": ycp,
        "change_pct": change_pct,
        "volume": vol,
        "momentum": "Positive" if change_pct > 0 else "Negative" if change_pct < 0 else "Neutral",
        "volatility_class": "High" if abs(change_pct) > 2.0 else "Low"
    }

def news_agent(ticker, logs):
    ticker_news = []
    for date_str, daily_logs in logs.items():
        if ticker in daily_logs:
            ticker_news.append(f"[{date_str}]: {daily_logs[ticker]}")
    compiled_news = "\n".join(ticker_news) if ticker_news else "No recent news."
    
    prompt = f"Summarize these raw news clippings for {ticker} into a clean 2-sentence narrative focused on corporate announcements. Ignore noise.\n\n{compiled_news}"
    return call_llm(prompt).strip()

def research_agent(ticker, fundamentals_str):
    prompt = f"You are a fundamental analyst. Read the JSON DB for {ticker}: \n{fundamentals_str}\n\nProvide a grounded long-term fundamental narrative (2 sentences). Only use data from the snippet, do not invent numbers. Mention ROE and Debt."
    return call_llm(prompt).strip()

def technical_agent(ticker, quant_signals):
    prompt = f"You are a Technical/Quant Agent. The Quant Engine outputs for {ticker} are: {json.dumps(quant_signals)}. Narrate this in plain language in 2 sentences. E.g., mention momentum or volatility."
    return call_llm(prompt).strip()

def risk_agent(ticker, quant_signals, budget):
    prompt = f"You are a Risk Agent. {ticker} LTP is {quant_signals['ltp']}. Our total SIP budget is {budget['monthly_budget'] + budget['carry_forward']}. Provide a 2-sentence volatility-adjusted position sizing context. Should we buy in bulk, accumulate slowly, or avoid due to volatility?"
    return call_llm(prompt).strip()

def orchestrator_agent(all_narratives, budget):
    total_budget = budget.get("monthly_budget", 8000) + budget.get("carry_forward", 0)
    
    prompt = f"""
You are the Orchestrator (Chief Investment Officer) of a Multi-Agent system.
Total Budget: ৳{total_budget}

Here are the distinct agent narratives for the watchlist:
{json.dumps(all_narratives, indent=2)}

Decide EXACTLY how many shares of which stocks to buy this month to maximize long-term compounding, keeping total cost under ৳{total_budget}. Unspent money becomes carry forward.
Provide a final, reasoned JSON output.

OUTPUT STRICTLY IN JSON FORMAT:
{{
  "allocations": [
    {{"ticker": "TICKER", "qty": 10, "price": 250, "total": 2500, "reason": "Why this specific allocation was chosen."}}
  ],
  "totalSpent": 2500,
  "carryForward": 5500,
  "summary": "Short 2 sentence reasoning for the entire portfolio allocation."
}}
"""
    resp_text = call_llm(prompt).replace('```json', '').replace('```', '').strip()
    return json.loads(resp_text)

def generate_report():
    watchlist, prices, logs, budget, fundamentals_str = load_data()
    total_budget = budget.get("monthly_budget", 8000) + budget.get("carry_forward", 0)
    
    markdown_report = f"# SIP Portfolio AI Monthly Report - {datetime.date.today().strftime('%B %Y')}\n\n"
    markdown_report += f"**Total Budget Available:** ৳{total_budget}\n\n"
    markdown_report += "*Generated by True Multi-Agent AI Architecture (Orchestrator, News, Research, Tech, Risk)*\n\n"
    markdown_report += "> *Not financial advice, verify independently.*\n\n"

    all_narratives = {}
    frontend_json = []

    print("Starting Multi-Agent evaluation...")
    for ticker in watchlist:
        print(f"\nEvaluating {ticker}...")
        try:
            # 1. Quant Signal Engine (Deterministic)
            quant_signals = quant_signal_engine(ticker, prices)
            
            # 2. News Agent
            print(f"  -> News Agent...")
            news_narr = news_agent(ticker, logs)
            
            # 3. Research Agent
            print(f"  -> Research Agent...")
            research_narr = research_agent(ticker, fundamentals_str)
            
            # 4. Technical/Quant Agent
            print(f"  -> Technical Agent...")
            tech_narr = technical_agent(ticker, quant_signals)
            
            # 5. Risk Agent
            print(f"  -> Risk Agent...")
            risk_narr = risk_agent(ticker, quant_signals, budget)
            
            all_narratives[ticker] = {
                "ltp": quant_signals["ltp"],
                "news": news_narr,
                "research": research_narr,
                "technical": tech_narr,
                "risk": risk_narr
            }
            
            markdown_report += f"## {ticker} (LTP: ৳{quant_signals['ltp']})\n"
            markdown_report += f"**📰 News Agent:** {news_narr}\n\n"
            markdown_report += f"**📊 Research Agent:** {research_narr}\n\n"
            markdown_report += f"**📈 Technical Agent:** {tech_narr}\n\n"
            markdown_report += f"**🛡️ Risk Agent:** {risk_narr}\n\n"
            markdown_report += "---\n\n"
            
            # Temporarily store for frontend JSON
            frontend_json.append({
                "ticker": ticker,
                "ltp": quant_signals["ltp"],
                "agents": [
                    {"agent": "News Agent", "reasons": [news_narr], "points": 0},
                    {"agent": "Research Agent", "reasons": [research_narr], "points": 0},
                    {"agent": "Technical Agent", "reasons": [tech_narr], "points": 0},
                    {"agent": "Risk Agent", "reasons": [risk_narr], "points": 0}
                ]
            })
            
        except Exception as e:
            print(f"Error evaluating {ticker}: {e}")
            traceback.print_exc()

    print("\nTriggering Orchestrator...")
    try:
        final_alloc = orchestrator_agent(all_narratives, budget)
        
        # Prepend Final Allocation to Markdown
        alloc_md = f"# 🎯 Orchestrator Final Allocation\n\n> {final_alloc['summary']}\n\n"
        alloc_md += "### Purchases:\n"
        for item in final_alloc['allocations']:
            alloc_md += f"- **{item['ticker']}**: {item['qty']} shares @ ৳{item['price']} = ৳{item['total']} *(Reason: {item.get('reason', '')})*\n"
        alloc_md += f"\n**Total Spent:** ৳{final_alloc['totalSpent']}\n"
        alloc_md += f"**New Carry Forward:** ৳{final_alloc['carryForward']}\n\n---\n\n"
        
        markdown_report = alloc_md + markdown_report
        
        # update budget.json
        budget["carry_forward"] = final_alloc["carryForward"]
        with open("data/budget.json", "w", encoding="utf-8") as f:
            json.dump(budget, f, indent=2)
            
        # Send Telegram notification
        telegram_text = f"🤖 *Multi-Agent Monthly Allocation*\n\n"
        for item in final_alloc['allocations']:
            telegram_text += f"- {item['ticker']}: {item['qty']} shares @ ৳{item['price']} (৳{item['total']})\n"
        telegram_text += f"\n💰 *Total Spent:* ৳{final_alloc['totalSpent']}\n"
        telegram_text += f"💼 *Carry Forward:* ৳{final_alloc['carryForward']}\n"
        telegram_text += f"📝 *Reasoning:* {final_alloc['summary']}\n\n⚠️ *Not financial advice.*\n[View Full Report](https://github.com/ikraaaaam/bd-multibagger-data/blob/main/data/latest_picks.md)"
        
        send_telegram_message(telegram_text)
        
        # Update frontend JSON with pick status
        for f_item in frontend_json:
            is_picked = any(a["ticker"] == f_item["ticker"] for a in final_alloc.get("allocations", []))
            f_item["pick"] = is_picked
            f_item["recommendation"] = "PICK" if is_picked else "SKIP"
            
            alloc_reason = next((a.get("reason", "") for a in final_alloc.get("allocations", []) if a["ticker"] == f_item["ticker"]), "Not selected by Orchestrator.")
            f_item["orchestratorReason"] = alloc_reason
            f_item["totalScore"] = 10 if is_picked else 0
            
    except Exception as e:
        print(f"Error in allocation phase: {e}")
        
    with open("data/latest_picks.md", "w", encoding="utf-8") as f:
        f.write(markdown_report)
        
    with open("data/latest_picks.json", "w", encoding="utf-8") as f:
        json.dump(frontend_json, f, indent=2)

if __name__ == "__main__":
    generate_report()

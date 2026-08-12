import json
import datetime
import os
try:
    from duckduckgo_search import DDGS
    has_ddgs = True
except ImportError:
    has_ddgs = False

def fetch_news(ticker):
    print(f"Fetching news for {ticker}...")
    if not has_ddgs:
        return "News fetching skipped (duckduckgo_search not installed)."
    try:
        results = DDGS().text(f"{ticker} stock news Bangladesh OR Dhaka Stock Exchange", max_results=3)
        if not results:
            return "No recent news found."
        news_text = ""
        for r in results:
            news_text += f"- {r.get('title')}: {r.get('body')}\n"
        return news_text
    except Exception as e:
        return f"Error fetching news: {e}"

def run_research():
    with open("data/watchlist.json", "r", encoding="utf-8") as f:
        watchlist = json.load(f)
    
    log_file = "data/research_log.json"
    if os.path.exists(log_file):
        with open(log_file, "r", encoding="utf-8") as f:
            logs = json.load(f)
    else:
        logs = {}
        
    date_str = datetime.date.today().isoformat()
    if date_str not in logs:
        logs[date_str] = {}

    for ticker in watchlist:
        news = fetch_news(ticker)
        logs[date_str][ticker] = news
        
    # keep only last 30 entries
    if len(logs) > 30:
        keys_to_delete = sorted(logs.keys())[:-30]
        for k in keys_to_delete:
            del logs[k]
            
    with open(log_file, "w", encoding="utf-8") as f:
        json.dump(logs, f, indent=2)
        
    print(f"Saved research log to {log_file}")

if __name__ == "__main__":
    run_research()

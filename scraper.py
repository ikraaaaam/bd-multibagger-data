"""
BD Multibagger AI — Data Pipeline
Phase 01: scrapes DSE price + index data, writes JSON files for the app to fetch.

Runs on a schedule via GitHub Actions (see .github/workflows/scrape.yml).
No API key, no server, no cost — this script is the entire "backend."

Data sources:
  - bdshare (pip package): live prices, historical prices, P/E — wraps dsebd.org
  - Direct scrape of dsebd.org index pages: DS30 / DSES constituent lists
    (bdshare does not expose index membership directly, only price data)

Outputs (written to ./data/):
  - market-status.json     current DSE market status
  - index-ds30.json         DS30 constituent tickers (Tier 1, blue-chip)
  - index-dses.json         DSES constituent tickers (Shariah compliance gate)
  - prices.json             live prices for the full watchlist (Tier 1+2+3)
  - watchlist.json          the curated Tier 2 / Tier 3 ticker list (edit this file directly)
  - history/{TICKER}.json   appended once/day by the EOD job (see --mode eod)
"""

import json
import os
import sys
import argparse
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

import bdshare

DATA_DIR = Path(__file__).parent / "data"
HISTORY_DIR = DATA_DIR / "history"

# ---------------------------------------------------------------------------
# Curated watchlist — Tier 1 (Large Cap supplements), Tier 2 (Midcap), Tier 3 (Small-cap).
# Most Tier 1 (blue-chip) stocks are pulled live from the official DS30 index below, 
# but you can forcefully include other large caps here if they are missing from the index.
# ---------------------------------------------------------------------------
WATCHLIST_TIER1_LARGECAP = [
    "BERGERPBL",   # Berger Paints BD
    "MARICO",      # Marico Bangladesh
]

WATCHLIST_TIER2_MIDCAP = [
    "IPDC",        # IPDC Finance
    "GENEXIL",     # Genex Infosys
    "ALIF",        # Alif Industries
    "DOMINAGE",    # Dominage Steel
    "SUNLIFEINS",  # Sunlife Insurance
    "RUPALILIFE",  # Rupali Life Insurance
    "PUBALIBANK",  # Pubali Bank
    "CITYGENINS",  # City General Insurance
]

WATCHLIST_TIER3_SMALLCAP = [
    "LOVELLO",     # Lavello Ice-cream
    "GQBALLPEN",   # GQ Ball Pen
    "PEOPLESINS",  # Peoples Insurance
]

# NOTE: verify these exact DSE trading codes against dsebd.org before first run —
# tickers above are best-effort from public news coverage, not a live pull.


def ensure_dirs():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)


def write_json(filename, payload):
    path = DATA_DIR / filename
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"  wrote {path} ({len(json.dumps(payload))} bytes)")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Market status — used to skip scraping entirely when the market is closed,
# so scheduled runs outside trading hours don't waste GitHub Actions minutes
# or hammer dsebd.org for nothing.
# ---------------------------------------------------------------------------
def fetch_market_status():
    try:
        status = bdshare.get_market_status()
        return str(status)
    except Exception as e:
        print(f"  [warn] could not fetch market status: {e}")
        return "unknown"


# ---------------------------------------------------------------------------
# Index constituents — bdshare doesn't expose these, so this scrapes the
# DSE index pages directly. Both pages are simple HTML tables.
# ---------------------------------------------------------------------------
def scrape_index_constituents(url, label):
    headers = {"User-Agent": "Mozilla/5.0 (compatible; bd-multibagger-pipeline/1.0)"}
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    try:
        resp = requests.get(url, headers=headers, timeout=20, verify=False)
        resp.raise_for_status()
    except Exception as e:
        print(f"  [error] fetching {label} from {url}: {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    tickers = []

    # DSE listing tables use a consistent structure: rows with a trading-code
    # link as the first cell. This selector is intentionally loose — dsebd.org
    # markup shifts occasionally, so we grab any table cell that looks like a
    # plausible trading code (short, alphanumeric, contains a letter) rather
    # than relying on a brittle class name that may change.
    for row in soup.select("table tr"):
        cells = row.find_all("td")
        if not cells:
            continue
        
        # DSE sometimes puts a serial number in cell 0, so check the first two cells
        ticker_cand = None
        for cell in cells[:2]:
            text = cell.get_text(strip=True)
            looks_like = (
                text
                and 1 < len(text) <= 15
                and " " not in text
                and text.replace(".", "").isalnum()
                and any(c.isalpha() for c in text)
            )
            if looks_like:
                ticker_cand = text
                break
        
        if ticker_cand:
            tickers.append(ticker_cand)

    tickers = sorted(set(tickers))
    print(f"  {label}: found {len(tickers)} tickers")
    return tickers


def fetch_ds30_constituents():
    # Verify this URL still resolves before relying on it — dsebd.org page
    # slugs have changed before. Confirmed reachable as of the last check:
    # https://dsebd.org/dse30_share.php
    return scrape_index_constituents("https://dsebd.org/dse30_share.php", "DS30")


def fetch_dses_constituents():
    # NOT independently verified — dsebd.org's DSES-specific listing page
    # slug wasn't confirmed at build time (this sandbox can't reach dsebd.org
    # to test). Try this first; if it 404s, check dsebd.org's own nav for the
    # correct "DSES" link and update this URL — the scrape_index_constituents()
    # parser itself doesn't need to change, only the URL.
    return scrape_index_constituents("https://dsebd.org/dsesh_share.php", "DSES")


# ---------------------------------------------------------------------------
# Prices — via bdshare, for the full watchlist (Tier 1 DS30 + curated Tier 2/3)
# ---------------------------------------------------------------------------
def fetch_prices(tickers):
    prices = {}
    try:
        df = bdshare.get_current_trade_data()
    except Exception as e:
        print(f"  [error] get_current_trade_data failed: {e}")
        return prices

    if df is None or df.empty:
        print("  [warn] empty price dataframe returned")
        return prices

    df.columns = [str(c).strip().upper() for c in df.columns]
    symbol_col = next((c for c in df.columns if "SYMBOL" in c or "TRADING" in c or c == "CODE"), None)
    if symbol_col is None:
        print(f"  [warn] could not find symbol column in {list(df.columns)}")
        return prices

    wanted = set(tickers)
    for _, row in df.iterrows():
        sym = str(row[symbol_col]).strip()
        if wanted and sym not in wanted:
            continue
        prices[sym] = {k: (None if pd_isna(v) else v) for k, v in row.to_dict().items()}

    print(f"  matched prices for {len(prices)}/{len(tickers)} watchlist tickers")
    return prices


def pd_isna(v):
    try:
        import pandas as pd
        return pd.isna(v)
    except Exception:
        return v is None


# ---------------------------------------------------------------------------
# EOD history append — run once/day after DSE's official close settles
# ---------------------------------------------------------------------------
def append_eod_history(tickers):
    today = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d")
    for ticker in tickers:
        try:
            df = bdshare.get_hist_data(code=ticker)
        except Exception as e:
            print(f"  [warn] history fetch failed for {ticker}: {e}")
            continue
        if df is None or df.empty:
            continue

        row = df.iloc[0].to_dict()
        entry = {"date": today, **{k: (None if pd_isna(v) else v) for k, v in row.items()}}

        hist_path = HISTORY_DIR / f"{ticker}.json"
        existing = []
        if hist_path.exists():
            with open(hist_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
        if not existing or existing[-1].get("date") != today:
            existing.append(entry)
            with open(hist_path, "w", encoding="utf-8") as f:
                json.dump(existing, f, ensure_ascii=False, indent=2)
            print(f"  appended EOD row for {ticker}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["live", "eod"], default="live",
                         help="live = intraday price snapshot; eod = daily history append")
    args = parser.parse_args()

    ensure_dirs()

    print("== market status ==")
    status = fetch_market_status()
    write_json("market-status.json", {"status": status, "checked_at": now_iso()})

    if args.mode == "live" and status.lower() not in ("open", "unknown"):
        print(f"Market status is '{status}' — skipping live scrape to save the run.")
        return

    print("== index constituents ==")
    ds30 = fetch_ds30_constituents()
    dses = fetch_dses_constituents()
    write_json("index-ds30.json", {"updated_at": now_iso(), "constituents": ds30})
    write_json("index-dses.json", {"updated_at": now_iso(), "constituents": dses})

    tier1_combined = sorted(set(ds30) | set(WATCHLIST_TIER1_LARGECAP))
    watchlist = sorted(set(tier1_combined) | set(WATCHLIST_TIER2_MIDCAP) | set(WATCHLIST_TIER3_SMALLCAP))
    write_json("watchlist.json", {
        "updated_at": now_iso(),
        "tier1_ds30": tier1_combined,
        "tier2_midcap": WATCHLIST_TIER2_MIDCAP,
        "tier3_smallcap": WATCHLIST_TIER3_SMALLCAP,
        "combined": watchlist,
    })

    if args.mode == "live":
        print("== prices ==")
        prices = fetch_prices(watchlist)
        write_json("prices.json", {"updated_at": now_iso(), "prices": prices})

    if args.mode == "eod":
        print("== EOD history append ==")
        append_eod_history(watchlist)

    print("Done.")


if __name__ == "__main__":
    sys.exit(main())

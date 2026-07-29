import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
import time
import argparse

import bdshare

DATA_DIR = Path(__file__).parent / "data"
HISTORY_DIR = DATA_DIR / "history"

def pd_isna(v):
    try:
        import pandas as pd
        return pd.isna(v)
    except Exception:
        return v is None

def backfill_ticker(ticker, end_date):
    hist_path = HISTORY_DIR / f"{ticker}.json"
    
    if not hist_path.exists():
        print(f"Skipping {ticker} - no existing history file found.")
        return
        
    with open(hist_path, "r", encoding="utf-8") as f:
        existing_data = json.load(f)
        
    if not existing_data:
        print(f"Skipping {ticker} - history file is empty.")
        return
        
    # Get the last recorded date in the file
    last_date = existing_data[-1]["date"]
    
    if last_date >= end_date:
        print(f"{ticker} is already up to date ({last_date}).")
        return
        
    print(f"Backfilling {ticker} from {last_date} to {end_date}...")
    
    try:
        # fetch data from bdshare
        df = bdshare.get_historical_data(start=last_date, end=end_date, code=ticker)
    except Exception as e:
        print(f"  [ERROR] bdshare fetch failed for {ticker}: {e}")
        return
        
    if df is None or df.empty:
        print(f"  No new data found for {ticker} in this range.")
        return
        
    # bdshare returns data in descending date order (newest first). 
    # we need ascending order (oldest first).
    df = df.iloc[::-1]
    
    appended_count = 0
    
    for _, row in df.iterrows():
        # Ensure row keys are strings and uppercase
        row_dict = {str(k).strip().upper(): v for k, v in row.to_dict().items()}
        
        # Date comes from the index or 'DATE' column depending on bdshare version
        date_str = str(row.name).split()[0] if not pd_isna(row.name) else None
        if 'DATE' in row_dict:
            date_str = str(row_dict['DATE']).split()[0]
            
        if not date_str or date_str <= last_date:
            continue
            
        def safe_float(keys, default=0.0):
            for k in keys:
                if k in row_dict and not pd_isna(row_dict[k]):
                    try:
                        val_str = str(row_dict[k]).replace(',', '')
                        # Sometimes bdshare returns '--' for missing values
                        if val_str.strip() == '--':
                            return default
                        return float(val_str)
                    except (ValueError, TypeError):
                        pass
            return default

        entry = {
            "date": date_str,
            "open": safe_float(['OPEN_P', 'OPEN']),
            "high": safe_float(['HIGH']),
            "low": safe_float(['LOW']),
            "close": safe_float(['CLOSE_P', 'CLOSE', 'LTP']),
            "volume": safe_float(['VOLUME', 'VOL', 'TRADE'])
        }
        
        existing_data.append(entry)
        appended_count += 1
        
    if appended_count > 0:
        with open(hist_path, "w", encoding="utf-8") as f:
            json.dump(existing_data, f, ensure_ascii=False, indent=2)
        print(f"  -> Appended {appended_count} new days to {ticker}.")
    else:
        print(f"  -> No new days to append for {ticker}.")


def main():
    parser = argparse.ArgumentParser(description="Backfill missing data up to today using bdshare")
    parser.add_argument("--ticker", type=str, help="Backfill a specific ticker (e.g. SQURPHARMA)")
    args = parser.parse_args()
    
    today = datetime.now().strftime("%Y-%m-%d")
    print(f"Starting backfill process. Target date: {today}")
    
    if args.ticker:
        backfill_ticker(args.ticker.upper(), today)
    else:
        # process all JSON files in the history directory
        files = list(HISTORY_DIR.glob("*.json"))
        print(f"Found {len(files)} history files to process.")
        
        for i, file_path in enumerate(files):
            ticker = file_path.stem.upper()
            backfill_ticker(ticker, today)
            
            # pause slightly to avoid hammering the DSE server
            if i < len(files) - 1:
                time.sleep(0.5)

if __name__ == "__main__":
    main()

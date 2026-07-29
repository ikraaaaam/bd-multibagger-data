import os
import glob
import json
import argparse
from pathlib import Path
import pandas as pd

def process_mendeley_data(input_dir, output_dir):
    """
    Reads all CSVs in input_dir, normalizes columns to [date, open, high, low, close, volume],
    groups by ticker, sorts chronologically, and writes out JSON files to output_dir.
    """
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    csv_files = glob.glob(str(input_path / "**/*.csv"), recursive=True)
    if not csv_files:
        print(f"No CSV files found in {input_dir}")
        return

    # To handle massive datasets without blowing up memory, we'll process 
    # file by file and append to a dictionary or local temporary SQLite, 
    # but since it's only ~25 years of daily data (~3M rows), pandas can handle it in RAM.
    
    all_data = []
    
    for file in csv_files:
        print(f"Reading {file}...")
        try:
            df = pd.read_csv(file, low_memory=False)
            
            # Normalize column names
            df.columns = [str(c).strip().lower() for c in df.columns]
            
            # Identify columns
            col_map = {}
            for col in df.columns:
                if 'date' in col or 'time' in col: col_map['date'] = col
                elif 'ticker' in col or 'symbol' in col or 'code' in col: col_map['ticker'] = col
                elif 'open' in col: col_map['open'] = col
                elif 'high' in col: col_map['high'] = col
                elif 'low' in col: col_map['low'] = col
                elif 'close' in col or 'ltp' in col: col_map['close'] = col
                elif 'volume' in col or 'vol' in col or 'trade' in col: col_map['volume'] = col
            
            if 'ticker' not in col_map:
                df['ticker'] = Path(file).stem.upper()
                col_map['ticker'] = 'ticker'

            if 'date' not in col_map:
                print(f"  Skipping {file}: Could not find 'date' column. Found: {df.columns}")
                continue
            
            # Rename columns to standard names
            rename_dict = {v: k for k, v in col_map.items()}
            df = df.rename(columns=rename_dict)
            
            # Keep only needed columns
            needed_cols = ['date', 'ticker']
            for c in ['open', 'high', 'low', 'close', 'volume']:
                if c in df.columns:
                    needed_cols.append(c)
                else:
                    df[c] = 0 # Default to 0 if missing
                    needed_cols.append(c)
            
            df = df[needed_cols]
            
            # Ensure proper types
            df['date'] = pd.to_datetime(df['date'], errors='coerce').dt.strftime('%Y-%m-%d')
            for c in ['open', 'high', 'low', 'close', 'volume']:
                df[c] = pd.to_numeric(df[c], errors='coerce').fillna(0)
                
            df = df.dropna(subset=['date', 'ticker'])
            all_data.append(df)
            
        except Exception as e:
            print(f"  Error processing {file}: {e}")

    if not all_data:
        print("No valid data was parsed.")
        return

    print("Concatenating all data...")
    combined_df = pd.concat(all_data, ignore_index=True)
    
    print("Sorting and grouping by ticker...")
    combined_df = combined_df.sort_values(by=['ticker', 'date'])
    combined_df = combined_df.drop_duplicates(subset=['ticker', 'date'], keep='last')
    
    grouped = combined_df.groupby('ticker')
    
    print(f"Writing {len(grouped)} JSON files to {output_dir}...")
    for ticker, group in grouped:
        ticker = str(ticker).strip().upper()
        # Drop the ticker column for the JSON
        records = group.drop(columns=['ticker']).to_dict(orient='records')
        
        json_path = output_path / f"{ticker}.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(records, f, separators=(',', ':')) # Minified JSON
            
    print("Done!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process Mendeley DSE CSV Data into JSONs")
    parser.add_argument("--input", required=True, help="Directory containing the Mendeley CSV files")
    parser.add_argument("--output", default="data/history", help="Directory to save the JSON files")
    
    args = parser.parse_args()
    process_mendeley_data(args.input, args.output)

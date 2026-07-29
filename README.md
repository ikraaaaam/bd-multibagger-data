# BD Multibagger AI — Data Pipeline (Phase 01)

Free, serverless DSE data pipeline. GitHub Actions scrapes on a schedule,
commits JSON to this repo, and the app fetches it via `raw.githubusercontent.com`.
No database, no server, no API key, no cost.

## Setup

1. Create a **public** GitHub repo (public keeps raw.githubusercontent.com fetches
   free and simple — see the architecture doc for the private-repo tradeoff).
2. Push these files to it, preserving the folder structure:
   ```
   scraper.py
   requirements.txt
   .github/workflows/scrape.yml
   data/            (created automatically on first run)
   ```
3. Go to the repo's **Actions** tab → enable workflows if prompted.
4. Trigger it once manually: Actions → "BD Multibagger AI — Data Pipeline" →
   **Run workflow**. This does the first data pull without waiting for the
   schedule, so you can confirm it works.
5. Once `data/*.json` shows up in the repo, your app can fetch e.g.:
   ```
   https://raw.githubusercontent.com/{your-username}/{your-repo}/main/data/prices.json
   ```

## ⚠️ Verify before relying on this

Two things in `scraper.py` were built without live access to dsebd.org from
this environment, and need a one-time check on your end after the first run:

1. **`fetch_dses_constituents()` URL** — points at
   `https://dsebd.org/dsesh_share.php`, which was not independently confirmed.
   The DS30 URL (`dse30_share.php`) *was* confirmed via search. If the DSES
   job returns an empty list, check dsebd.org's own navigation for the
   correct "DSES" link and update that one URL — the parsing logic
   underneath doesn't need to change.
2. **Tier 2/3 watchlist trading codes** — `IPDC`, `GENEXIL`, `ALIF`,
   `DOMINAGE`, `SUNLIFEINS`, `RUPALILIFE`, `PUBALIBANK`, `CITYGENINS`,
   `LAVELLO`, `GQBALLPEN`, `PEOPLESINS` are best-effort trading codes from
   public news coverage, not a live pull. Cross-check these against
   `dsebd.org/company_listing.php` and fix any that don't match — the
   scraper will just silently return no price data for a wrong code rather
   than erroring, so this is worth checking once up front.

## What runs when

- **Every 10 min, 10:00–14:30 BDT, Sun–Thu** → live price snapshot
  (`data/prices.json`, `data/index-*.json`)
- **Once daily, 15:30 BDT, Sun–Thu** → EOD history append
  (`data/history/{TICKER}.json`)
- The live job checks `get_market_status()` first and skips the scrape
  entirely if the market isn't open — this is what keeps GitHub Actions
  minutes usage low even on holidays.

## Free tier math

GitHub Actions free tier: ~2,000 minutes/month. Market hours are ~4.5
hrs/day × 5 days/week ≈ 90 hrs/month of eligible window, polled every 10
min ≈ 27 runs/day, each run well under a minute → comfortably inside the
free tier with room to spare.

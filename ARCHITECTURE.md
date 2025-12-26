# System Architecture: Web Scraper with Logging

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     START: batch_scrape.js                       │
│                                                                   │
│  1. Write PID to worker_pid.txt                                  │
│  2. Log: "Worker started with PID: XXXXX"                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Initialize Scraper                            │
│                                                                   │
│  - Create data directories (en_kh, kh_kh, kh_en)                │
│  - Create images and sounds directories                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  For Each Word to Scrape                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │ Check if file  │
                    │ exists in data │
                    │    folder?     │
                    └────────┬───────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                YES │                 │ NO
                    ▼                 ▼
        ┌──────────────────┐  ┌──────────────────┐
        │ Log: "Skipping   │  │ Log: "Scraping   │
        │ existing word"   │  │ (mode): word"    │
        │                  │  │                  │
        │ Return cached    │  │ Fetch from web   │
        │ data from file   │  │                  │
        └──────────────────┘  └────────┬─────────┘
                                       │
                              ┌────────┴─────────┐
                              │                  │
                         SUCCESS              FAILURE
                              │                  │
                              ▼                  ▼
                    ┌──────────────────┐  ┌──────────────────┐
                    │ Save to JSON     │  │ Log: "Error      │
                    │ Download images  │  │ scraping word"   │
                    │ Download sounds  │  │                  │
                    │                  │  │ Return null      │
                    │ Return data      │  │                  │
                    └──────────────────┘  └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ All words done?  │
                    └────────┬─────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                 NO │                 │ YES
                    │                 │
                    ▼                 ▼
            ┌──────────────┐  ┌──────────────────────────┐
            │ Continue to  │  │ Log: "Processing         │
            │ next word    │  │ complete. Total: XXX"    │
            └──────────────┘  │                          │
                              │ Log: "Worker finished"   │
                              └──────────────────────────┘
```

## File Structure

```
node_scrap_data_from_web/
│
├── src/
│   ├── batch_scrape.js       ← Main scraping orchestrator
│   │                           - Writes PID to worker_pid.txt
│   │                           - Logs all batch operations
│   │                           - Coordinates word discovery
│   │
│   ├── scraper.js            ← Core scraping logic
│   │                           - Checks for existing files
│   │                           - Logs scraping activities
│   │                           - Downloads and saves data
│   │
│   ├── index.js              ← Single word scraper
│   └── export.js             ← Data export utilities
│
├── data/                     ← Scraped data storage
│   ├── en_kh/               ← English-Khmer dictionary
│   │   ├── hello.json
│   │   ├── world.json
│   │   └── ...
│   ├── kh_kh/               ← Khmer-Khmer dictionary
│   └── kh_en/               ← Khmer-English dictionary
│
├── worker_pid.txt            ← Current worker process ID
│                               Format: "23327"
│
├── scraping_log.txt          ← All scraping activities
│                               Format: "[timestamp] message"
│
├── LOGGING.md                ← Logging system documentation
├── IMPLEMENTATION_SUMMARY.md ← Implementation details
└── test_logging.js           ← Test script
```

## Logging Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        log(message)                              │
│                                                                   │
│  1. Get current timestamp (ISO-8601)                             │
│  2. Format: "[timestamp] message"                                │
│  3. Write to console (for real-time monitoring)                  │
│  4. Append to scraping_log.txt (for persistent storage)          │
└─────────────────────────────────────────────────────────────────┘

Example:
  Input:  log("Scraping (en_kh): hello")
  Output: [2025-12-25T04:41:17.123Z] Scraping (en_kh): hello
          ↓
          Appended to scraping_log.txt
```

## Key Decision Points

### Should we scrape this word?

```
┌──────────────────────────────────────┐
│ Word: "hello", Mode: 1 (EN-KH)       │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ Generate filename: "hello.json"      │
│ Path: data/en_kh/hello.json          │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ Does file exist?                     │
│ fs.pathExists(filePath)              │
└────────────────┬─────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
     YES│                 │NO
        │                 │
        ▼                 ▼
┌──────────────┐  ┌──────────────────┐
│ SKIP         │  │ FETCH            │
│              │  │                  │
│ Log:         │  │ Log:             │
│ "Skipping    │  │ "Scraping..."    │
│  existing"   │  │                  │
│              │  │ Download data    │
│ Return       │  │ Save to file     │
│ cached data  │  │ Return new data  │
└──────────────┘  └──────────────────┘
```

## Monitoring Commands

```bash
# Check if scraper is running
$ cat worker_pid.txt
23327

# Monitor logs in real-time
$ tail -f scraping_log.txt
[2025-12-25T04:41:17.123Z] Scraping (en_kh): hello
[2025-12-25T04:41:18.234Z] Skipping existing word (en_kh): world
...

# Count total scraped words
$ find data -name "*.json" | wc -l
22471

# Count skipped words
$ grep "Skipping existing" scraping_log.txt | wc -l
15234

# Find errors
$ grep "Error" scraping_log.txt
[2025-12-25T04:41:20.678Z] Error scraping xyz (Mode 1): socket hang up
```

## Performance Benefits

```
Traditional Approach (No Skip):
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Fetch   │  │ Fetch   │  │ Fetch   │
│ hello   │  │ world   │  │ test    │
│ (500ms) │  │ (500ms) │  │ (500ms) │
└─────────┘  └─────────┘  └─────────┘
Total: 1500ms

With Skip Logic:
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Fetch   │  │ Skip    │  │ Fetch   │
│ hello   │  │ world   │  │ test    │
│ (500ms) │  │ (1ms)   │  │ (500ms) │
└─────────┘  └─────────┘  └─────────┘
Total: 1001ms (33% faster!)

With 22,471 words already scraped:
- Skip check: ~1ms per word
- Network fetch: ~500ms per word
- Savings: ~499ms × 22,471 = ~3.1 hours saved!
```

# Web Scraper Logging System

## Overview
Enhanced the web scraper with a comprehensive logging system that tracks all scraping activities and worker process information.

## Key Features

### 1. **Worker PID Tracking**
- **File**: `worker_pid.txt`
- **Purpose**: Stores the current worker process ID
- **Location**: Root directory of the project
- **Usage**: Written at startup, allows monitoring and management of the scraping process

### 2. **Comprehensive Activity Logging**
- **File**: `scraping_log.txt`
- **Purpose**: Records all scraping activities with timestamps
- **Format**: `[ISO-8601 Timestamp] Log Message`
- **Location**: Root directory of the project

### 3. **Skip Existing Files**
The scraper automatically checks if a word has already been scraped:
- Before fetching any word, it checks if the JSON file exists in the data folder
- If the file exists, it logs "Skipping existing word" and returns the cached data
- This prevents duplicate work and respects previously scraped data

## What Gets Logged

### Startup Events
- Worker process ID
- Batch processing start for each mode (EN-KH, KH-KH, KH-EN)

### Scraping Events
- **Successful scrapes**: `Scraping (mode): word (url)`
- **Skipped words**: `Skipping existing word (mode): word`
- **Not found**: `Word not found: word`
- **Errors**: `Error scraping word (Mode X): error message`

### Completion Events
- Processing complete for each mode with total count
- Worker finished successfully

## File Locations

```
/Users/vengann/Ann_Work/Node_JS/node_scrap_data_from_web/
├── worker_pid.txt          # Current worker process ID
├── scraping_log.txt        # All scraping activities with timestamps
└── data/                   # Scraped data
    ├── en_kh/             # English-Khmer dictionary
    ├── kh_kh/             # Khmer-Khmer dictionary
    └── kh_en/             # Khmer-English dictionary
```

## Example Log Output

```
[2025-12-25T04:41:17.123Z] Worker started with PID: 23456
[2025-12-25T04:41:17.234Z] 
>>> Starting Batch for EN-KH <<<
[2025-12-25T04:41:17.345Z] Deep Discovering & Scraping words for EN-KH...
[2025-12-25T04:41:18.456Z] Scraping (en_kh): hello (http://www.english-khmer.com/index.php?gcm=1&gword=hello)
[2025-12-25T04:41:19.567Z] Skipping existing word (en_kh): world
[2025-12-25T04:41:20.678Z] Word not found: xyz
[2025-12-25T04:41:21.789Z] Error scraping test (Mode 1): socket hang up
[2025-12-25T04:41:22.890Z] 
Processing complete for EN-KH. Total unique words saved: 1234
[2025-12-25T04:41:22.901Z] 
Batch processing complete!
[2025-12-25T04:41:22.912Z] Worker with PID 23456 finished successfully
```

## Usage

Run the scraper as usual:
```bash
# Scrape English-Khmer dictionary
node src/batch_scrape.js en

# Scrape Khmer dictionaries
node src/batch_scrape.js kh

# Scrape all dictionaries
node src/batch_scrape.js all
```

The worker PID and all activities will be automatically logged to the respective files.

## Benefits

1. **Monitoring**: Check `worker_pid.txt` to see if a scraper is currently running
2. **Debugging**: Review `scraping_log.txt` to troubleshoot issues
3. **Progress Tracking**: See exactly what's been scraped and what's been skipped
4. **Efficiency**: Automatically skips already-scraped words, saving time and bandwidth
5. **Audit Trail**: Complete history of all scraping activities with timestamps

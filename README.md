# English-Khmer Multi-Dictionary Scraper

This is a powerful Node.js scraper designed to extract a complete dataset from `english-khmer.com` to build a translation application. It supports English-Khmer, Khmer-Khmer, and Khmer-English dictionaries, including audio and translation images.

## 🚀 Features

-   **Multi-Mode Extraction**:
    -   **English -> Khmer**: Downloads Khmer translation **images** and English **audio (.mp3)**.
    -   **Khmer -> Khmer**: Extracts full Khmer definitions as **Unicode text**.
    -   **Khmer -> English**: Extracts English translations as **Unicode text**.
-   **Smart Discovery (Get All Data)**: Uses the website's Live Search API to discover words starting with every letter/consonant (a-z and ក-អ).
-   **Recursive Crawling**: Automatically finds and scrapes synonyms, antonyms, and similar words for every entry.
-   **Resumable**: If a word already exists in your `data` folder, it skips it—saving time and bandwidth.
-   **Comprehensive Logging**: All scraping activities are logged with timestamps to `scraping_log.txt`.
-   **Worker PID Tracking**: Process ID is written to `worker_pid.txt` for monitoring and management.
-   **Master Export**: Merges thousands of individual JSON files into one master JSON file for easy database import.

## 📁 Project Structure

```
node_scrap_data_from_web/
├── src/
│   ├── scraper.js       # Core logic for extracting page data
│   ├── batch_scrape.js  # Discovery script to find and scrape ALL words
│   ├── export.js        # Tool to merge all findings into one file
│   └── index.js         # Single word scraper entry point
├── data/                # Results organized by mode
│   ├── en_kh/           # English to Khmer JSON files
│   ├── kh_kh/           # Khmer to Khmer JSON files
│   ├── kh_en/           # Khmer to English JSON files
│   ├── images/          # Downloaded Khmer translation images
│   └── sounds/          # Downloaded English MP3s
├── worker_pid.txt       # Current worker process ID
├── scraping_log.txt     # All scraping activities with timestamps
└── package.json         # Dependencies (axios, cheerio, fs-extra)
```

## 🛠️ How to Use

### 1. Installation
```bash
npm install
```

### 2. Get "All Data" (Automated)
Run the batch scraper to discover and extract words for all three dictionaries.
```bash
# Usage: node src/batch_scrape.js <type> <depth> <limit_per_letter>
# type: 'en', 'kh', or 'all'
# depth: 2 (recommended) - scrapes word + its synonyms
# limit: 50 - how many words to grab per character prefix

node src/batch_scrape.js all 2 50
```
This script uses **prefix-based discovery** to find almost every word in the dictionary.

### 3. Scrape a Single Word
```bash
# Usage: node src/index.js <word> <mode> <depth>
# modes: 1 (En-Kh), 2 (Kh-Kh), 3 (Kh-En)

node src/index.js "crawl" 1 1
```

### 4. Export to One File
Once you have enough data, merge it for your app:
```bash
node src/export.js
```
This creates `data/dictionary_export.json`.

## 📝 Important Notes on Data
1.  **En-Kh Khmer Text**: Many Khmer translations for English words are stored as **images** (`.png`). This is why the images folder is important.
2.  **Unicode Support**: For Kh-Kh and Kh-En, the translations are **clean Unicode text**, which is easy to use in your UI.
3.  **Filenames**: Khmer words are used as filenames. My script handles these correctly, but make sure your OS supports them.

## ⚙️ How it Works
The scraper uses **Axios** to fetch pages and **Cheerio** to parse the legacy HTML structure. It specifically looks for:
-   `td.khbat12`: Container for Khmer script.
-   `td.text2`: Container for English definitions (in Kh-En mode).
-   `iensound/`: Path for audio files.
-   `imgukh/`: Path for Khmer translation images.

## 📊 Monitoring & Logging

### Check Scraper Status
```bash
# View current worker PID
cat worker_pid.txt

# Check if process is running
ps -p $(cat worker_pid.txt)
```

### Monitor Logs in Real-Time
```bash
# Watch logs as they're written
tail -f scraping_log.txt

# View last 50 entries
tail -50 scraping_log.txt
```

### Search Logs
```bash
# Find errors
grep "Error" scraping_log.txt

# Count skipped words (already scraped)
grep "Skipping existing" scraping_log.txt | wc -l

# Search for specific word
grep "hello" scraping_log.txt
```

### Statistics
```bash
# Total words scraped
find data -name "*.json" | wc -l

# Words per dictionary
find data/en_kh -name "*.json" | wc -l
find data/kh_kh -name "*.json" | wc -l
find data/kh_en -name "*.json" | wc -l
```

## 📚 Additional Documentation

- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Common commands and quick tips
- **[LOGGING.md](LOGGING.md)** - Detailed logging system documentation
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and data flow
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Technical implementation details

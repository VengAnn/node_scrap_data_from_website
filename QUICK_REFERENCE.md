# Quick Reference Guide

## 🚀 Quick Start

### Run the Scraper
```bash
# English-Khmer dictionary only
node src/batch_scrape.js en

# Khmer dictionaries only (KH-KH and KH-EN)
node src/batch_scrape.js kh

# All dictionaries
node src/batch_scrape.js all
```

### Test the Logging System
```bash
node test_logging.js
```

## 📁 Important Files

| File | Purpose | Example Content |
|------|---------|-----------------|
| `worker_pid.txt` | Current worker process ID | `23327` |
| `scraping_log.txt` | All scraping activities with timestamps | `[2025-12-25T04:41:17.123Z] Scraping (en_kh): hello` |
| `data/en_kh/*.json` | English-Khmer dictionary data | Word definitions, synonyms, etc. |
| `data/kh_kh/*.json` | Khmer-Khmer dictionary data | Khmer word definitions |
| `data/kh_en/*.json` | Khmer-English dictionary data | Khmer to English translations |

## 🔍 Monitoring Commands

### Check Worker Status
```bash
# Is the scraper running?
cat worker_pid.txt

# Check if process is alive
ps -p $(cat worker_pid.txt)
```

### Monitor Logs
```bash
# Watch logs in real-time
tail -f scraping_log.txt

# Last 50 log entries
tail -50 scraping_log.txt

# Last 100 log entries
tail -100 scraping_log.txt
```

### Search Logs
```bash
# Find all errors
grep "Error" scraping_log.txt

# Count errors
grep "Error" scraping_log.txt | wc -l

# Find skipped words
grep "Skipping existing" scraping_log.txt

# Count skipped words
grep "Skipping existing" scraping_log.txt | wc -l

# Find words not found
grep "Word not found" scraping_log.txt

# Search for specific word
grep "hello" scraping_log.txt
```

### Statistics
```bash
# Total JSON files scraped
find data -name "*.json" | wc -l

# English-Khmer words
find data/en_kh -name "*.json" | wc -l

# Khmer-Khmer words
find data/kh_kh -name "*.json" | wc -l

# Khmer-English words
find data/kh_en -name "*.json" | wc -l

# Total log entries
wc -l scraping_log.txt

# Disk usage
du -sh data/
```

## 🎯 Common Tasks

### Resume Scraping After Interruption
```bash
# The scraper automatically skips existing files
# Just run it again with the same parameters
node src/batch_scrape.js en
```

### Clean Start (Re-scrape Everything)
```bash
# Backup existing data first!
mv data data_backup
mv scraping_log.txt scraping_log_backup.txt

# Start fresh
node src/batch_scrape.js all
```

### Stop the Scraper
```bash
# Find the process ID
cat worker_pid.txt

# Kill the process (gracefully)
kill $(cat worker_pid.txt)

# Or force kill if needed
kill -9 $(cat worker_pid.txt)
```

### View Specific Word Data
```bash
# View a word's data (pretty printed)
cat data/en_kh/hello.json | python3 -m json.tool

# Or using jq (if installed)
cat data/en_kh/hello.json | jq .
```

## 📊 Log Entry Types

| Type | Example | Meaning |
|------|---------|---------|
| Worker Start | `Worker started with PID: 23327` | Scraper process started |
| Batch Start | `>>> Starting Batch for EN-KH <<<` | Beginning a dictionary mode |
| Scraping | `Scraping (en_kh): hello (http://...)` | Fetching a new word |
| Skipping | `Skipping existing word (en_kh): world` | Word already exists, using cache |
| Not Found | `Word not found: xyz` | Word doesn't exist in dictionary |
| Error | `Error scraping test (Mode 1): socket hang up` | Network or parsing error |
| Completion | `Processing complete for EN-KH. Total: 1234` | Batch finished |
| Worker End | `Worker with PID 23327 finished successfully` | Scraper completed |

## ⚙️ Configuration

### Scraping Modes
- **Mode 1**: English → Khmer (EN-KH)
- **Mode 2**: Khmer → Khmer (KH-KH)
- **Mode 3**: Khmer → English (KH-EN)

### Default Settings
- **Delay between requests**: 400ms (polite scraping)
- **Discovery depth**: 2 levels
- **Limit per seed**: 10 words

### Modify Settings
Edit `src/batch_scrape.js`:
```javascript
// Change delay (line ~74)
await new Promise(r => setTimeout(r, 400)); // Change 400 to desired ms

// Change depth (line ~123)
const depth = parseInt(process.argv[3] || '2', 10); // Change '2' to desired depth
```

## 🐛 Troubleshooting

### Problem: No logs appearing
**Solution**: Check file permissions
```bash
ls -la worker_pid.txt scraping_log.txt
chmod 644 worker_pid.txt scraping_log.txt
```

### Problem: Scraper seems stuck
**Solution**: Check the log file
```bash
tail -20 scraping_log.txt
```

### Problem: Too many errors
**Solution**: Check network connection and website availability
```bash
curl -I http://www.english-khmer.com
```

### Problem: Duplicate entries
**Solution**: The scraper automatically skips existing files. If you see duplicates, check for filename collisions:
```bash
find data -name "*.json" | sort | uniq -d
```

## 📈 Performance Tips

1. **Resume interrupted scraping**: Just run the same command again - it skips existing files
2. **Monitor progress**: Use `tail -f scraping_log.txt` in a separate terminal
3. **Check disk space**: Large dictionaries can use significant space
4. **Network stability**: Use a stable connection for best results

## 🔗 Related Documentation

- **LOGGING.md** - Detailed logging system documentation
- **IMPLEMENTATION_SUMMARY.md** - Technical implementation details
- **ARCHITECTURE.md** - System architecture and data flow
- **README.md** - General project information

## 💡 Pro Tips

```bash
# Create a monitoring dashboard
watch -n 5 'echo "=== Scraper Status ===" && \
  echo "PID: $(cat worker_pid.txt 2>/dev/null || echo "Not running")" && \
  echo "Total words: $(find data -name "*.json" 2>/dev/null | wc -l)" && \
  echo "Last activity:" && tail -3 scraping_log.txt'

# Export statistics to CSV
echo "Mode,Count" > stats.csv
echo "EN-KH,$(find data/en_kh -name "*.json" | wc -l)" >> stats.csv
echo "KH-KH,$(find data/kh_kh -name "*.json" | wc -l)" >> stats.csv
echo "KH-EN,$(find data/kh_en -name "*.json" | wc -l)" >> stats.csv

# Find most recent scrapes
find data -name "*.json" -type f -mtime -1 | head -20
```

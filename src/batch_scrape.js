const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');
const DictionaryScraper = require('./scraper');

const BASE_URL = 'http://www.english-khmer.com';
const EN_ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
const KH_CONSONANTS = ['ក', 'ខ', 'គ', 'ឃ', 'ង', 'ច', 'ឆ', 'ជ', 'ឈ', 'ញ', 'ដ', 'ឋ', 'ឌ', 'ឍ', 'ណ', 'ត', 'ថ', 'ទ', 'ធ', 'ន', 'ប', 'ផ', 'ព', 'ភ', 'ម', 'យ', 'រ', 'ល', 'វ', 'ស', 'ហ', 'ឡ', 'អ'];
// Independent vowels are the only vowels that can start a word in Khmer
const KH_VOWELS = ['ឥ', 'ឦ', 'ឧ', 'ឩ', 'ឪ', 'ឫ', 'ឬ', 'ឭ', 'ឮ', 'ឯ', 'ឰ', 'ឱ', 'ឳ'];
const KH_ALL_SEEDS = [...KH_CONSONANTS, ...KH_VOWELS];

// Logging setup
const LOG_FILE = path.join(__dirname, '..', 'scraping_log.txt');
const PID_FILE = path.join(__dirname, '..', 'worker_pid.txt');

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
    fs.appendFileSync(LOG_FILE, logMessage);
}

async function discoverWords(prefix, mode) {
    // Mode 1 (En-Kh) uses livesearch1.php
    // Mode 2 (Kh-Kh) and Mode 3 (Kh-En) use livesearch2.php for Khmer words
    const endpoint = mode === 1 ? 'livesearch1.php' : 'livesearch2.php';
    
    const url = `${BASE_URL}/${endpoint}?q=${encodeURIComponent(prefix)}`;
    try {
        const { data } = await axios.get(url);
        // Returns HTML with <br> separated links: <a href="...">...</a>
        const $ = cheerio.load(data);
        const words = [];
        $('a').each((i, el) => {
            const w = $(el).text().trim();
            if (w) words.push(w);
        });
        return words;
    } catch (e) {
        return [];
    }
}

async function runBatch(seeds, mode, depth, limitPerSeed) {
    const scraper = new DictionaryScraper();
    await scraper.init();

    let modeName = mode === 1 ? 'EN-KH' : (mode === 2 ? 'KH-KH' : 'KH-EN');
    log(`\n>>> Starting Batch for ${modeName} <<<`);

    const wordQueue = new Set(seeds);
    const discovered = new Set();
    const processed = new Set();

    // Recursive discovery function to get every word
    async function deepDiscover(prefix, currentMode) {
        process.stdout.write(`Discovering: ${prefix} ... queue: ${wordQueue.size} \r`);
        const found = await discoverWords(prefix, currentMode);
        
        // Add words to queue and SCRAPE IMMEDIATELY
        for (const w of found) {
            const visitedKey = `${currentMode}:${w.trim().toLowerCase()}`;
            if (!processed.has(visitedKey)) {
                wordQueue.add(w);
                
                // Scrape the discovered word immediately
                const data = await scraper.scrapeWord(w, currentMode);
                processed.add(visitedKey);
                totalScraped++;
                
                // Polite delay after each scrape
                await new Promise(r => setTimeout(r, 400));

                // If depth > 1, handle relations immediately too (recursive crawling)
                if (depth > 1 && data) {
                    const relations = [
                        ...(data.synonyms || []), 
                        ...(data.similar_words || []), 
                        ...(data.antonyms || [])
                    ];
                    for (const rel of relations) {
                        const relKey = `${currentMode}:${rel.trim().toLowerCase()}`;
                        if (!processed.has(relKey)) {
                            await scraper.scrapeWord(rel, currentMode);
                            processed.add(relKey);
                            totalScraped++;
                            await new Promise(r => setTimeout(r, 400));
                        }
                    }
                }
            }
        }

        // Discovery Depth Settings:
        const maxDepth = currentMode === 1 ? 4 : 5;

        // If we found many words, there's likely more hidden. 
        if (found.length >= 9 && prefix.length < maxDepth) {
            const list = currentMode === 1 ? EN_ALPHABET : seeds;
            for (const nextChar of list) {
                await deepDiscover(prefix + nextChar, currentMode);
            }
        }
    }

    log(`Deep Discovering & Scraping words for ${modeName}...`);
    let totalScraped = 0;
    for (const char of seeds) {
        await deepDiscover(char, mode);
    }

    log(`\nProcessing complete for ${modeName}. Total unique words saved: ${totalScraped}`);
}

(async () => {
    // Write worker PID to file
    await fs.writeFile(PID_FILE, process.pid.toString());
    log(`Worker started with PID: ${process.pid}`);
    
    const type = process.argv[2]; // 'en' or 'kh' or 'all'
    const depth = parseInt(process.argv[3] || '2', 10);
    const limitPerSeed = parseInt(process.argv[4] || '10', 10);

    if (type === 'en' || type === 'all') {
        // Mode 1: En-Kh
        await runBatch(EN_ALPHABET, 1, depth, limitPerSeed);
    }

    if (type === 'kh' || type === 'all') {
        // Mode 2: Kh-Kh
        await runBatch(KH_ALL_SEEDS, 2, depth, limitPerSeed);
        // Mode 3: Kh-En
        await runBatch(KH_ALL_SEEDS, 3, depth, limitPerSeed);
    }

    log('\nBatch processing complete!');
    log(`Worker with PID ${process.pid} finished successfully`);
})();

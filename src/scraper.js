const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');

const BASE_URL = 'http://www.english-khmer.com';

// Logging setup
const LOG_FILE = path.join(__dirname, '..', 'scraping_log.txt');

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
    fs.appendFileSync(LOG_FILE, logMessage);
}

class DictionaryScraper {
  constructor(outputDir = 'data') {
    this.outputDir = outputDir;
    this.imagesDir = path.join(outputDir, 'images');
    this.soundsDir = path.join(outputDir, 'sounds');
    this.visited = new Set();
  }

  async init() {
    await fs.ensureDir(this.outputDir);
    await fs.ensureDir(this.imagesDir);
    await fs.ensureDir(this.soundsDir);
    // Create folders for specific dictionaries
    await fs.ensureDir(path.join(this.outputDir, 'en_kh'));
    await fs.ensureDir(path.join(this.outputDir, 'kh_kh'));
    await fs.ensureDir(path.join(this.outputDir, 'kh_en'));
  }

  async scrapeWord(word, mode = 1) {
    if (!word) return null;
    const cleanWord = word.trim().toLowerCase(); // For English. Khmer might need care.
    const encodedWord = encodeURIComponent(word.trim());
    
    // Determine subdirectory and check cache
    let modeDir = 'en_kh';
    if (mode === 2) modeDir = 'kh_kh';
    if (mode === 3) modeDir = 'kh_en';
    
    // Clean word for filename and deduplication
    // Site sometimes includes (notes) in the word returned by search
    const cleanWordForFile = word.trim()
        .toLowerCase()
        .replace(/\(.*\)/g, '')
        .trim();
    
    const safeFilename = cleanWordForFile
        .replace(/[^a-z0-9\u1780-\u17FF]/g, '_')
        .replace(/_{2,}/g, '_') // Avoid triple/double underscores
        .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
    
    const filePath = path.join(this.outputDir, modeDir, `${safeFilename || 'empty'}.json`);
    
    if (await fs.pathExists(filePath)) {
      log(`Skipping existing word (${modeDir}): ${cleanWordForFile}`);
      return JSON.parse(await fs.readFile(filePath)); 
    }

    const url = `${BASE_URL}/index.php?gcm=${mode}&gword=${encodedWord}`;
    log(`Scraping (${modeDir}): ${word} (${url})`);

    try {
        const { data } = await axios.get(url, {
             responseType: 'arraybuffer'
        });
        const html = data.toString('utf-8');
        const $ = cheerio.load(html);

        // Check for 'not found'
        if (html.includes('word not found') || html.includes('Please try again')) {
            log(`Word not found: ${word}`);
            return null;
        }
        
        const result = {
            word: word.trim(),
            type: modeDir,
            definitions: [],
            synonyms: [],
            antonyms: [],
            similar_words: [],
            sound: null
        };

        // 1. Definition Section
        let defHeader = $('b:contains("Definition:")');
        if (!defHeader.length) {
            defHeader = $('div.khbat13:contains("អត្ថន័យ")');
        }

        if (defHeader.length) {
            let container = defHeader.closest('table').parent();
            const nextTable = defHeader.closest('table').next('table');
            
            // For Kh-En (3), we strictly want rows with .text2
            // For Kh-Kh (2) and En-Kh (1), we want rows with .khbat12
            let targetRows;
            if (mode === 3) {
                targetRows = nextTable.find('tr').filter((i, el) => $(el).find('td.text2').length > 0);
                if (targetRows.length === 0) {
                     targetRows = container.find('tr').filter((i, el) => $(el).find('td.text2').length > 0);
                }
            } else {
                targetRows = nextTable.find('tr').filter((i, el) => $(el).find('td.khbat12').length > 0);
                if (targetRows.length === 0) {
                     targetRows = container.find('tr').filter((i, el) => $(el).find('td.khbat12').length > 0);
                }
            }
            
            targetRows.each((i, el) => {
                const row = $(el);
                const posEl = row.find('td font[size="3"] i');
                const khmerImg = row.find('td.khbat12 img');
                const khmerTextCell = row.find('td.khbat12'); 
                const englishTextCell = row.find('td.text2'); 
                const exampleEl = row.find('td font[face="Arial"][color="gray"]');
                
                const def = {
                    pos: posEl.text().trim().replace('.', ''),
                    example: exampleEl.text().trim().replace(/^Ex:\s*/, '')
                };

                if (mode === 1) { // En-Kh
                    if (khmerImg.length) {
                        def.khmer_image_url = khmerImg.attr('src') ? `${BASE_URL}/${khmerImg.attr('src')}` : null;
                    } else {
                        const text = khmerTextCell.text().replace(exampleEl.text(), '').trim();
                         if (text) def.khmer_text = text;
                    }
                } else if (mode === 3) { // Kh-En
                    let text = englishTextCell.text().trim();
                    // In mode 3, the definition_text MUST be English (non-Khmer)
                    if (text) {
                        def.definition_text = text.replace(exampleEl.text(), '').trim();
                    }
                } else { // Kh-Kh (2)
                     let text = khmerTextCell.text().trim();
                     if (exampleEl.length) {
                         text = text.replace(exampleEl.text(), '');
                     }
                     def.definition_text = text.trim();
                }
                
                if (def.khmer_image_url || def.khmer_text || def.definition_text) {
                     if (def.definition_text) {
                         def.definition_text = def.definition_text.replace(/^\d+\.\s*/, '');
                         const cleanDef = def.definition_text.toLowerCase();
                         // Skip if def is just the word itself or empty
                         if (cleanDef === word.trim().toLowerCase()) return;
                         if (cleanDef.length < 2 && !def.khmer_image_url) return;
                     }
                     
                     result.definitions.push(def);
                }
            });
        }
        
        // Sound (Only for En-Kh usually)
        if (mode === 1) {
             const scriptContent = $('body').html(); 
             const soundMatch = scriptContent.match(/new Audio\("([^"]+)"\)/);
             if (soundMatch) {
                 result.sound_url = `${BASE_URL}/${soundMatch[1]}`;
             }
        }

        // 2,3,4: Synonyms, Antonyms, Similar Words (Common structure)
        const extractList = (headerText, targetArray) => {
             const header = $(`b:contains("${headerText}")`); 
             if (header.length) {
                 const container = header.closest('td'); // usually in a TD
                 container.find('a.menu2, a.khbat12').each((i, el) => { // Added a.khbat12
                     const w = $(el).text().trim();
                     if (w && w.toLowerCase() !== cleanWord) targetArray.push(w);
                 });
             }
        };

        // Syn/Ant are in simple lists
        extractList("Synonym:", result.synonyms);
        extractList("Antonym:", result.antonyms);

        // Similar words
        const simTd = $('td:contains("Found similar words:")');
        if (simTd.length) {
            const nextTable = simTd.closest('table').next('table');
            // Support both menu2 (En) and khbat12 (Kh) classes
            nextTable.find('a.menu2, a.khbat12').each((i, el) => {
                 const w = $(el).text().trim();
                 if (w && w.toLowerCase() !== cleanWord) {
                     result.similar_words.push(w);
                 }
            });
        }
        
        // Deduplicate
        result.synonyms = [...new Set(result.synonyms)];
        result.antonyms = [...new Set(result.antonyms)];
        result.similar_words = [...new Set(result.similar_words)];

        // Downloads
        // 1. Definition Images (En-Kh)
        for (const def of result.definitions) {
            if (def.khmer_image_url) {
                const filename = path.basename(def.khmer_image_url);
                const localPath = path.join(this.imagesDir, filename);
                if (!(await fs.pathExists(localPath))) {
                    await this.downloadFile(def.khmer_image_url, localPath);
                }
                def.local_image_path = `images/${filename}`;
            }
        }
        
        // 2. Sound
        if (result.sound_url) {
            const filename = path.basename(result.sound_url);
            const localPath = path.join(this.soundsDir, filename);
             if (!(await fs.pathExists(localPath))) {
                    await this.downloadFile(result.sound_url, localPath);
            }
            result.local_sound_path = `sounds/${filename}`;
        }

        // Save
        await fs.writeJson(filePath, result, { spaces: 2 });
        return result;

    } catch (err) {
        log(`Error scraping ${word} (Mode ${mode}): ${err.message}`);
        return null;
    }
  }

  async downloadFile(url, dest) {
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });
        const writer = fs.createWriteStream(dest);
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (e) {
        // console.error(`Failed to download ${url}: ${e.message}`);
    }
  }
}

module.exports = DictionaryScraper;

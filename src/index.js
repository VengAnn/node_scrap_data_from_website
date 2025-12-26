const DictionaryScraper = require('./scraper');

(async () => {
    const scraper = new DictionaryScraper();
    await scraper.init();

    const startWord = process.argv[2] || 'crawl';
    // Mode: 1=En-Kh, 2=Kh-Kh, 3=Kh-En. Default 1.
    const mode = parseInt(process.argv[3] || '1', 10);
    // Depth: 1=single, 2=neighbors
    const depth = parseInt(process.argv[4] || '1', 10); 

    console.log(`Starting scraper. Word: "${startWord}", Mode: ${mode}, Depth: ${depth}`);
    
    const queue = [{ word: startWord, currentDepth: 1, mode: mode }];
    const visited = new Set();
    const limit = 50;
    
    while (queue.length > 0) {
        if (visited.size >= limit) {
             console.log(`Reached safety limit of ${limit} words.`);
             break;
        }
        
        const { word, currentDepth, mode } = queue.shift();
        const visitedKey = `${mode}:${word.trim().toLowerCase()}`;
        
        if (visited.has(visitedKey)) continue;

        const data = await scraper.scrapeWord(word, mode);
        visited.add(visitedKey);
        
        // Polite delay
        await new Promise(r => setTimeout(r, 800));

        if (currentDepth < depth && data) {
            const relations = [
                ...(data.synonyms || []), 
                ...(data.similar_words || []), 
                ...(data.antonyms || [])
            ];
            
            for (const rel of relations) {
                 const relKey = `${mode}:${rel.trim().toLowerCase()}`;
                 if (!visited.has(relKey)) {
                    queue.push({ word: rel, currentDepth: currentDepth + 1, mode: mode });
                 }
            }
        }
    }
    
    console.log(`Done! Scraped ${visited.size} items.`);
})();

#!/usr/bin/env node

/**
 * Test script to verify logging functionality
 * This will scrape a few test words and demonstrate the logging system
 */

const DictionaryScraper = require('./src/scraper');
const fs = require('fs-extra');
const path = require('path');

const PID_FILE = path.join(__dirname, 'worker_pid.txt');
const LOG_FILE = path.join(__dirname, 'scraping_log.txt');

async function testLogging() {
    console.log('=== Testing Logging System ===\n');
    
    // Write PID
    await fs.writeFile(PID_FILE, process.pid.toString());
    console.log(`✓ Worker PID written to worker_pid.txt: ${process.pid}`);
    
    // Initialize scraper
    const scraper = new DictionaryScraper();
    await scraper.init();
    console.log('✓ Scraper initialized');
    
    // Test words
    const testWords = [
        { word: 'hello', mode: 1 },  // EN-KH
        { word: 'world', mode: 1 },  // EN-KH (might exist)
        { word: 'test', mode: 1 }    // EN-KH
    ];
    
    console.log('\n--- Scraping Test Words ---');
    for (const { word, mode } of testWords) {
        console.log(`\nTesting: ${word}`);
        const result = await scraper.scrapeWord(word, mode);
        if (result) {
            console.log(`  ✓ Successfully scraped: ${word}`);
        } else {
            console.log(`  ✗ Failed or not found: ${word}`);
        }
        // Small delay between requests
        await new Promise(r => setTimeout(r, 500));
    }
    
    console.log('\n--- Checking Log Files ---');
    
    // Check PID file
    if (await fs.pathExists(PID_FILE)) {
        const pid = await fs.readFile(PID_FILE, 'utf-8');
        console.log(`✓ worker_pid.txt exists with PID: ${pid.trim()}`);
    }
    
    // Check log file
    if (await fs.pathExists(LOG_FILE)) {
        const logContent = await fs.readFile(LOG_FILE, 'utf-8');
        const lines = logContent.trim().split('\n');
        console.log(`✓ scraping_log.txt exists with ${lines.length} log entries`);
        console.log('\n--- Last 5 Log Entries ---');
        lines.slice(-5).forEach(line => console.log(line));
    }
    
    console.log('\n=== Test Complete ===');
}

testLogging().catch(console.error);

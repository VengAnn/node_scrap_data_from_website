const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

// Path to the JSON file and output database
const JSON_FILE = path.join(__dirname, "../data/dictionary_export.json");
const DB_FILE = path.join(__dirname, "../data/dictionary.db");

console.log("Starting conversion to SQLite...");
console.log(`Reading: ${JSON_FILE}`);
console.log(`Output: ${DB_FILE}`);

// Read the JSON file
const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, "utf8"));

// Delete existing database if it exists
if (fs.existsSync(DB_FILE)) {
  fs.unlinkSync(DB_FILE);
  console.log("Removed existing database file.");
}

// Create new database
const db = new sqlite3.Database(DB_FILE);

// Create tables
db.serialize(() => {
  console.log("Creating tables...");

  // Main words table
  db.run(`
        CREATE TABLE words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT NOT NULL,
            type TEXT NOT NULL,
            sound TEXT,
            isFavorite INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

  // Create index on word and type for faster lookups
  db.run("CREATE INDEX idx_word ON words(word)");
  db.run("CREATE INDEX idx_type ON words(type)");
  db.run("CREATE INDEX idx_word_type ON words(word, type)");

  // Definitions table
  db.run(`
        CREATE TABLE definitions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word_id INTEGER NOT NULL,
            pos TEXT,
            example TEXT,
            definition_text TEXT,
            khmer_image_url TEXT,
            local_image_path TEXT,
            FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
        )
    `);

  db.run("CREATE INDEX idx_word_id ON definitions(word_id)");

  // Synonyms table
  db.run(`
        CREATE TABLE synonyms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word_id INTEGER NOT NULL,
            synonym TEXT NOT NULL,
            FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
        )
    `);

  db.run("CREATE INDEX idx_synonym_word_id ON synonyms(word_id)");

  // Antonyms table
  db.run(`
        CREATE TABLE antonyms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word_id INTEGER NOT NULL,
            antonym TEXT NOT NULL,
            FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
        )
    `);

  db.run("CREATE INDEX idx_antonym_word_id ON antonyms(word_id)");

  // Similar words table
  db.run(`
        CREATE TABLE similar_words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word_id INTEGER NOT NULL,
            similar_word TEXT NOT NULL,
            FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
        )
    `);

  db.run("CREATE INDEX idx_similar_word_id ON similar_words(word_id)");

  console.log("Tables created successfully.");
});

// Insert data with proper async handling
db.serialize(() => {
  console.log("Starting data insertion...");

  // Begin transaction for better performance
  db.run("BEGIN TRANSACTION");

  let totalWords = 0;
  let totalDefinitions = 0;
  let totalSynonyms = 0;
  let totalAntonyms = 0;
  let totalSimilarWords = 0;

  // Process each dictionary type
  for (const [dictType, words] of Object.entries(jsonData)) {
    console.log(`Processing ${dictType}...`);
    let count = 0;

    for (const wordData of words) {
      // Insert word and get ID using callback
      db.run(
        "INSERT INTO words (word, type, sound) VALUES (?, ?, ?)",
        [wordData.word, wordData.type, wordData.sound],
        function (err) {
          if (err) {
            console.error(`Error inserting word: ${wordData.word}`, err);
            return;
          }

          const wordId = this.lastID;

          // Insert definitions
          if (wordData.definitions && wordData.definitions.length > 0) {
            for (const def of wordData.definitions) {
              db.run(
                "INSERT INTO definitions (word_id, pos, example, definition_text, khmer_image_url, local_image_path) VALUES (?, ?, ?, ?, ?, ?)",
                [
                  wordId,
                  def.pos || "",
                  def.example || "",
                  def.definition_text || "",
                  def.khmer_image_url || "",
                  def.local_image_path || "",
                ]
              );
              totalDefinitions++;
            }
          }

          // Insert synonyms
          if (wordData.synonyms && wordData.synonyms.length > 0) {
            for (const synonym of wordData.synonyms) {
              db.run("INSERT INTO synonyms (word_id, synonym) VALUES (?, ?)", [
                wordId,
                synonym,
              ]);
              totalSynonyms++;
            }
          }

          // Insert antonyms
          if (wordData.antonyms && wordData.antonyms.length > 0) {
            for (const antonym of wordData.antonyms) {
              db.run("INSERT INTO antonyms (word_id, antonym) VALUES (?, ?)", [
                wordId,
                antonym,
              ]);
              totalAntonyms++;
            }
          }

          // Insert similar words
          if (wordData.similar_words && wordData.similar_words.length > 0) {
            for (const similar of wordData.similar_words) {
              db.run(
                "INSERT INTO similar_words (word_id, similar_word) VALUES (?, ?)",
                [wordId, similar]
              );
              totalSimilarWords++;
            }
          }
        }
      );

      totalWords++;
      count++;

      // Progress indicator
      if (count % 1000 === 0) {
        console.log(`  Processed ${count} words from ${dictType}...`);
      }
    }

    console.log(`Finished ${dictType}: ${count} words`);
  }

  // Commit transaction
  db.run("COMMIT", () => {
    console.log("\n=== Conversion Summary ===");
    console.log(`Total words: ${totalWords}`);
    console.log(`Total definitions: ${totalDefinitions}`);
    console.log(`Total synonyms: ${totalSynonyms}`);
    console.log(`Total antonyms: ${totalAntonyms}`);
    console.log(`Total similar words: ${totalSimilarWords}`);
    console.log("\nDatabase created successfully!");
    console.log(`Location: ${DB_FILE}`);

    // Close database
    db.close((err) => {
      if (err) {
        console.error("Error closing database:", err);
      } else {
        console.log("\nDatabase connection closed.");
      }
    });
  });
});

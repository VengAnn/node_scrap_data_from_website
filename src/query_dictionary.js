const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const DB_FILE = path.join(__dirname, "../data/dictionary.db");
const db = new sqlite3.Database(DB_FILE);

/**
 * Search for a word in the dictionary
 * @param {string} word - The word to search for
 * @param {string} type - Optional: 'en_kh', 'kh_en', or 'kh_kh'
 * @returns {Promise<Array>} Array of word results with definitions
 */
function searchWord(word, type = null) {
  return new Promise((resolve, reject) => {
    let query = `
            SELECT w.id, w.word, w.type, w.sound, w.isFavorite, w.isHistory,
                   d.id as def_id, d.pos, d.example, d.definition_text, 
                   d.khmer_image_url, d.local_image_path
            FROM words w
            LEFT JOIN definitions d ON w.id = d.word_id
            WHERE w.word LIKE ?
        `;

    const params = [`%${word}%`];

    if (type) {
      query += " AND w.type = ?";
      params.push(type);
    }

    query += " ORDER BY w.word, d.id";

    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      // Group results by word
      const words = {};
      rows.forEach((row) => {
        if (!words[row.id]) {
          words[row.id] = {
            id: row.id,
            word: row.word,
            type: row.type,
            sound: row.sound,
            isFavorite: row.isFavorite,
            isHistory: row.isHistory,
            definitions: [],
          };
        }

        if (row.def_id) {
          words[row.id].definitions.push({
            pos: row.pos,
            example: row.example,
            definition_text: row.definition_text,
            khmer_image_url: row.khmer_image_url,
            local_image_path: row.local_image_path,
          });
        }
      });

      resolve(Object.values(words));
    });
  });
}

/**
 * Get synonyms for a word
 * @param {number} wordId - The ID of the word
 * @returns {Promise<Array>} Array of synonyms
 */
function getSynonyms(wordId) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT synonym FROM synonyms WHERE word_id = ?",
      [wordId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map((r) => r.synonym));
      }
    );
  });
}

/**
 * Get antonyms for a word
 * @param {number} wordId - The ID of the word
 * @returns {Promise<Array>} Array of antonyms
 */
function getAntonyms(wordId) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT antonym FROM antonyms WHERE word_id = ?",
      [wordId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map((r) => r.antonym));
      }
    );
  });
}

/**
 * Get similar words
 * @param {number} wordId - The ID of the word
 * @returns {Promise<Array>} Array of similar words
 */
function getSimilarWords(wordId) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT similar_word FROM similar_words WHERE word_id = ?",
      [wordId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map((r) => r.similar_word));
      }
    );
  });
}

/**
 * Get complete word information including all related data
 * @param {string} word - The exact word to search for
 * @param {string} type - Optional: 'en_kh', 'kh_en', or 'kh_kh'
 * @returns {Promise<Object>} Complete word information
 */
async function getWordComplete(word, type = null) {
  const words = await searchWord(word, type);

  if (words.length === 0) {
    return null;
  }

  // Get the first exact match or the first result
  const wordData =
    words.find((w) => w.word.toLowerCase() === word.toLowerCase()) || words[0];

  // Get related data
  const [synonyms, antonyms, similarWords] = await Promise.all([
    getSynonyms(wordData.id),
    getAntonyms(wordData.id),
    getSimilarWords(wordData.id),
  ]);

  return {
    ...wordData,
    synonyms,
    antonyms,
    similar_words: similarWords,
  };
}

/**
 * Get database statistics
 * @returns {Promise<Object>} Statistics about the database
 */
function getStats() {
  return new Promise((resolve, reject) => {
    const stats = {};

    db.serialize(() => {
      db.get("SELECT COUNT(*) as count FROM words", (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        stats.totalWords = row.count;
      });

      db.get("SELECT COUNT(*) as count FROM definitions", (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        stats.totalDefinitions = row.count;
      });

      db.get("SELECT COUNT(*) as count FROM synonyms", (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        stats.totalSynonyms = row.count;
      });

      db.get("SELECT COUNT(*) as count FROM antonyms", (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        stats.totalAntonyms = row.count;
      });

      db.get("SELECT COUNT(*) as count FROM similar_words", (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        stats.totalSimilarWords = row.count;
        resolve(stats);
      });
    });
  });
}

// Export functions
module.exports = {
  searchWord,
  getSynonyms,
  getAntonyms,
  getSimilarWords,
  getWordComplete,
  getStats,
  db,
};

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage:");
    console.log(
      "  node query_dictionary.js stats                  - Show database statistics"
    );
    console.log(
      "  node query_dictionary.js search <word> [type]   - Search for a word"
    );
    console.log(
      "  node query_dictionary.js complete <word> [type] - Get complete word info"
    );
    console.log("\nTypes: en_kh, kh_en, kh_kh");
    process.exit(0);
  }

  const command = args[0];

  if (command === "stats") {
    getStats()
      .then((stats) => {
        console.log("\n=== Dictionary Database Statistics ===");
        console.log(`Total Words: ${stats.totalWords}`);
        console.log(`Total Definitions: ${stats.totalDefinitions}`);
        console.log(`Total Synonyms: ${stats.totalSynonyms}`);
        console.log(`Total Antonyms: ${stats.totalAntonyms}`);
        console.log(`Total Similar Words: ${stats.totalSimilarWords}`);
        db.close();
      })
      .catch((err) => {
        console.error("Error:", err);
        db.close();
      });
  } else if (command === "search" && args[1]) {
    searchWord(args[1], args[2])
      .then((results) => {
        console.log(`\nFound ${results.length} result(s) for "${args[1]}":\n`);
        results.forEach((word) => {
          console.log(`Word: ${word.word} (${word.type})`);
          console.log(`Definitions: ${word.definitions.length}`);
          word.definitions.slice(0, 2).forEach((def, i) => {
            console.log(
              `  ${i + 1}. [${def.pos}] ${def.definition_text || def.example}`
            );
          });
          if (word.definitions.length > 2) {
            console.log(`  ... and ${word.definitions.length - 2} more`);
          }
          console.log("");
        });
        db.close();
      })
      .catch((err) => {
        console.error("Error:", err);
        db.close();
      });
  } else if (command === "complete" && args[1]) {
    getWordComplete(args[1], args[2])
      .then((result) => {
        if (!result) {
          console.log(`Word "${args[1]}" not found.`);
          db.close();
          return;
        }

        console.log("\n=== Complete Word Information ===");
        console.log(`Word: ${result.word}`);
        console.log(`Type: ${result.type}`);
        console.log(`Sound: ${result.sound || "N/A"}`);

        console.log(`\nDefinitions (${result.definitions.length}):`);
        result.definitions.forEach((def, i) => {
          console.log(`  ${i + 1}. [${def.pos}] ${def.definition_text || ""}`);
          if (def.example) console.log(`     Example: ${def.example}`);
          if (def.local_image_path)
            console.log(`     Image: ${def.local_image_path}`);
        });

        if (result.synonyms.length > 0) {
          console.log(`\nSynonyms (${result.synonyms.length}):`);
          console.log(
            `  ${result.synonyms.slice(0, 10).join(", ")}${
              result.synonyms.length > 10 ? "..." : ""
            }`
          );
        }

        if (result.antonyms.length > 0) {
          console.log(`\nAntonyms (${result.antonyms.length}):`);
          console.log(
            `  ${result.antonyms.slice(0, 10).join(", ")}${
              result.antonyms.length > 10 ? "..." : ""
            }`
          );
        }

        if (result.similar_words.length > 0) {
          console.log(`\nSimilar Words (${result.similar_words.length}):`);
          console.log(
            `  ${result.similar_words.slice(0, 10).join(", ")}${
              result.similar_words.length > 10 ? "..." : ""
            }`
          );
        }

        console.log("");
        db.close();
      })
      .catch((err) => {
        console.error("Error:", err);
        db.close();
      });
  } else {
    console.log('Invalid command. Use "stats", "search", or "complete".');
    db.close();
  }
}

# SQLite Dictionary Database

This document explains how to use the SQLite version of the dictionary database.

## Overview

The dictionary data has been converted from JSON to SQLite for better performance, easier querying, and reduced memory usage.

## Database Schema

### Tables

1. **words** - Main table containing all dictionary words

   - `id`: Primary key (auto-increment)
   - `word`: The word itself
   - `type`: Dictionary type ('en_kh', 'kh_en', or 'kh_kh')
   - `sound`: Audio file path (if available)
   - `isFavorite`: Boolean flag (0/1) marking favorite words
   - `isHistory`: Boolean flag (0/1) marking words in search history
   - `created_at`: Timestamp

2. **definitions** - Word definitions and examples

   - `id`: Primary key
   - `word_id`: Foreign key to words table
   - `pos`: Part of speech (noun, verb, etc.)
   - `example`: Example sentence
   - `definition_text`: Definition text
   - `khmer_image_url`: Original image URL
   - `local_image_path`: Local image path

3. **synonyms** - Word synonyms

   - `id`: Primary key
   - `word_id`: Foreign key to words table
   - `synonym`: Synonym text

4. **antonyms** - Word antonyms

   - `id`: Primary key
   - `word_id`: Foreign key to words table
   - `antonym`: Antonym text

5. **similar_words** - Similar words
   - `id`: Primary key
   - `word_id`: Foreign key to words table
   - `similar_word`: Similar word text

## Files

- `data/dictionary.db` - The SQLite database file
- `src/convert_to_sqlite.js` - Script to convert JSON to SQLite
- `src/query_dictionary.js` - Helper script and API for querying the database

## Usage

### Command Line Interface

#### View Statistics

```bash
node src/query_dictionary.js stats
```

#### Search for a Word

```bash
node src/query_dictionary.js search "hello"
node src/query_dictionary.js search "hello" en_kh
```

#### Get Complete Word Information

```bash
node src/query_dictionary.js complete "hello"
node src/query_dictionary.js complete "សួស្តី" kh_en
```

### Programmatic Usage

```javascript
const dictionary = require("./src/query_dictionary");

// Search for words
const results = await dictionary.searchWord("hello");
console.log(results);

// Get complete word information
const wordInfo = await dictionary.getWordComplete("hello", "en_kh");
console.log(wordInfo);

// Get statistics
const stats = await dictionary.getStats();
console.log(stats);

// Get synonyms for a word ID
const synonyms = await dictionary.getSynonyms(123);

// Get antonyms for a word ID
const antonyms = await dictionary.getAntonyms(123);

// Get similar words for a word ID
const similar = await dictionary.getSimilarWords(123);
```

### Direct SQL Queries

You can also use any SQLite client to query the database directly:

```bash
sqlite3 data/dictionary.db
```

Example queries:

```sql
-- Search for a word
SELECT * FROM words WHERE word LIKE '%hello%';

-- Get word with definitions
SELECT w.word, w.type, d.pos, d.example, d.definition_text
FROM words w
LEFT JOIN definitions d ON w.id = d.word_id
WHERE w.word = 'hello';

-- Count words by type
SELECT type, COUNT(*) as count
FROM words
GROUP BY type;

-- Find words with most definitions
SELECT w.word, w.type, COUNT(d.id) as def_count
FROM words w
LEFT JOIN definitions d ON w.id = d.word_id
GROUP BY w.id
ORDER BY def_count DESC
LIMIT 10;

-- Search Khmer words
SELECT word, type FROM words WHERE type = 'kh_en' LIMIT 10;
```

## Statistics

- **Total Words**: 32,214
- **Total Definitions**: 54,111
- **Total Synonyms**: 73,299
- **Total Antonyms**: 9,935
- **Total Similar Words**: 41,197

### Breakdown by Dictionary Type:

- **en_kh** (English to Khmer): 21,043 words
- **kh_kh** (Khmer to Khmer): 4,686 words
- **kh_en** (Khmer to English): 6,485 words

## Benefits of SQLite

1. **Performance**: Faster queries, especially for searches
2. **Memory Efficient**: No need to load entire JSON into memory
3. **Indexing**: Fast lookups with database indexes
4. **Scalability**: Can handle millions of records efficiently
5. **Standard SQL**: Use familiar SQL queries
6. **Size**: Compressed storage, smaller file size
7. **Concurrent Access**: Multiple processes can read simultaneously
8. **ACID Compliance**: Data integrity guaranteed

## Integration with Flutter

For Flutter integration, you can use the `sqflite` package:

```dart
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class DictionaryDatabase {
  static Database? _database;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await initDatabase();
    return _database!;
  }

  Future<Database> initDatabase() async {
    String path = join(await getDatabasesPath(), 'dictionary.db');
    return await openDatabase(path, version: 1);
  }

  Future<List<Map<String, dynamic>>> searchWord(String word) async {
    final db = await database;
    return await db.rawQuery('''
      SELECT w.*, d.pos, d.example, d.definition_text
      FROM words w
      LEFT JOIN definitions d ON w.id = d.word_id
      WHERE w.word LIKE ?
    ''', ['%$word%']);
  }
}
```

## Maintenance

### Rebuild Database from JSON

If you need to rebuild the database:

```bash
node src/convert_to_sqlite.js
```

This will delete the existing database and create a fresh one from the JSON file.

### Backup

To backup the database:

```bash
cp data/dictionary.db data/dictionary_backup_$(date +%Y%m%d).db
```

## License

Same as the parent project.

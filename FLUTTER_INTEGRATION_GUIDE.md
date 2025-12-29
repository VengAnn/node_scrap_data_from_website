# Flutter Dictionary Integration Guide

## 📊 Data Overview

Your exported dictionary contains:

- **Total Words**: 32,214
- **English → Khmer**: 21,043 words
- **Khmer → Khmer**: 4,686 words
- **Khmer → English**: 6,485 words
- **Export File**: `data/dictionary_export.json`

## 🎯 Recommended Architecture: SQLite Database

### Why SQLite?

- ✅ Fast search queries (indexed)
- ✅ Small app size (~10MB compressed)
- ✅ Low memory usage
- ✅ Offline-first by default
- ✅ Perfect for 30K+ words

---

## 🚀 Implementation Steps

### Step 1: Convert JSON to SQLite Database

Create `src/create_sqlite_database.js`:

```javascript
const fs = require("fs-extra");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

async function createDatabase() {
  console.log("Creating SQLite database...");

  const db = new sqlite3.Database("dictionary.db");

  db.serialize(() => {
    // Create tables
    console.log("Creating tables...");

    db.run(`CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL,
      dictionary_type TEXT NOT NULL,
      word_type TEXT,
      pronunciation TEXT,
      sound_url TEXT,
      local_sound_path TEXT,
      created_at TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER NOT NULL,
      definition_order INTEGER,
      pos TEXT,
      definition_text TEXT,
      example TEXT,
      khmer_text TEXT,
      english_text TEXT,
      khmer_definition TEXT,
      khmer_image_url TEXT,
      local_image_path TEXT,
      FOREIGN KEY(word_id) REFERENCES words(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS synonyms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER NOT NULL,
      synonym TEXT NOT NULL,
      FOREIGN KEY(word_id) REFERENCES words(id) ON DELETE CASCADE
    )`);

    // Create indexes for fast searching
    db.run(`CREATE INDEX IF NOT EXISTS idx_word ON words(word COLLATE NOCASE)`);
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_dictionary_type ON words(dictionary_type)`
    );
    db.run(`CREATE INDEX IF NOT EXISTS idx_word_type ON words(word_type)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_word_id ON definitions(word_id)`);
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_synonym_word_id ON synonyms(word_id)`
    );

    // Full-text search virtual table
    db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS words_fts USING fts5(
      word,
      content='words',
      content_rowid='id'
    )`);

    // Triggers to keep FTS in sync
    db.run(`CREATE TRIGGER IF NOT EXISTS words_ai AFTER INSERT ON words BEGIN
      INSERT INTO words_fts(rowid, word) VALUES (new.id, new.word);
    END`);

    db.run(`CREATE TRIGGER IF NOT EXISTS words_ad AFTER DELETE ON words BEGIN
      INSERT INTO words_fts(words_fts, rowid, word) VALUES('delete', old.id, old.word);
    END`);

    db.run(`CREATE TRIGGER IF NOT EXISTS words_au AFTER UPDATE ON words BEGIN
      INSERT INTO words_fts(words_fts, rowid, word) VALUES('delete', old.id, old.word);
      INSERT INTO words_fts(rowid, word) VALUES (new.id, new.word);
    END`);
  });

  // Read exported JSON
  console.log("Reading dictionary_export.json...");
  const exportData = await fs.readJson(
    path.join(__dirname, "..", "data", "dictionary_export.json")
  );

  // Prepare statements
  const insertWord = db.prepare(`
    INSERT INTO words (word, dictionary_type, word_type, pronunciation, sound_url, local_sound_path, created_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertDef = db.prepare(`
    INSERT INTO definitions (word_id, definition_order, pos, definition_text, example, khmer_text, english_text, khmer_definition, khmer_image_url, local_image_path) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSyn = db.prepare(
    `INSERT INTO synonyms (word_id, synonym) VALUES (?, ?)`
  );

  let totalWords = 0;
  let totalDefinitions = 0;
  let totalSynonyms = 0;

  // Process each dictionary type
  for (const [dictType, entries] of Object.entries(exportData)) {
    console.log(`\nProcessing ${dictType}: ${entries.length} entries...`);

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      if (i % 1000 === 0) {
        console.log(`  Processed ${i}/${entries.length}...`);
      }

      // Insert word
      insertWord.run(
        entry.word,
        dictType,
        entry.type || entry.word_type,
        entry.pronunciation,
        entry.sound_url,
        entry.local_sound_path,
        entry.date,
        function (err) {
          if (err) {
            console.error(`Error inserting word: ${entry.word}`, err);
            return;
          }

          const wordId = this.lastID;
          totalWords++;

          // Insert definitions
          if (entry.definitions && Array.isArray(entry.definitions)) {
            entry.definitions.forEach((def, index) => {
              insertDef.run(
                wordId,
                index + 1,
                def.pos,
                def.definition,
                def.example,
                def.khmer_text,
                def.english_text,
                def.khmer_definition,
                def.khmer_image_url,
                def.local_image_path
              );
              totalDefinitions++;
            });
          }

          // Insert synonyms
          if (entry.synonyms && Array.isArray(entry.synonyms)) {
            entry.synonyms.forEach((syn) => {
              if (syn && syn.trim()) {
                insertSyn.run(wordId, syn.trim());
                totalSynonyms++;
              }
            });
          }
        }
      );
    }
  }

  // Finalize statements
  insertWord.finalize();
  insertDef.finalize();
  insertSyn.finalize();

  db.close(() => {
    console.log("\n✅ Database created successfully!");
    console.log(`📊 Statistics:`);
    console.log(`   - Words: ${totalWords}`);
    console.log(`   - Definitions: ${totalDefinitions}`);
    console.log(`   - Synonyms: ${totalSynonyms}`);
    console.log(`📁 File: dictionary.db`);
  });
}

createDatabase().catch(console.error);
```

**Install dependencies and run:**

```bash
npm install sqlite3
node src/create_sqlite_database.js
```

---

### Step 2: Flutter Project Setup

#### 2.1 Add Dependencies

Edit `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter

  # Database
  sqflite: ^2.3.0
  path: ^1.8.3
  path_provider: ^2.1.1

  # Optional: For better UI
  cached_network_image: ^3.3.0 # For images
  audioplayers: ^5.2.1 # For pronunciation sounds
  flutter_highlight: ^0.7.0 # For formatted text

flutter:
  assets:
    - assets/dictionary.db
    - assets/images/
    - assets/sounds/
```

---

### Step 3: Create Flutter Database Helper

Create `lib/services/database_helper.dart`:

```dart
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'package:flutter/services.dart';
import 'dart:io';

class DatabaseHelper {
  static final DatabaseHelper instance = DatabaseHelper._init();
  static Database? _database;

  DatabaseHelper._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('dictionary.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    // Check if database exists
    if (!await databaseExists(path)) {
      print('Copying database from assets...');

      // Copy from assets
      ByteData data = await rootBundle.load('assets/$filePath');
      List<int> bytes = data.buffer.asUint8List();
      await File(path).writeAsBytes(bytes, flush: true);

      print('Database copied successfully');
    }

    return await openDatabase(path, version: 1);
  }

  // Search words with full-text search
  Future<List<Map<String, dynamic>>> searchWords(
    String query, {
    String? dictionaryType,
    int limit = 50,
  }) async {
    final db = await instance.database;

    if (query.isEmpty) {
      return [];
    }

    // Use FTS for better search
    String sql = '''
      SELECT w.* FROM words w
      INNER JOIN words_fts fts ON w.id = fts.rowid
      WHERE words_fts MATCH ?
    ''';

    List<dynamic> args = [query + '*'];

    if (dictionaryType != null) {
      sql += ' AND w.dictionary_type = ?';
      args.add(dictionaryType);
    }

    sql += ' ORDER BY w.word LIMIT ?';
    args.add(limit);

    return await db.rawQuery(sql, args);
  }

  // Search with LIKE (fallback for exact matches)
  Future<List<Map<String, dynamic>>> searchWordsLike(
    String query, {
    String? dictionaryType,
    int limit = 50,
  }) async {
    final db = await instance.database;

    String sql = 'SELECT * FROM words WHERE word LIKE ?';
    List<dynamic> args = ['%$query%'];

    if (dictionaryType != null) {
      sql += ' AND dictionary_type = ?';
      args.add(dictionaryType);
    }

    sql += ' ORDER BY word LIMIT ?';
    args.add(limit);

    return await db.rawQuery(sql, args);
  }

  // Get word details with definitions and synonyms
  Future<Map<String, dynamic>?> getWordDetails(int wordId) async {
    final db = await instance.database;

    // Get word
    final words = await db.query('words', where: 'id = ?', whereArgs: [wordId]);
    if (words.isEmpty) return null;

    // Get definitions
    final definitions = await db.query(
      'definitions',
      where: 'word_id = ?',
      whereArgs: [wordId],
      orderBy: 'definition_order',
    );

    // Get synonyms
    final synonyms = await db.query(
      'synonyms',
      where: 'word_id = ?',
      whereArgs: [wordId],
    );

    return {
      'word': words.first,
      'definitions': definitions,
      'synonyms': synonyms.map((s) => s['synonym']).toList(),
    };
  }

  // Get random words (for "Word of the Day" feature)
  Future<List<Map<String, dynamic>>> getRandomWords({
    String? dictionaryType,
    int count = 10,
  }) async {
    final db = await instance.database;

    String sql = 'SELECT * FROM words';
    List<dynamic> args = [];

    if (dictionaryType != null) {
      sql += ' WHERE dictionary_type = ?';
      args.add(dictionaryType);
    }

    sql += ' ORDER BY RANDOM() LIMIT ?';
    args.add(count);

    return await db.rawQuery(sql, args);
  }

  // Get word count statistics
  Future<Map<String, int>> getStatistics() async {
    final db = await instance.database;

    final result = await db.rawQuery('''
      SELECT
        dictionary_type,
        COUNT(*) as count
      FROM words
      GROUP BY dictionary_type
    ''');

    Map<String, int> stats = {};
    for (var row in result) {
      stats[row['dictionary_type'] as String] = row['count'] as int;
    }

    return stats;
  }

  Future<void> close() async {
    final db = await instance.database;
    db.close();
  }
}
```

---

### Step 4: Create Models

Create `lib/models/word_entry.dart`:

```dart
class WordEntry {
  final int id;
  final String word;
  final String dictionaryType;
  final String? wordType;
  final String? pronunciation;
  final String? soundUrl;
  final String? localSoundPath;
  final List<Definition> definitions;
  final List<String> synonyms;

  WordEntry({
    required this.id,
    required this.word,
    required this.dictionaryType,
    this.wordType,
    this.pronunciation,
    this.soundUrl,
    this.localSoundPath,
    this.definitions = const [],
    this.synonyms = const [],
  });

  factory WordEntry.fromMap(Map<String, dynamic> map) {
    return WordEntry(
      id: map['id'] as int,
      word: map['word'] as String,
      dictionaryType: map['dictionary_type'] as String,
      wordType: map['word_type'] as String?,
      pronunciation: map['pronunciation'] as String?,
      soundUrl: map['sound_url'] as String?,
      localSoundPath: map['local_sound_path'] as String?,
    );
  }

  String get displayDictionaryType {
    switch (dictionaryType) {
      case 'en_kh':
        return 'English → Khmer';
      case 'kh_en':
        return 'Khmer → English';
      case 'kh_kh':
        return 'Khmer → Khmer';
      default:
        return dictionaryType;
    }
  }
}

class Definition {
  final int id;
  final int wordId;
  final int? order;
  final String? pos;
  final String? definitionText;
  final String? example;
  final String? khmerText;
  final String? englishText;
  final String? khmerDefinition;
  final String? khmerImageUrl;
  final String? localImagePath;

  Definition({
    required this.id,
    required this.wordId,
    this.order,
    this.pos,
    this.definitionText,
    this.example,
    this.khmerText,
    this.englishText,
    this.khmerDefinition,
    this.khmerImageUrl,
    this.localImagePath,
  });

  factory Definition.fromMap(Map<String, dynamic> map) {
    return Definition(
      id: map['id'] as int,
      wordId: map['word_id'] as int,
      order: map['definition_order'] as int?,
      pos: map['pos'] as String?,
      definitionText: map['definition_text'] as String?,
      example: map['example'] as String?,
      khmerText: map['khmer_text'] as String?,
      englishText: map['english_text'] as String?,
      khmerDefinition: map['khmer_definition'] as String?,
      khmerImageUrl: map['khmer_image_url'] as String?,
      localImagePath: map['local_image_path'] as String?,
    );
  }
}
```

---

### Step 5: Create Search Screen

Create `lib/screens/search_screen.dart`:

```dart
import 'package:flutter/material.dart';
import '../services/database_helper.dart';
import '../models/word_entry.dart';
import 'word_detail_screen.dart';

class SearchScreen extends StatefulWidget {
  @override
  _SearchScreenState createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  List<Map<String, dynamic>> _searchResults = [];
  bool _isLoading = false;
  String _selectedDictionary = 'all';

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_onSearchChanged);
  }

  void _onSearchChanged() {
    if (_searchController.text.length >= 2) {
      _performSearch(_searchController.text);
    } else {
      setState(() {
        _searchResults = [];
      });
    }
  }

  Future<void> _performSearch(String query) async {
    setState(() {
      _isLoading = true;
    });

    try {
      final results = await DatabaseHelper.instance.searchWords(
        query,
        dictionaryType: _selectedDictionary == 'all' ? null : _selectedDictionary,
      );

      setState(() {
        _searchResults = results;
        _isLoading = false;
      });
    } catch (e) {
      print('Search error: $e');
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Dictionary'),
        bottom: PreferredSize(
          preferredSize: Size.fromHeight(120),
          child: Column(
            children: [
              Padding(
                padding: EdgeInsets.all(16),
                child: TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Search words...',
                    prefixIcon: Icon(Icons.search),
                    suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: Icon(Icons.clear),
                            onPressed: () {
                              _searchController.clear();
                            },
                          )
                        : null,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    filled: true,
                    fillColor: Colors.white,
                  ),
                ),
              ),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    _buildFilterChip('All', 'all'),
                    SizedBox(width: 8),
                    _buildFilterChip('EN → KH', 'en_kh'),
                    SizedBox(width: 8),
                    _buildFilterChip('KH → EN', 'kh_en'),
                    SizedBox(width: 8),
                    _buildFilterChip('KH → KH', 'kh_kh'),
                  ],
                ),
              ),
              SizedBox(height: 16),
            ],
          ),
        ),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildFilterChip(String label, String value) {
    return FilterChip(
      label: Text(label),
      selected: _selectedDictionary == value,
      onSelected: (selected) {
        setState(() {
          _selectedDictionary = value;
        });
        if (_searchController.text.isNotEmpty) {
          _performSearch(_searchController.text);
        }
      },
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return Center(child: CircularProgressIndicator());
    }

    if (_searchController.text.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search, size: 64, color: Colors.grey),
            SizedBox(height: 16),
            Text(
              'Start typing to search',
              style: TextStyle(fontSize: 18, color: Colors.grey),
            ),
          ],
        ),
      );
    }

    if (_searchResults.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off, size: 64, color: Colors.grey),
            SizedBox(height: 16),
            Text(
              'No results found',
              style: TextStyle(fontSize: 18, color: Colors.grey),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      itemCount: _searchResults.length,
      itemBuilder: (context, index) {
        final word = _searchResults[index];
        return ListTile(
          title: Text(
            word['word'],
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          subtitle: Text(
            '${word['dictionary_type']} ${word['word_type'] ?? ''}',
          ),
          trailing: Icon(Icons.arrow_forward_ios, size: 16),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => WordDetailScreen(wordId: word['id']),
              ),
            );
          },
        );
      },
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}
```

---

### Step 6: Create Word Detail Screen

Create `lib/screens/word_detail_screen.dart`:

```dart
import 'package:flutter/material.dart';
import '../services/database_helper.dart';

class WordDetailScreen extends StatefulWidget {
  final int wordId;

  const WordDetailScreen({required this.wordId});

  @override
  _WordDetailScreenState createState() => _WordDetailScreenState();
}

class _WordDetailScreenState extends State<WordDetailScreen> {
  Map<String, dynamic>? _wordData;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadWordDetails();
  }

  Future<void> _loadWordDetails() async {
    final data = await DatabaseHelper.instance.getWordDetails(widget.wordId);
    setState(() {
      _wordData = data;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_wordData == null) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(child: Text('Word not found')),
      );
    }

    final word = _wordData!['word'] as Map<String, dynamic>;
    final definitions = _wordData!['definitions'] as List<Map<String, dynamic>>;
    final synonyms = _wordData!['synonyms'] as List<dynamic>;

    return Scaffold(
      appBar: AppBar(
        title: Text(word['word']),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Word Header
            Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      word['word'],
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(height: 8),
                    if (word['word_type'] != null)
                      Text(
                        word['word_type'],
                        style: TextStyle(
                          fontSize: 16,
                          color: Colors.grey[600],
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    if (word['pronunciation'] != null)
                      Text(
                        word['pronunciation'],
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.grey[600],
                        ),
                      ),
                  ],
                ),
              ),
            ),

            SizedBox(height: 16),

            // Definitions
            if (definitions.isNotEmpty) ...[
              Text(
                'Definitions',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 8),
              ...definitions.asMap().entries.map((entry) {
                final index = entry.key;
                final def = entry.value;
                return Card(
                  margin: EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (def['pos'] != null)
                          Text(
                            '${index + 1}. ${def['pos']}',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Colors.blue,
                            ),
                          ),
                        SizedBox(height: 8),
                        if (def['definition_text'] != null)
                          Text(def['definition_text']),
                        if (def['khmer_text'] != null)
                          Text(
                            def['khmer_text'],
                            style: TextStyle(fontSize: 18),
                          ),
                        if (def['example'] != null) ...[
                          SizedBox(height: 8),
                          Text(
                            'Example:',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                          Text(
                            def['example'],
                            style: TextStyle(fontStyle: FontStyle.italic),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              }).toList(),
            ],

            // Synonyms
            if (synonyms.isNotEmpty) ...[
              SizedBox(height: 16),
              Text(
                'Synonyms',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: synonyms.map((syn) {
                  return Chip(
                    label: Text(syn.toString()),
                  );
                }).toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
```

---

## 📱 Complete App Structure

```
lib/
├── main.dart
├── models/
│   └── word_entry.dart
├── services/
│   └── database_helper.dart
├── screens/
│   ├── search_screen.dart
│   └── word_detail_screen.dart
└── widgets/
    └── (custom widgets)

assets/
├── dictionary.db
├── images/
└── sounds/
```

---

## 🎯 Testing the Integration

### Test the Database

```dart
void testDatabase() async {
  final db = DatabaseHelper.instance;

  // Test statistics
  final stats = await db.getStatistics();
  print('Dictionary statistics: $stats');

  // Test search
  final results = await db.searchWords('hello');
  print('Search results: ${results.length}');

  // Test word details
  if (results.isNotEmpty) {
    final details = await db.getWordDetails(results.first['id']);
    print('Word details: $details');
  }
}
```

---

## 🚀 Performance Tips

1. **Database Size**: ~15-20MB uncompressed
2. **First Launch**: Copy database takes 1-2 seconds
3. **Search Speed**: <50ms for most queries
4. **Memory Usage**: Only loads what's needed

### Optimization

```dart
// Add pagination for large result sets
Future<List<Map<String, dynamic>>> searchWithPagination(
  String query,
  int page,
  int pageSize,
) async {
  final offset = page * pageSize;
  // Add LIMIT and OFFSET to queries
}
```

---

## 📦 Building the App

```bash
# Clean and get dependencies
flutter clean
flutter pub get

# Run on device
flutter run

# Build APK
flutter build apk --release

# Build iOS
flutter build ios --release
```

---

## 🎨 Additional Features to Implement

1. **Favorites/Bookmarks**: Add user's saved words
2. **History**: Track recently viewed words
3. **Word of the Day**: Random word feature
4. **Dark Mode**: Theme switching
5. **Text-to-Speech**: Pronunciation audio
6. **Offline Mode**: Already built-in!
7. **Search Suggestions**: Autocomplete

---

## 📊 Database Schema Reference

### Tables:

- `words`: Main word entries
- `definitions`: Word definitions and examples
- `synonyms`: Related words
- `words_fts`: Full-text search index

### Indexes:

- Fast word lookup
- Dictionary type filtering
- Full-text search capability

---

## 🐛 Troubleshooting

### Database not copying

```dart
// Add debug logging
print('Database path: $path');
print('Database exists: ${await databaseExists(path)}');
```

### Search not working

```dart
// Use LIKE fallback if FTS fails
final results = await db.searchWordsLike(query);
```

### Large memory usage

```dart
// Implement pagination
// Load only visible items
// Clear cache periodically
```

---

## 📱 Example main.dart

```dart
import 'package:flutter/material.dart';
import 'screens/search_screen.dart';

void main() {
  runApp(DictionaryApp());
}

class DictionaryApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Dictionary',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        visualDensity: VisualDensity.adaptivePlatformDensity,
      ),
      home: SearchScreen(),
    );
  }
}
```

---

## ✅ Checklist

- [ ] Export JSON to `dictionary_export.json`
- [ ] Install `sqlite3` package
- [ ] Run `create_sqlite_database.js`
- [ ] Copy `dictionary.db` to Flutter `assets/` folder
- [ ] Update `pubspec.yaml` with assets and dependencies
- [ ] Copy Flutter code files
- [ ] Run `flutter pub get`
- [ ] Test on device
- [ ] Optimize for production

---

## 📞 Support

For issues or questions:

- Check database file size (~15-20MB)
- Verify asset paths in pubspec.yaml
- Enable debug logging in database_helper.dart
- Test on real device (not just emulator)

---

**Total Implementation Time**: ~4-6 hours
**App Size**: ~20-25MB (with database)
**Supported Platforms**: iOS, Android, Web* (*with adjustments)

Good luck with your dictionary app! 🎉

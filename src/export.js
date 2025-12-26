const fs = require('fs-extra');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'dictionary_export.json');

async function exportData() {
    const modes = ['en_kh', 'kh_kh', 'kh_en'];
    const exportData = {
        en_kh: [],
        kh_kh: [],
        kh_en: []
    };

    for (const mode of modes) {
        const modeDir = path.join(DATA_DIR, mode);
        if (!(await fs.pathExists(modeDir))) continue;

        const files = await fs.readdir(modeDir);
        console.log(`Exporting ${mode}: ${files.length} files...`);

        for (const file of files) {
            if (file.endsWith('.json')) {
                const content = await fs.readJson(path.join(modeDir, file));
                exportData[mode].push(content);
            }
        }
    }

    await fs.writeJson(OUTPUT_FILE, exportData, { spaces: 2 });
    console.log(`\nSuccessfully exported all data to: ${OUTPUT_FILE}`);
    console.log(`Total words: ${exportData.en_kh.length + exportData.kh_kh.length + exportData.kh_en.length}`);
}

exportData().catch(console.error);

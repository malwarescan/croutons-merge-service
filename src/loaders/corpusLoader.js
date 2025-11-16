import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CORPUS_DIR = join(__dirname, '../../../corpus');

export function loadCorpusFiles(filename) {
  try {
    const filepath = join(CORPUS_DIR, filename);
    const content = readFileSync(filepath, 'utf-8');

    if (filename.endsWith('.ndjson')) {
      return content
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line);
          } catch (e) {
            console.warn(`[corpus] Failed to parse line in ${filename}:`, e.message);
            return null;
          }
        })
        .filter(item => item !== null);
    } else if (filename.endsWith('.json')) {
      return JSON.parse(content);
    }

    return null;
  } catch (error) {
    console.warn(`[corpus] Failed to load ${filename}:`, error.message);
    return null;
  }
}


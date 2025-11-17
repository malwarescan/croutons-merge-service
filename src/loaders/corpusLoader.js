import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Try multiple paths: relative to loader, relative to project root, absolute
const CORPUS_DIR = process.env.CORPUS_DIR || 
  (existsSync(join(__dirname, '../../../corpus')) ? join(__dirname, '../../../corpus') :
   existsSync(join(process.cwd(), 'corpus')) ? join(process.cwd(), 'corpus') :
   join(__dirname, '../../../corpus')); // fallback

export function loadCorpusFiles(filename) {
  try {
    const filepath = join(CORPUS_DIR, filename);
    
    // Debug logging
    console.log(`[corpus] Loading ${filename} from ${filepath}`);
    console.log(`[corpus] CORPUS_DIR: ${CORPUS_DIR}`);
    console.log(`[corpus] File exists: ${existsSync(filepath)}`);
    
    if (!existsSync(filepath)) {
      console.warn(`[corpus] File not found: ${filepath}`);
      return null;
    }
    
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


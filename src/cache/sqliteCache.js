import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_DIR = join(__dirname, '../../db');
const DB_PATH = join(DB_DIR, 'cache.sqlite');

// Ensure db directory exists
if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS shops (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    district TEXT,
    rating REAL,
    review_count INTEGER,
    prettiest_women TEXT,
    pricing TEXT,
    line_usernames TEXT,
    websites TEXT,
    verified BOOLEAN DEFAULT 0,
    safety_signals TEXT,
    data_sources TEXT,
    last_updated TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_district ON shops(district);
  CREATE INDEX IF NOT EXISTS idx_rating ON shops(rating DESC);
  CREATE INDEX IF NOT EXISTS idx_verified ON shops(verified);

  CREATE TABLE IF NOT EXISTS districts (
    name TEXT PRIMARY KEY,
    profile TEXT,
    last_updated TEXT
  );

  CREATE TABLE IF NOT EXISTS pricing_reference (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    district TEXT,
    massage_type TEXT,
    price_low REAL,
    price_high REAL,
    price_typical REAL,
    currency TEXT
  );
`);

export class SQLiteCache {
  constructor() {
    this.db = db;
  }

  getShops(district = null) {
    try {
      const query = district
        ? 'SELECT * FROM shops WHERE district = ? ORDER BY rating DESC'
        : 'SELECT * FROM shops ORDER BY rating DESC';
      
      const rows = district
        ? db.prepare(query).all(district)
        : db.prepare(query).all();
      
      return rows.map(row => ({
        ...row,
        prettiest_women: JSON.parse(row.prettiest_women || '[]'),
        pricing: JSON.parse(row.pricing || '[]'),
        line_usernames: JSON.parse(row.line_usernames || '[]'),
        websites: JSON.parse(row.websites || '[]'),
        safety_signals: JSON.parse(row.safety_signals || '[]'),
        data_sources: JSON.parse(row.data_sources || '[]'),
        verified: Boolean(row.verified),
      }));
    } catch (e) {
      console.error('[sqlite] Get shops error:', e.message);
      return [];
    }
  }

  saveShops(shops) {
    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO shops VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insert = db.transaction((shops) => {
        for (const shop of shops) {
          stmt.run(
            shop.id || this.generateId(shop.name),
            shop.name,
            shop.address || null,
            shop.district || null,
            shop.rating || null,
            shop.review_count || null,
            JSON.stringify(shop.prettiest_women || []),
            JSON.stringify(shop.pricing || []),
            JSON.stringify(shop.line_usernames || []),
            JSON.stringify(shop.websites || []),
            shop.verified ? 1 : 0,
            JSON.stringify(shop.safety_signals || []),
            JSON.stringify(shop.data_sources || []),
            new Date().toISOString(),
            new Date().toISOString(),
          );
        }
      });

      insert(shops);
    } catch (e) {
      console.error('[sqlite] Save shops error:', e.message);
      throw e;
    }
  }

  getDistrictProfiles() {
    try {
      const rows = db.prepare('SELECT * FROM districts').all();
      return rows.map(row => ({
        name: row.name,
        profile: JSON.parse(row.profile || '{}'),
        last_updated: row.last_updated,
      }));
    } catch (e) {
      console.error('[sqlite] Get districts error:', e.message);
      return [];
    }
  }

  saveDistrictProfiles(profiles) {
    try {
      const stmt = db.prepare('INSERT OR REPLACE INTO districts VALUES (?, ?, ?)');
      const insert = db.transaction((profiles) => {
        for (const profile of profiles) {
          stmt.run(profile.name, JSON.stringify(profile), new Date().toISOString());
        }
      });
      insert(profiles);
    } catch (e) {
      console.error('[sqlite] Save districts error:', e.message);
    }
  }

  getPricingReference() {
    try {
      return db.prepare('SELECT * FROM pricing_reference').all();
    } catch (e) {
      console.error('[sqlite] Get pricing error:', e.message);
      return [];
    }
  }

  savePricingReference(pricing) {
    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO pricing_reference (district, massage_type, price_low, price_high, price_typical, currency)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const insert = db.transaction((pricing) => {
        for (const p of pricing) {
          stmt.run(
            p.district,
            p.massage_type,
            p.price_low,
            p.price_high,
            p.price_typical,
            p.currency || 'THB'
          );
        }
      });
      insert(pricing);
    } catch (e) {
      console.error('[sqlite] Save pricing error:', e.message);
    }
  }

  generateId(name) {
    return require('crypto')
      .createHash('sha256')
      .update(name)
      .digest('hex')
      .substring(0, 16);
  }
}


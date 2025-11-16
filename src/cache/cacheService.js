import { RedisCache } from './redisCache.js';
import { SQLiteCache } from './sqliteCache.js';
import { loadCorpusFiles } from '../loaders/corpusLoader.js';

export class CacheService {
  constructor() {
    this.redis = process.env.REDIS_URL ? new RedisCache() : null;
    this.sqlite = new SQLiteCache();
  }

  async getShops(district = null) {
    // Layer 1: Try Redis
    if (this.redis) {
      try {
        const cached = await this.redis.getShops(district);
        if (cached) {
          console.log(`[cache] Redis hit for shops${district ? ` in ${district}` : ''}`);
          return cached;
        }
      } catch (e) {
        console.warn('[cache] Redis error, falling back:', e.message);
      }
    }

    // Layer 2: Try SQLite
    try {
      const sqliteShops = this.sqlite.getShops(district);
      if (sqliteShops && sqliteShops.length > 0) {
        const lastUpdated = sqliteShops[0]?.last_updated;
        if (lastUpdated && this.isRecent(lastUpdated, 3600)) { // 1 hour
          console.log(`[cache] SQLite hit for shops${district ? ` in ${district}` : ''}`);
          
          // Warm Redis cache
          if (this.redis) {
            try {
              await this.redis.setShops(sqliteShops, district);
            } catch (e) {
              // Ignore Redis warming errors
            }
          }
          
          return sqliteShops;
        }
      }
    } catch (e) {
      console.warn('[cache] SQLite error:', e.message);
    }

    // Layer 3: Load from corpus
    console.log(`[cache] Cache miss, loading from corpus`);
    try {
      const corpusShops = loadCorpusFiles('shops_verified.ndjson');
      
      if (corpusShops && corpusShops.length > 0) {
        // Warm both caches
        try {
          this.sqlite.saveShops(corpusShops);
        } catch (e) {
          console.warn('[cache] Failed to save to SQLite:', e.message);
        }
        
        if (this.redis) {
          try {
            await this.redis.setShops(corpusShops, district);
          } catch (e) {
            console.warn('[cache] Failed to save to Redis:', e.message);
          }
        }
        
        return corpusShops;
      }
    } catch (e) {
      console.warn('[cache] Corpus load error:', e.message);
    }

    return [];
  }

  async updateShops(shops) {
    // Update both caches
    try {
      this.sqlite.saveShops(shops);
    } catch (e) {
      console.error('[cache] Failed to update SQLite:', e.message);
    }
    
    if (this.redis) {
      try {
        await this.redis.setShops(shops);
        await this.redis.setLastUpdated(new Date().toISOString());
      } catch (e) {
        console.error('[cache] Failed to update Redis:', e.message);
      }
    }
  }

  async getDistrictProfiles() {
    if (this.redis) {
      try {
        const cached = await this.redis.getDistrictProfiles();
        if (cached) return cached;
      } catch (e) {
        // Fall through
      }
    }

    try {
      const sqlite = this.sqlite.getDistrictProfiles();
      if (sqlite && sqlite.length > 0) {
        if (this.redis) {
          try {
            await this.redis.setDistrictProfiles(sqlite);
          } catch (e) {
            // Ignore
          }
        }
        return sqlite;
      }
    } catch (e) {
      console.warn('[cache] SQLite districts error:', e.message);
    }

    // Load from corpus
    try {
      const profiles = loadCorpusFiles('district_profiles.json');
      if (profiles) {
        // Convert NDJSON to array if needed
        return Array.isArray(profiles) ? profiles : [profiles];
      }
    } catch (e) {
      console.warn('[cache] Corpus districts error:', e.message);
    }

    return [];
  }

  async getPricingReference() {
    if (this.redis) {
      try {
        const cached = await this.redis.getPricingReference();
        if (cached) return cached;
      } catch (e) {
        // Fall through
      }
    }

    try {
      const sqlite = this.sqlite.getPricingReference();
      if (sqlite && sqlite.length > 0) {
        if (this.redis) {
          try {
            await this.redis.setPricingReference(sqlite);
          } catch (e) {
            // Ignore
          }
        }
        return sqlite;
      }
    } catch (e) {
      console.warn('[cache] SQLite pricing error:', e.message);
    }

    // Load from corpus
    try {
      const pricing = loadCorpusFiles('pricing_reference.json');
      if (pricing) {
        return Array.isArray(pricing) ? pricing : [pricing];
      }
    } catch (e) {
      console.warn('[cache] Corpus pricing error:', e.message);
    }

    return [];
  }

  isRecent(timestamp, maxAgeSeconds = 3600) {
    try {
      const age = (Date.now() - new Date(timestamp).getTime()) / 1000;
      return age < maxAgeSeconds;
    } catch (e) {
      return false;
    }
  }
}


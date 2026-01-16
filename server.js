/* jshint node: true, esversion: 11 */
import express from 'express';
import cors from 'cors';
import { RedisCache } from './src/cache/redisCache.js';
import { SQLiteCache } from './src/cache/sqliteCache.js';
import { CacheService } from './src/cache/cacheService.js';
import { BkkMassageMergeService } from './src/services/bkkMassageMerge.js';
import { loadCorpusFiles } from './src/loaders/corpusLoader.js';
import { crawlAndClassifyPages } from './src/routes/crawl.js';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const mergeService = new BkkMassageMergeService();
const cacheService = mergeService.cache;

// Health check endpoint (main)
app.get('/v1/health', async (req, res) => {
  try {
    const health = {
      ok: true,
      service: 'croutons-merge-service',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      checks: {
        redis: 'unknown',
        sqlite: 'unknown',
        corpus: 'unknown',
      },
    };

    // Check Redis
    if (process.env.REDIS_URL) {
      try {
        const redisCache = mergeService.cache.redis;
        if (redisCache) {
          const pingResult = await redisCache.ping();
          health.checks.redis = pingResult ? 'connected' : 'connection_failed';
        } else {
          health.checks.redis = 'not_initialized';
        }
      } catch (e) {
        health.checks.redis = `error: ${e.message}`;
      }
    } else {
      health.checks.redis = 'not_configured';
    }

    // Check SQLite
    try {
      const sqlite = mergeService.cache.sqlite;
      if (sqlite) {
        sqlite.db.prepare('SELECT 1').get();
        health.checks.sqlite = 'connected';
      } else {
        health.checks.sqlite = 'error';
      }
    } catch (e) {
      health.checks.sqlite = `error: ${e.message}`;
    }

    // Check corpus files
    try {
      const shops = loadCorpusFiles('shops_verified.ndjson');
      health.checks.corpus = shops && shops.length > 0 ? `loaded (${shops.length} shops)` : 'empty';
    } catch (e) {
      health.checks.corpus = `error: ${e.message}`;
    }

    const allOk = Object.values(health.checks).every(
      check => check === 'connected' || check === 'not_configured' || check.includes('loaded')
    );

    res.status(allOk ? 200 : 503).json(health);
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// POST /v1/merge/bkk_massage
// Merge live Google Maps data with corpus
app.post('/v1/merge/bkk_massage', async (req, res) => {
  try {
    const { liveShops, district, mergeStrategy, content, task, region } = req.body;

    // If liveShops provided, merge them
    if (liveShops && Array.isArray(liveShops)) {
      const merged = await mergeService.mergeShopData(liveShops, {
        district: district || region,
        mergeStrategy: mergeStrategy || 'enrich_with_corpus',
      });

      return res.json({
        ok: true,
        shops: merged,
        count: merged.length,
        merged_at: new Date().toISOString(),
      });
    }

    // Otherwise, return cached/merged data
    const shops = await cacheService.getShops(district || region || null);

    res.json({
      ok: true,
      shops,
      count: shops.length,
      source: 'cache',
      cached_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[merge] Error:', error);
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// GET /v1/shops
// Get merged shops from cache
app.get('/v1/shops', async (req, res) => {
  try {
    const { district, region } = req.query;
    const shops = await cacheService.getShops(district || region || null);

    res.json({
      ok: true,
      shops,
      count: shops.length,
      source: 'cache',
    });
  } catch (error) {
    console.error('[shops] Error:', error);
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// GET /v1/districts
// Get district profiles
app.get('/v1/districts', async (req, res) => {
  try {
    const districts = await cacheService.getDistrictProfiles();

    res.json({
      ok: true,
      districts,
      count: districts.length,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// GET /v1/pricing
// Get pricing reference
app.get('/v1/pricing', async (req, res) => {
  try {
    const { district } = req.query;
    let pricing = await cacheService.getPricingReference();

    if (district) {
      pricing = pricing.filter(p => p.district === district);
    }

    res.json({
      ok: true,
      pricing,
      count: pricing.length,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// Health check for merge endpoint (lightweight)
app.get('/v1/merge/health', (req, res) => {
  res.json({
    status: 'ok',
    connected: true,
    time: new Date().toISOString(),
    service: 'croutons-merge-service',
  });
});

// POST /v1/crawl/discover
// Crawl-based truth page discovery
app.post('/v1/crawl/discover', crawlAndClassifyPages);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'croutons-merge-service',
    version: '1.0.0',
    endpoints: {
      health: '/v1/health',
      merge: 'POST /v1/merge/bkk_massage',
      shops: 'GET /v1/shops?district=Asok',
      districts: 'GET /v1/districts',
      pricing: 'GET /v1/pricing?district=Asok',
      crawl: 'POST /v1/crawl/discover',
    },
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('[server] Error:', err);
  res.status(500).json({
    ok: false,
    error: err.message || 'Internal server error',
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] Croutons Merge Service listening on port ${PORT}`);
  console.log(`[server] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[server] Redis: ${process.env.REDIS_URL ? 'configured' : 'not configured'}`);
  
  // Verify startup
  verifyStartup();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('[server] Process terminated');
    process.exit(0);
  });
});

// Startup verification
async function verifyStartup() {
  try {
    console.log('[startup] Verifying services...');
    
    // Check SQLite
    const sqlite = mergeService.cache.sqlite;
    if (sqlite) {
      sqlite.db.prepare('SELECT 1').get();
      console.log('[startup] ✅ SQLite connected');
    }
    
    // Check Redis (if configured)
    if (process.env.REDIS_URL) {
      const redis = mergeService.cache.redis;
      if (redis) {
        await redis.ping();
        console.log('[startup] ✅ Redis connected');
      }
    } else {
      console.log('[startup] ⚠️  Redis not configured (optional)');
    }
    
    // Check corpus files
    const shops = loadCorpusFiles('shops_verified.ndjson');
    if (shops && shops.length > 0) {
      console.log(`[startup] ✅ Corpus loaded (${shops.length} shops)`);
    } else {
      console.log('[startup] ⚠️  Corpus files not found or empty');
    }
    
    console.log('[startup] ✅ Service ready');
  } catch (error) {
    console.error('[startup] ⚠️  Verification warning:', error.message);
    // Don't exit - service can still work with partial functionality
  }
}


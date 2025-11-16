import Redis from 'ioredis';

let redis = null;

function getRedis() {
  if (!redis && process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redis.on('error', (err) => {
      console.error('[redis] Error:', err.message);
    });

    redis.on('connect', () => {
      console.log('[redis] Connected');
    });
  }
  return redis;
}

const CACHE_KEYS = {
  shops: 'bkk_massage:shops',
  shopsByDistrict: (district) => `bkk_massage:shops:district:${district}`,
  shopsByRating: 'bkk_massage:shops:rating:sorted',
  districtProfiles: 'bkk_massage:districts',
  pricingReference: 'bkk_massage:pricing',
  lastUpdated: 'bkk_massage:last_updated',
};

export class RedisCache {
  constructor() {
    this.redis = getRedis();
  }

  async ping() {
    if (!this.redis) return false;
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (e) {
      return false;
    }
  }

  async getShops(district = null) {
    if (!this.redis) return null;
    try {
      const key = district ? CACHE_KEYS.shopsByDistrict(district) : CACHE_KEYS.shops;
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      console.error('[redis] Get shops error:', e.message);
      return null;
    }
  }

  async setShops(shops, district = null, ttl = 3600) {
    if (!this.redis) return;
    try {
      const key = district ? CACHE_KEYS.shopsByDistrict(district) : CACHE_KEYS.shops;
      await this.redis.setex(key, ttl, JSON.stringify(shops));
      
      // Also update sorted by rating
      const sorted = [...shops].sort((a, b) => (b.rating || 0) - (a.rating || 0));
      await this.redis.setex(CACHE_KEYS.shopsByRating, ttl, JSON.stringify(sorted));
    } catch (e) {
      console.error('[redis] Set shops error:', e.message);
    }
  }

  async getDistrictProfiles() {
    if (!this.redis) return null;
    try {
      const cached = await this.redis.get(CACHE_KEYS.districtProfiles);
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  }

  async setDistrictProfiles(profiles, ttl = 86400) {
    if (!this.redis) return;
    try {
      await this.redis.setex(CACHE_KEYS.districtProfiles, ttl, JSON.stringify(profiles));
    } catch (e) {
      console.error('[redis] Set districts error:', e.message);
    }
  }

  async getPricingReference() {
    if (!this.redis) return null;
    try {
      const cached = await this.redis.get(CACHE_KEYS.pricingReference);
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  }

  async setPricingReference(pricing, ttl = 86400) {
    if (!this.redis) return;
    try {
      await this.redis.setex(CACHE_KEYS.pricingReference, ttl, JSON.stringify(pricing));
    } catch (e) {
      console.error('[redis] Set pricing error:', e.message);
    }
  }

  async getLastUpdated() {
    if (!this.redis) return null;
    try {
      return await this.redis.get(CACHE_KEYS.lastUpdated);
    } catch (e) {
      return null;
    }
  }

  async setLastUpdated(timestamp) {
    if (!this.redis) return;
    try {
      await this.redis.set(CACHE_KEYS.lastUpdated, timestamp);
    } catch (e) {
      console.error('[redis] Set last updated error:', e.message);
    }
  }
}


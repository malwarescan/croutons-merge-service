import { CacheService } from '../cache/cacheService.js';
import crypto from 'crypto';

export class BkkMassageMergeService {
  constructor() {
    this.cache = new CacheService();
  }

  /**
   * Merge live Google Maps data with corpus data
   */
  async mergeShopData(liveShops, options = {}) {
    const {
      mergeStrategy = 'enrich_with_corpus',
      district = null,
    } = options;

    // Load corpus data
    const corpusShops = await this.cache.getShops(district);
    const districtProfiles = await this.cache.getDistrictProfiles();
    const pricingReference = await this.cache.getPricingReference();

    // Merge each live shop
    const mergedShops = liveShops.map(liveShop => {
      const corpusMatch = this.findMatchingShop(liveShop, corpusShops);
      const shopDistrict = this.extractDistrict(liveShop.address) || district;
      const districtProfile = districtProfiles.find(d => d.name === shopDistrict);
      const pricingRef = pricingReference.filter(p => p.district === shopDistrict);

      return this.mergeWithStrategy(
        liveShop,
        corpusMatch,
        districtProfile,
        pricingRef,
        mergeStrategy
      );
    });

    // Update cache
    await this.cache.updateShops(mergedShops);

    return mergedShops;
  }

  findMatchingShop(liveShop, corpusShops) {
    if (!corpusShops || corpusShops.length === 0) return null;

    // Try exact name match
    let match = corpusShops.find(s => 
      s.name && liveShop.name &&
      s.name.toLowerCase() === liveShop.name.toLowerCase()
    );

    // Try fuzzy match
    if (!match) {
      match = corpusShops.find(s => 
        s.name && liveShop.name &&
        this.isSimilarName(s.name, liveShop.name)
      );
    }

    // Try address match
    if (!match && liveShop.address) {
      match = corpusShops.find(s => 
        s.address && this.isSimilarAddress(s.address, liveShop.address)
      );
    }

    return match || null;
  }

  mergeWithStrategy(live, corpus, district, pricing, strategy) {
    switch (strategy) {
      case 'enrich_with_corpus':
        return {
          id: live.id || corpus?.id || this.generateId(live.name),
          name: live.name,
          address: live.address || corpus?.address,
          district: this.extractDistrict(live.address) || corpus?.district,
          rating: live.rating || corpus?.rating,
          review_count: live.review_count || corpus?.review_count || 0,
          prettiest_women: live.prettiest_women_mentions || corpus?.prettiest_women || [],
          pricing: live.pricing || corpus?.pricing || [],
          line_usernames: live.line_usernames || corpus?.line_usernames || [],
          websites: live.websites || corpus?.websites || [],
          verified: corpus?.verified || false,
          safety_signals: corpus?.safety_signals || [],
          last_verified: corpus?.last_verified,
          district_info: district?.profile || null,
          pricing_reference: pricing || [],
          data_sources: [
            'google_maps',
            corpus ? 'corpus' : null
          ].filter(Boolean),
          confidence: this.calculateConfidence(live, corpus),
          last_updated: new Date().toISOString(),
        };

      case 'corpus_priority':
        return {
          ...corpus,
          rating: corpus.rating || live.rating,
          review_count: corpus.review_count || live.review_count,
          prettiest_women: [
            ...(corpus.prettiest_women || []),
            ...(live.prettiest_women_mentions || [])
          ],
          pricing: [
            ...(corpus.pricing || []),
            ...(live.pricing || [])
          ],
          data_sources: ['corpus', 'google_maps'],
        };

      default:
        return live;
    }
  }

  calculateConfidence(live, corpus) {
    let score = 0.5;

    if (corpus) {
      score += 0.3;
      if (corpus.verified) score += 0.2;
    }

    if (live.rating && live.rating > 4.0) score += 0.1;
    if (live.review_count && live.review_count > 10) score += 0.1;

    return Math.min(score, 1.0);
  }

  extractDistrict(address) {
    if (!address) return null;

    const districts = [
      'Asok', 'Nana', 'Phrom Phong', 'Thonglor', 'Ekkamai',
      'Silom', 'Ari', 'Victory Monument', 'Ratchada', 'Old City'
    ];

    const addressLower = address.toLowerCase();
    return districts.find(d => addressLower.includes(d.toLowerCase())) || null;
  }

  isSimilarName(name1, name2) {
    if (!name1 || !name2) return false;
    const n1 = name1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const n2 = name2.toLowerCase().replace(/[^a-z0-9]/g, '');
    return n1.includes(n2.substring(0, 5)) || n2.includes(n1.substring(0, 5));
  }

  isSimilarAddress(addr1, addr2) {
    if (!addr1 || !addr2) return false;
    const a1 = addr1.toLowerCase();
    const a2 = addr2.toLowerCase();
    return a1.includes(a2.substring(0, 10)) || a2.includes(a1.substring(0, 10));
  }

  generateId(name) {
    return crypto.createHash('sha256').update(name).digest('hex').substring(0, 16);
  }
}


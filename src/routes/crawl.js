import { pool } from '../db.js';

// Page intent classification rules
const PAGE_INTENTS = {
  INDEX: 'index',
  SERVICE: 'service', 
  PROCESS: 'process',
  REFERENCE: 'reference'
};

// Content alignment with Truth Scope v1
const TRUTH_SCOPE_KEYWORDS = [
  'flood barrier',
  'flood protection',
  'water damage prevention',
  'flood control',
  'barrier system',
  'flood defense',
  'water barrier',
  'flood mitigation'
];

// Content rejection patterns
const REJECTION_PATTERNS = [
  /blog/i,
  /testimonial/i,
  /pricing/i,
  /promo/i,
  /special offer/i,
  /discount/i,
  /buy now/i,
  /contact us/i,
  /about us/i
];

// Crawl and classify pages
export async function crawlAndClassifyPages(req, res) {
  try {
    const { domain = 'floodbarrierpros.com' } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    console.log(`[crawl] Starting crawl for domain: ${domain}`);
    
    // Step 1: Crawl starting at homepage
    const crawledPages = await crawlDomain(domain);
    
    // Step 2: Classify pages by intent
    const classifiedPages = crawledPages.map(page => ({
      ...page,
      intent: classifyPageIntent(page),
      alignmentScore: calculateTruthScopeAlignment(page.content),
      isEvergreen: checkEvergreenContent(page)
    }));
    
    // Step 3: Filter eligible pages for canonical markdown
    const eligiblePages = classifiedPages.filter(page => {
      // Must align with Truth Scope v1
      if (page.alignmentScore < 0.7) {
        console.log(`[crawl] Rejected ${page.url} - low alignment score: ${page.alignmentScore}`);
        return false;
      }
      
      // Must be evergreen and factual
      if (!page.isEvergreen) {
        console.log(`[crawl] Rejected ${page.url} - not evergreen`);
        return false;
      }
      
      // Must be Service, Process, or Reference intent
      if (![PAGE_INTENTS.SERVICE, PAGE_INTENTS.PROCESS, PAGE_INTENTS.REFERENCE].includes(page.intent)) {
        console.log(`[crawl] Rejected ${page.url} - intent: ${page.intent}`);
        return false;
      }
      
      // Must not match rejection patterns
      if (matchesRejectionPatterns(page.url, page.title, page.content)) {
        console.log(`[crawl] Rejected ${page.url} - matches rejection pattern`);
        return false;
      }
      
      return true;
    });
    
    // Step 4: Bind to Canonical Markdown Template v1 and store as drafts
    const storedPages = [];
    for (const page of eligiblePages) {
      const markdownContent = await bindToCanonicalTemplate(page);
      
      const contentHash = generateContentHash(markdownContent);
      
      // Store as draft (is_active = false)
      const result = await pool.query(`
        INSERT INTO markdown_versions (domain, path, content, content_hash, is_active)
        VALUES ($1, $2, $3, $4, false)
        ON CONFLICT (domain, path, content_hash) 
        DO UPDATE SET
          content = EXCLUDED.content,
          updated_at = NOW()
        RETURNING id, domain, path, content_hash, is_active
      `, [
        domain,
        extractPathFromUrl(page.url),
        markdownContent,
        contentHash
      ]);
      
      storedPages.push(result.rows[0]);
      console.log(`[crawl] Stored draft for ${page.url} -> ${result.rows[0].path}`);
    }
    
    res.json({
      success: true,
      domain,
      crawled: crawledPages.length,
      eligible: eligiblePages.length,
      stored: storedPages.length,
      pages: storedPages.map(page => ({
        domain: page.domain,
        path: page.path,
        content_hash: page.content_hash,
        is_active: page.is_active
      }))
    });
    
  } catch (error) {
    console.error('[crawl] Error:', error);
    res.status(500).json({ 
      error: 'crawl_failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Crawl domain starting from homepage
async function crawlDomain(domain) {
  const baseUrl = `https://${domain}`;
  const pages = [];
  
  try {
    // Start with homepage
    const homepage = await fetchPage(baseUrl);
    if (homepage) {
      pages.push({
        url: baseUrl,
        title: extractTitle(homepage),
        content: homepage,
        type: 'homepage'
      });
      
      // Extract internal links for crawling
      const internalLinks = extractInternalLinks(homepage, baseUrl);
      
      // Crawl internal pages (limit to prevent infinite crawl)
      for (const link of internalLinks.slice(0, 50)) {
        try {
          const pageContent = await fetchPage(link);
          if (pageContent) {
            pages.push({
              url: link,
              title: extractTitle(pageContent),
              content: pageContent,
              type: 'internal'
            });
          }
        } catch (pageError) {
          console.warn(`[crawl] Failed to fetch ${link}:`, pageError.message);
        }
      }
    }
  } catch (error) {
    console.error(`[crawl] Failed to crawl ${domain}:`, error);
  }
  
  return pages;
}

// Fetch page content
async function fetchPage(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Croutons-Crawler/1.0'
      },
      timeout: 10000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    return extractTextContent(html);
    
  } catch (error) {
    console.warn(`[crawl] Fetch error for ${url}:`, error.message);
    return null;
  }
}

// Extract text content from HTML
function extractTextContent(html) {
  // Simple text extraction - remove scripts, styles, and extract main content
  let text = html
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return text;
}

// Extract title from HTML
function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : 'Untitled';
}

// Extract internal links
function extractInternalLinks(html, baseUrl) {
  const linkRegex = /href=["']([^"']+)["']/gi;
  const links = [];
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    const link = match[1];
    
    // Skip external links, anchors, and special links
    if (link.startsWith('http') && !link.includes(baseUrl)) continue;
    if (link.startsWith('#') || link.startsWith('mailto:') || link.startsWith('tel:')) continue;
    if (link.includes('javascript:') || link.includes('mailto:')) continue;
    
    // Convert relative links to absolute
    let absoluteLink = link;
    if (link.startsWith('/')) {
      absoluteLink = baseUrl + link;
    } else if (!link.startsWith('http')) {
      absoluteLink = baseUrl + '/' + link;
    }
    
    // Avoid duplicates
    if (!links.includes(absoluteLink)) {
      links.push(absoluteLink);
    }
  }
  
  return links;
}

// Classify page intent
function classifyPageIntent(page) {
  const { url, title, content } = page;
  const text = `${title} ${content}`.toLowerCase();
  
  // Index page (homepage)
  if (url === `https://${page.url.split('/')[2]}/` || url.endsWith('/')) {
    return PAGE_INTENTS.INDEX;
  }
  
  // Service pages
  if (text.includes('service') || text.includes('solution') || text.includes('offering')) {
    return PAGE_INTENTS.SERVICE;
  }
  
  // Process pages  
  if (text.includes('process') || text.includes('how') || text.includes('step')) {
    return PAGE_INTENTS.PROCESS;
  }
  
  // Reference pages
  if (text.includes('guide') || text.includes('reference') || text.includes('information')) {
    return PAGE_INTENTS.REFERENCE;
  }
  
  // Default to reference
  return PAGE_INTENTS.REFERENCE;
}

// Calculate Truth Scope v1 alignment score
function calculateTruthScopeAlignment(content) {
  const text = content.toLowerCase();
  let score = 0;
  
  for (const keyword of TRUTH_SCOPE_KEYWORDS) {
    if (text.includes(keyword)) {
      score += 1;
    }
  }
  
  // Normalize score (0-1)
  return Math.min(score / TRUTH_SCOPE_KEYWORDS.length, 1);
}

// Check if content is evergreen
function checkEvergreenContent(page) {
  const { url, title, content } = page;
  const text = `${title} ${content}`.toLowerCase();
  
  // Look for time-sensitive content
  const timePatterns = [
    /\b(202\d|202\d|january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
    /\b(today|now|current|latest|recent|new)\b/i,
    /\b(sale|offer|promotion|discount|special)\b/i
  ];
  
  for (const pattern of timePatterns) {
    if (pattern.test(text)) {
      return false;
    }
  }
  
  return true;
}

// Check if page matches rejection patterns
function matchesRejectionPatterns(url, title, content) {
  const text = `${url} ${title} ${content}`.toLowerCase();
  
  for (const pattern of REJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}

// Bind page content to Canonical Markdown Template v1
async function bindToCanonicalTemplate(page) {
  const { url, title, content } = page;
  
  // Extract structured information
  const sections = extractStructuredContent(content);
  
  // Apply Canonical Markdown Template v1
  const markdown = `---
id: ${generateId()}
domain: floodbarrierpros.com
path: ${extractPathFromUrl(url)}
template: canonical_v1
crawled_at: ${new Date().toISOString()}
alignment_score: ${page.alignmentScore}
intent: ${page.intent}
---

# ${title}

## Overview
${sections.overview || 'Information about flood barriers and protection systems.'}

## Key Features
${sections.features || 'Comprehensive flood protection solutions.'}

## Process
${sections.process || 'Professional installation and maintenance process.'}

## Specifications
${sections.specifications || 'Technical specifications and requirements.'}

## References
${sections.references || 'Industry standards and compliance information.'}

---
*Content automatically generated via crawl-based discovery*
*Template: Canonical Markdown v1*
*Source: ${url}*
`;

  return markdown;
}

// Extract structured content from page
function extractStructuredContent(content) {
  const sections = {
    overview: '',
    features: '',
    process: '',
    specifications: '',
    references: ''
  };
  
  // Simple content extraction based on common patterns
  const lines = content.split('\n');
  let currentSection = '';
  
  for (const line of lines) {
    const text = line.trim().toLowerCase();
    
    if (text.includes('overview') || text.includes('about') || text.includes('introduction')) {
      currentSection = 'overview';
    } else if (text.includes('feature') || text.includes('benefit') || text.includes('advantage')) {
      currentSection = 'features';
    } else if (text.includes('process') || text.includes('step') || text.includes('how')) {
      currentSection = 'process';
    } else if (text.includes('specification') || text.includes('technical') || text.includes('requirement')) {
      currentSection = 'specifications';
    } else if (text.includes('reference') || text.includes('standard') || text.includes('compliance')) {
      currentSection = 'references';
    } else if (text.length > 20 && currentSection) {
      sections[currentSection] += line + '\n';
    }
  }
  
  return sections;
}

// Extract path from URL
function extractPathFromUrl(url) {
  try {
    const urlObj = new URL(url);
    let path = urlObj.pathname.slice(1); // Remove leading /
    
    if (!path || path === '/') {
      return 'index';
    }
    
    // Remove .html, .php extensions
    path = path.replace(/\.(html|php|aspx?)$/i, '');
    
    // Convert to valid path format
    path = path.replace(/[^a-zA-Z0-9\/\-_]/g, '-');
    
    return path || 'index';
  } catch (error) {
    return 'index';
  }
}

// Generate content hash
function generateContentHash(content) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Generate unique ID
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// md-server.js
// Lightweight Express service for md.croutons.ai hosting

import express from 'express';
import cors from 'cors';
import { crawlAndClassifyPages } from './src/routes/crawl.js';
import { activateMarkdown, deactivateMarkdown, listMarkdownVersions, activateMarkdownById } from './src/routes/admin.js';
import { automateDomain, getAutomationStatus } from './src/routes/automate.js';

// Database connection with error handling
let pool = null;
let emitSourceParticipation = null;

// Async function to setup server
async function setupServer() {
  try {
    const dbModule = await import('./src/db.js');
    pool = dbModule.pool;
    console.log('[md-server] Database imported successfully');
  } catch (error) {
    console.error('[md-server] Failed to import database:', error.message);
  }

  try {
    const eventsModule = await import('./src/routes/events.js');
    emitSourceParticipation = eventsModule.emitSourceParticipation;
    console.log('[md-server] Events module imported successfully');
  } catch (error) {
    console.error('[md-server] Failed to import events module:', error.message);
  }

  const app = express();
  const PORT = process.env.PORT || 8081;

// Basic middleware FIRST
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Rate limiting (simple in-memory)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests per minute

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return next();
  }

  const record = rateLimitStore.get(ip);
  
  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + RATE_LIMIT_WINDOW;
    return next();
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: "Rate limit exceeded",
      retryAfter: Math.ceil((record.resetAt - now) / 1000),
    });
  }

  record.count++;
  next();
}

// Request normalization
function normalizeRequest(req, res, next) {
  const segments = req.path.split('/').filter(Boolean);
  
  if (segments.length === 0) {
    return res.status(400).send('Bad request');
  }

  let domain = segments[0];
  const pathSegments = segments.slice(1);
  
  // Normalize domain to match database storage format
  // Convert to lowercase, remove www prefix if present, and clean up
  domain = domain.toLowerCase().trim();
  if (domain.startsWith('www.')) {
    domain = domain.slice(4);
  }
  
  // Remove port number if present (e.g., example.com:8080 -> example.com)
  const portMatch = domain.match(/:(\d+)$/);
  if (portMatch) {
    domain = domain.slice(0, -portMatch[0].length);
  }
  
  // Remove trailing slash if present
  domain = domain.replace(/\/$/, '');
  
  console.log('[md-server] Normalized domain:', domain, 'from:', segments[0]);
  
  // Remove .md extension if present
  if (pathSegments.length > 0) {
    const lastSegment = pathSegments[pathSegments.length - 1];
    if (lastSegment.endsWith('.md')) {
      pathSegments[pathSegments.length - 1] = lastSegment.slice(0, -3);
    }
  }
  
  // Normalize path
  let path = pathSegments.join('/');
  if (!path) {
    path = 'index';
  }
  
  // Safety checks
  if (path.includes('..') || /[^\w\-\/\.]/.test(path)) {
    return res.status(400).send('Invalid path');
  }
  
  req.normalizedDomain = domain;
  req.normalizedPath = path;
  
  next();
}

// Logging
function logRequest(req, status) {
  console.log('[md-server]', {
    timestamp: new Date().toISOString(),
    domain: req.normalizedDomain,
    path: req.normalizedPath,
    status,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    requestId: Math.random().toString(36).substr(2, 9)
  });
}

// Health check (must come before wildcard)
app.get('/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'croutons-merge-service',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      crawl: 'POST /v1/crawl/discover',
      automate: 'POST /v1/automate',
      status: 'GET /v1/automate/status?domain=example.com',
      admin: {
        activate: 'POST /v1/admin/activate',
        deactivate: 'POST /v1/admin/deactivate',
        versions: 'GET /v1/admin/versions',
        activateById: 'POST /v1/admin/activate-by-id'
      },
      serving: 'GET /{domain}/{path} - serves active markdown'
    },
    automation: {
      description: 'Full automation: domain → concepts → artifacts → activation → serving',
      concepts: ['engineered-systems', 'residential-mitigation', 'installation-compliance', 'maintenance-lifecycle', 'regulatory-standards'],
      auto_activation: true,
      zero_manual_steps: true
    }
  });
});

// POST /v1/crawl/discover
// Crawl-based truth page discovery
app.post('/v1/crawl/discover', (req, res) => {
  console.log('[md-server] Crawl endpoint hit');
  return crawlAndClassifyPages(req, res);
});

// POST /v1/automate
// Full automation: domain → concepts → artifacts → activation → serving
app.post('/v1/automate', (req, res) => {
  console.log('[md-server] Automation endpoint hit');
  return automateDomain(req, res);
});

// GET /v1/automate/status
// Check automation status for a domain
app.get('/v1/automate/status', (req, res) => {
  console.log('[md-server] Automation status endpoint hit');
  return getAutomationStatus(req, res);
});

// Admin middleware - API key protection
function requireAdminAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
  const expectedApiKey = process.env.ADMIN_API_KEY || 'croutons-admin-key-2024';
  
  if (!apiKey || apiKey !== expectedApiKey) {
    return res.status(401).json({ 
      error: 'unauthorized',
      message: 'Valid admin API key required',
      timestamp: new Date().toISOString()
    });
  }
  
  next();
}

// Admin routes (protected)
app.post('/v1/admin/activate', requireAdminAuth, activateMarkdown);
app.post('/v1/admin/deactivate', requireAdminAuth, deactivateMarkdown);
app.get('/v1/admin/versions', requireAdminAuth, listMarkdownVersions);
app.post('/v1/admin/activate-by-id', requireAdminAuth, activateMarkdownById);

// Simple POST test
app.post('/test-post', (req, res) => {
  console.log('[md-server] POST test hit');
  res.json({ message: 'POST test works', body: req.body });
});

// Test route without database
app.get('/test', (req, res) => {
  console.log('[md-server] Test route hit');
  res.json({ message: 'Test route works', path: req.path });
});

// Main markdown serving endpoint (GET only) - exclude admin routes
app.get(/^((?!\/v1\/admin).)*$/, rateLimit, normalizeRequest, async (req, res) => {
  console.log('[md-server] Route hit:', req.path);
  try {
    // Use normalized values from middleware
    const { normalizedDomain: domain, normalizedPath: path } = req;
    console.log('[md-server] Normalized domain:', domain);
    
    // Check database availability first
    if (!pool) {
      console.log('[md-server] No database pool - returning 404 for unknown domains');
      logRequest(req, 404);
      res.set('Cache-Control', 'no-store');
      return res.status(404).json({ error: 'domain_not_found', domain });
    }
    
    console.log('[md-server] Database pool available');
    
    // Rule A: Check if domain is verified
    const r = await pool.query(
      'SELECT verified_at FROM verified_domains WHERE domain = $1',
      [domain]
    );

    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'domain_not_found', domain });
    }
    
    if (!r.rows[0].verified_at) {
      logRequest(req, 403);
      res.set('Cache-Control', 'no-store');
      return res.status(403).send('Forbidden');
    }
    
    // Rule B: Check if active markdown exists
    const markdownCheck = await pool.query(
      'SELECT content, content_hash, generated_at FROM markdown_versions WHERE domain = $1 AND path = $2 AND is_active = true',
      [domain, path]
    );

    if (markdownCheck.rows.length === 0) {
      logRequest(req, 404);
      res.set('Cache-Control', 'no-store');
      return res.status(404).send('Markdown not found');
    }

    // Rule C: Return markdown
    const { content, content_hash, generated_at } = markdownCheck.rows[0];
    
    logRequest(req, 200);
    res.set({
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'ETag': `"${content_hash}"`,
      'Last-Modified': new Date(generated_at).toUTCString()
    });
    
    // Emit source participation event (non-critical)
    if (emitSourceParticipation) {
      try {
        await emitSourceParticipation(
          domain, 
          'alternate_link', 
          req.get('User-Agent') || ''
        );
      } catch (eventError) {
        console.error('[md-server] Failed to emit source participation event:', eventError);
        // Don't fail the request, just log the error
      }
    }
    
    // Size limit (2MB)
    if (content.length > 2 * 1024 * 1024) {
      return res.status(500).send('Content too large');
    }
    
    res.send(content);
    
  } catch (error) {
    console.error('[md-server] Error:', error);
    console.error('[md-server] Stack trace:', error.stack);
    
    // Check if it's a database connection error
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.message?.includes('database')) {
      logRequest(req, 503);
      res.set('Cache-Control', 'no-store');
      return res.status(503).json({ 
        error: 'database_unavailable',
        message: 'Database service is temporarily unavailable',
        timestamp: new Date().toISOString()
      });
    }
    
    // Check if it's a validation error
    if (error.message?.includes('validation') || error.message?.includes('invalid')) {
      logRequest(req, 400);
      res.set('Cache-Control', 'no-store');
      return res.status(400).json({ 
        error: 'validation_error',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // Generic 500 error with structured response
    logRequest(req, 500);
    res.set('Cache-Control', 'no-store');
    res.status(500).json({ 
      error: 'internal_server_error',
      message: 'An unexpected error occurred while processing your request',
      timestamp: new Date().toISOString(),
      request_id: Math.random().toString(36).substr(2, 9)
    });
  }
});

// Cleanup rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW * 2);

// Debug: Log all registered routes on boot
console.log('=== REGISTERED ROUTES ===');
console.log(
  app._router.stack
    .map(r => r.route?.path || (r.regexp && r.regexp.source))
    .filter(Boolean)
);
console.log('========================');

app.listen(PORT, '0.0.0.0', () => {
  console.log(`md-server listening on ${PORT}`);
});

}

// Start the server
setupServer().catch(error => {
  console.error('[md-server] Failed to start server:', error);
  process.exit(1);
});

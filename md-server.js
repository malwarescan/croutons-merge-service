// md-server.js
// Lightweight Express service for md.croutons.ai hosting

import express from 'express';
import cors from 'cors';

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
  methods: ['GET'],
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

  const domain = segments[0];
  const pathSegments = segments.slice(1);
  
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

// Test route without database
app.get('/test', (req, res) => {
  console.log('[md-server] Test route hit');
  res.json({ message: 'Test route works', path: req.path });
});

// Main markdown serving endpoint (simple test)
app.get('*', async (req, res) => {
  console.log('[md-server] Wildcard route hit:', req.path);
  res.json({ message: 'Wildcard route works', path: req.path });
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

// src/routes/events.js
// Graph event emission for Phase 7 integration

const { pool } = require('../db');

// Emit event to outbox table
async function emitEvent(eventType, data) {
  try {
    await pool.query(`
      INSERT INTO outbox_graph_events (event_type, data, created_at)
      VALUES ($1, $2, NOW())
    `, [eventType, JSON.stringify(data)]);
    
    console.log('[event-emitted]', {
      event_type: eventType,
      data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[event-emission] Error:', error);
  }
}

// Emit markdown.generated event
async function emitMarkdownGenerated(domain, path, contentHash) {
  await emitEvent('markdown.generated', {
    domain,
    path,
    content_hash: contentHash,
    generated_at: new Date().toISOString()
  });
}

// Emit markdown.activated event
async function emitMarkdownActivated(domain, path, activationReason) {
  await emitEvent('markdown.activated', {
    domain,
    path,
    activation_reason: activationReason,
    activated_at: new Date().toISOString()
  });
}

// Emit markdown.deactivated event
async function emitMarkdownDeactivated(domain, path, reason) {
  await emitEvent('markdown.deactivated', {
    domain,
    path,
    reason,
    deactivated_at: new Date().toISOString()
  });
}

// Emit source_participation.insert event
async function emitSourceParticipation(domain, discoveryMethod, userAgent) {
  await emitEvent('source_participation.insert', {
    domain,
    discovery_method: discoveryMethod,
    user_agent: userAgent,
    observed_at: new Date().toISOString()
  });
}

module.exports = {
  emitMarkdownGenerated,
  emitMarkdownActivated,
  emitMarkdownDeactivated,
  emitSourceParticipation
};

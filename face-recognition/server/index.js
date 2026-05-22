/**
 * Zero-dependency mock backend for the example app.
 *
 * Endpoints (all JSON, Bearer token accepted but not enforced):
 *   POST /enroll      { personnelId, embedding }  → stores a template (base64 f32)
 *   POST /provision   { attestation, since }       → full/delta roster + thresholds + manifest
 *   POST /attendance  { events: [...] }             → { acked: [ids] } (idempotent)
 *
 * Run:  node server/index.js   (listens on :8080)
 * Device:  adb reverse tcp:8080 tcp:8080   then set awsSyncUrl = http://localhost:8080
 *
 * NOTE: real templates must be produced by the SAME embedding model as the
 * device. This mock simply stores whatever the device enrolls (POST /enroll),
 * then serves it back via /provision — enough to exercise the full
 * provision → identify → attendance → sync → purge loop offline.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;

// In-memory state (per personnel: array of base64 embeddings) + dedupe set.
const roster = new Map(); // personnelId -> string[] (base64 f32)
let version = 0; // bumps on every enroll; used as the delta cursor
const ackedEvents = new Set();

// Optional: serve the signed model manifest if present.
function loadManifest() {
  try {
    const p = path.join(__dirname, '..', 'models', 'manifest.json');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return undefined;
  }
}

function send(res, code, body) {
  const json = JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const body = await readBody(req);
  const url = req.url || '';

  if (req.method === 'POST' && url.endsWith('/enroll')) {
    const { personnelId, embedding } = body;
    if (!personnelId || !embedding) return send(res, 400, { error: 'personnelId + embedding required' });
    const list = roster.get(personnelId) || [];
    list.push(embedding);
    roster.set(personnelId, list);
    version += 1;
    console.log(`[enroll] ${personnelId} (now ${list.length} templates, v${version})`);
    return send(res, 200, { ok: true, personnelId, count: list.length });
  }

  if (req.method === 'POST' && url.endsWith('/provision')) {
    const since = Number(body.since || 0);
    const manifest = loadManifest();
    const thresholds = { matchCosine: 0.6, spoofReject: 0.5 };
    // Always reply full for simplicity; cursor = current version.
    const templates = [];
    for (const [personnelId, list] of roster.entries()) {
      for (const embedding of list) templates.push({ personnelId, embedding });
    }
    console.log(`[provision] since=${since} → ${templates.length} templates (v${version})`);
    return send(res, 200, { mode: 'full', templates, thresholds, manifest, syncedAt: version || Date.now() });
  }

  if (req.method === 'POST' && url.endsWith('/attendance')) {
    const events = Array.isArray(body.events) ? body.events : [];
    const acked = [];
    for (const e of events) {
      if (e && e.id && !ackedEvents.has(e.id)) ackedEvents.add(e.id);
      if (e && e.id) acked.push(e.id); // idempotent: ack again on retry
    }
    console.log(`[attendance] received ${events.length}, acked ${acked.length}`);
    return send(res, 200, { acked });
  }

  if (req.method === 'GET' && url.endsWith('/health')) {
    return send(res, 200, { ok: true, roster: roster.size, version });
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`mock face-auth backend on http://localhost:${PORT}`);
  console.log('  adb reverse tcp:8080 tcp:8080  then awsSyncUrl=http://localhost:8080');
});

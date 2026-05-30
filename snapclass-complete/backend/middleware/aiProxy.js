/**
 * aiProxy.js  –  Thin proxy from Express to the Python FastAPI AI server.
 *
 * Set AI_SERVER_URL in .env (default: http://localhost:8000)
 */

const AI_BASE = process.env.AI_SERVER_URL || 'http://localhost:8000';

/**
 * Forward a JSON payload to the AI server and return the parsed response.
 * Throws on network or HTTP error.
 */
async function aiPost(path, body) {
  const res = await fetch(`${AI_BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.detail || json.error || 'AI server error');
  return json;
}

async function aiGet(path) {
  const res  = await fetch(`${AI_BASE}${path}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail || 'AI server error');
  return json;
}

module.exports = { aiPost, aiGet, AI_BASE };

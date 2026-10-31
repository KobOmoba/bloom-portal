// EduBloom OCR reader — Cloudflare Worker (v4, Nov 2026)
// Holds the AI keys as Cloudflare secrets so the apps never see them.
// Secrets: GEMINI_API_KEY (required), GROQ_API_KEY (optional backup).
// Routes (POST JSON {image: <base64>, mime: "image/jpeg"}):
//   /names      -> {names:[{surname, firstname}], engine}
//   /signboard  -> {name, address, lga, state, phone, engine}
// To switch to Claude later: add a callClaude() and put it first in ENGINES.

const ALLOWED = [
  'https://school.edubloom.com.ng', 'https://agent.edubloom.com.ng',
  'https://portal.edubloom.com.ng', 'https://kobomoba.github.io',
];
const GEMINI_MODELS = ['gemini-3-flash-preview', 'gemini-3.8-flash', 'gemini-flash-latest'];
const GROQ_MODEL = 'qwen/qwen3.8-27b';
const MAX_IMAGE_CHARS = 8_000_000; // ~6 MB photo

const PROMPTS = {
  names: 'This is a photo of a Nigerian school register or class list. Read EVERY handwritten '
    + 'student name, top to bottom. Most names are Yoruba. Copy the spelling EXACTLY as written: '
    + 'never correct, guess or swap a name for a more common one. Ignore headings, dates, numbers '
    + 'and addresses. Return JSON only: {"names":[{"surname":"","firstname":""}]} with the '
    + 'surname as written first on the line.',
  signboard: 'This is a photo of a Nigerian school signboard. Return JSON only: '
    + '{"name":"","address":"","lga":"","state":"","phone":""}. Copy text exactly. '
    + 'phone = every phone number on the sign, comma separated. lga = local government area '
    + 'ONLY if written on the sign, else "". state = state if written or obvious from the town.',
};

function cors(origin) {
  const ok = ALLOWED.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}
const json = (obj, status, origin) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...cors(origin) } });

function parseJSON(text) {
  const t = String(text || '');
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s < 0 || e < s) throw new Error('no JSON in reply');
  return JSON.parse(t.slice(s, e + 1));
}

async function callGemini(env, prompt, image, mime) {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
  let last = 'no model tried';
  // Gemini is sometimes "busy" (503): go through the models twice, pausing between rounds.
  const attempts = [...GEMINI_MODELS, ...GEMINI_MODELS];
  for (let i = 0; i < attempts.length; i++) {
    const model = attempts[i];
    if (i === GEMINI_MODELS.length) await new Promise(r => setTimeout(r, 2500));
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: image } }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    });
    if (r.ok) {
      const d = await r.json();
      const parts = d?.candidates?.[0]?.content?.parts || [];
      return { data: parseJSON(parts.map(p => p.text || '').join('')), engine: model };
    }
    last = model + ' ' + r.status;
    if (![429, 500, 503, 404].includes(r.status)) break; // real error: stop
  }
  throw new Error('Gemini failed: ' + last);
}

async function callGroq(env, prompt, image, mime) {
  if (!env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.GROQ_API_KEY },
    body: JSON.stringify({
      model: GROQ_MODEL, temperature: 0, response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url: `data:${mime};base64,${image}` } },
        { type: 'text', text: prompt }] }],
    }),
  });
  if (!r.ok) throw new Error('Groq ' + r.status);
  const d = await r.json();
  return { data: parseJSON(d?.choices?.[0]?.message?.content), engine: GROQ_MODEL };
}

const ENGINES = [callGemini, callGroq];

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
    const route = new URL(req.url).pathname.replace(/^\/+/, '');
    if (req.method === 'GET') return json({ name: 'EduBloom OCR', version: 4, engines: ['gemini', 'groq'] }, 200, origin);
    if (!ALLOWED.includes(origin)) return json({ error: 'origin not allowed' }, 403, origin);
    if (!PROMPTS[route]) return json({ error: 'unknown route' }, 404, origin);

    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad JSON' }, 400, origin); }
    const image = String(body.image || '').replace(/^data:[^,]+,/, '');
    const mime = /^image\/(jpeg|png|webp|heic|heif)$/.test(body.mime) ? body.mime : 'image/jpeg';
    if (!image || image.length > MAX_IMAGE_CHARS) return json({ error: 'missing or too large image' }, 400, origin);

    const errors = [];
    for (const engine of ENGINES) {
      try {
        const { data, engine: used } = await engine(env, PROMPTS[route], image, mime);
        if (route === 'names') {
          const names = (Array.isArray(data) ? data : data.names || [])
            .map(n => typeof n === 'string' ? { surname: n.split(/\s+/)[0], firstname: n.split(/\s+/).slice(1).join(' ') } : n)
            .filter(n => (n.surname || n.firstname));
          if (!names.length) throw new Error('0 names');
          return json({ names, engine: used }, 200, origin);
        }
        return json({ ...data, engine: used }, 200, origin);
      } catch (e) { errors.push(String(e.message || e)); }
    }
    return json({ error: 'all engines failed', details: errors }, 502, origin);
  },
};

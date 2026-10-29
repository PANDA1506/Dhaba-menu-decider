// Vercel serverless function: stores the menu in Upstash Redis (free) via REST.
const crypto = require('crypto');

const URL_  = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN },
    body: JSON.stringify(cmd)
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

function passwordOk(given) {
  const real = process.env.ADMIN_PASSWORD || '';
  if (!real || typeof given !== 'string') return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

function clean(items) {
  if (!Array.isArray(items) || items.length > 300) return null;
  const out = [];
  for (const it of items) {
    const price = Number(it && it.price);
    if (!it || typeof it.name !== 'string' || !it.name.trim() || !(price >= 0) || price > 100000) return null;
    out.push({
      id: String(it.id || '').slice(0, 40) || 'i' + Math.random().toString(36).slice(2, 10),
      name: it.name.trim().slice(0, 80),
      price: Math.round(price * 100) / 100,
      category: String(it.category || '').trim().slice(0, 30),
      veg: !!it.veg
    });
  }
  return out;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    if (!URL_ || !TOKEN) return res.status(200).json({ items: null, configured: false });
    try {
      const v = await redis(['GET', 'menu']);
      return res.status(200).json({ items: v ? JSON.parse(v) : null, configured: true });
    } catch (e) {
      return res.status(200).json({ items: null, configured: false });
    }
  }

  if (req.method === 'POST') {
    if (!process.env.ADMIN_PASSWORD) return res.status(500).json({ error: 'ADMIN_PASSWORD not set' });
    if (!passwordOk(req.headers['x-admin-password'])) return res.status(401).json({ error: 'Wrong password' });

    const body = req.body || {};
    if (body.check) return res.status(200).json({ ok: true });

    if (!URL_ || !TOKEN) return res.status(500).json({ error: 'Database not connected' });
    const items = clean(body.items);
    if (!items) return res.status(400).json({ error: 'Invalid menu' });
    try {
      await redis(['SET', 'menu', JSON.stringify(items)]);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Database error' });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
};

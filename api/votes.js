// Community vote for the next draw's last-2-digit number.
// Storage: Upstash Redis (add it from Vercel → Storage / Marketplace; it sets the env vars below).
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const MAX_PER_IP = 3; // shared mobile networks often share one IP

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error("redis " + r.status);
  return (await r.json()).result;
}

function validDraw(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return false;
  const t = new Date(d + "T00:00:00Z").getTime();
  const now = Date.now();
  return t > now - 3 * 864e5 && t < now + 40 * 864e5;
}

async function tally(draw) {
  const flat = (await redis(["HGETALL", "votes:" + draw])) || [];
  const rows = [];
  for (let i = 0; i < flat.length; i += 2) rows.push([flat[i], Number(flat[i + 1])]);
  rows.sort((a, b) => b[1] - a[1]);
  return { draw, total: rows.reduce((a, r) => a + r[1], 0), top: rows.slice(0, 10) };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!URL_ || !TOKEN) return res.status(503).json({ error: "not_configured" });
  try {
    if (req.method === "GET") {
      const draw = String(req.query.draw || "");
      if (!validDraw(draw)) return res.status(400).json({ error: "bad_draw" });
      return res.status(200).json(await tally(draw));
    }
    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
      const draw = String((body && body.draw) || "");
      const num = String((body && body.num) || "");
      if (!validDraw(draw) || !/^\d{2}$/.test(num)) return res.status(400).json({ error: "bad_input" });
      const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
      const rl = "rl:" + draw + ":" + ip;
      const n = await redis(["INCR", rl]);
      if (n === 1) await redis(["EXPIRE", rl, 60 * 60 * 24 * 20]);
      if (n > MAX_PER_IP) return res.status(429).json(await tally(draw));
      await redis(["HINCRBY", "votes:" + draw, num, 1]);
      await redis(["EXPIRE", "votes:" + draw, 60 * 60 * 24 * 90]);
      return res.status(200).json(await tally(draw));
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method" });
  } catch (e) {
    return res.status(500).json({ error: "server" });
  }
};

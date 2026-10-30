const slugs = require("../dream/slugs.json");
module.exports = (req, res) => {
  const base = "https://" + (req.headers["x-forwarded-host"] || req.headers.host);
  const today = new Date().toISOString().slice(0, 10);
  const urls = [["/", "daily", "1.0"], ["/dream", "weekly", "0.9"], ...slugs.map(s => ["/dream/" + s, "monthly", "0.7"])];
  const body = urls.map(([p, f, pr]) => `<url><loc>${base}${p}</loc><lastmod>${today}</lastmod><changefreq>${f}</changefreq><priority>${pr}</priority></url>`).join("");
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`);
};

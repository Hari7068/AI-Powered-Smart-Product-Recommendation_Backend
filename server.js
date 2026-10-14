// Zero-dependency REST API (Node 16+). Run: node server.js
const http = require("http");
const { URL } = require("url");
const { PRODUCTS, STORES } = require("./products");
const { recommend } = require("./recommender");

const PORT = process.env.PORT || 3000;

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e5) { reject(new Error("Body too large")); req.destroy(); }
    });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(new Error("Invalid JSON")); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  try {
    // GET /api/health
    if (req.method === "GET" && path === "/api/health") return send(res, 200, { ok: true });

    // GET /api/products?category=Phones&maxPrice=40000&sort=low|high|rate|save
    if (req.method === "GET" && path === "/api/products") {
      const { category, maxPrice, sort } = Object.fromEntries(url.searchParams);
      let list = PRODUCTS.filter(
        (p) => (!category || category === "All" || p.c === category) && (!maxPrice || p.best.v <= Number(maxPrice))
      );
      if (sort === "low") list.sort((a, b) => a.best.v - b.best.v);
      if (sort === "high") list.sort((a, b) => b.best.v - a.best.v);
      if (sort === "rate") list.sort((a, b) => b.r - a.r);
      if (sort === "save") list.sort((a, b) => b.high - b.best.v - (a.high - a.best.v));
      return send(res, 200, { stores: STORES, categories: [...new Set(PRODUCTS.map((p) => p.c))], products: list });
    }

    // GET /api/products/:id
    let m = path.match(/^\/api\/products\/(\d+)$/);
    if (req.method === "GET" && m) {
      const p = PRODUCTS.find((x) => x.id === Number(m[1]));
      return p ? send(res, 200, p) : send(res, 404, { error: "Product not found" });
    }

    // GET /api/compare?ids=1,2,3
    if (req.method === "GET" && path === "/api/compare") {
      const ids = (url.searchParams.get("ids") || "").split(",").map(Number).filter(Boolean).slice(0, 3);
      const items = PRODUCTS.filter((p) => ids.includes(p.id));
      if (items.length < 2) return send(res, 400, { error: "Provide at least 2 valid product ids" });
      return send(res, 200, { items });
    }

    // POST /api/recommend  { "query": "gaming laptop under 80000" }
    if (req.method === "POST" && path === "/api/recommend") {
      const { query } = await readBody(req);
      if (typeof query !== "string" || !query.trim()) return send(res, 400, { error: "query is required" });
      return send(res, 200, recommend(query.slice(0, 300)));
    }

    send(res, 404, { error: "Not found" });
  } catch (err) {
    send(res, 400, { error: err.message });
  }
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`PriceSage API running on http://localhost:${PORT}`));
}
module.exports = server;

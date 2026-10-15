
const http = require("http");
const { URL } = require("url");

const { getProducts, getStores } = require("./database");
const { recommend } = require("./recommender");

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

function send(res, status, body) {
  if (res.writableEnded || res.destroyed) return;

  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });

  res.end(status === 204 ? undefined : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let settled = false;

    req.on("data", (chunk) => {
      if (settled) return;

      data += chunk.toString();

      if (Buffer.byteLength(data, "utf8") > 100000) {
        settled = true;
        reject(new Error("Request body is too large"));
        req.resume();
      }
    });

    req.on("end", () => {
      if (settled) return;

      try {
        const body = data ? JSON.parse(data) : {};
        settled = true;
        resolve(body);
      } catch {
        settled = true;
        reject(new Error("Invalid JSON in request body"));
      }
    });

    req.on("error", (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
  });
}

function handleError(res, err) {
  console.error("API error:", err.message);

  if (!res.headersSent && !res.destroyed) {
    send(res, 500, { error: "Internal server error" });
  } else if (!res.destroyed && !res.writableEnded) {
    res.end();
  }
}

const server = http.createServer(async (req, res) => {
  // Handle browser CORS preflight requests.
  if (req.method === "OPTIONS") {
    return send(res, 204, {});
  }

  let url;

  try {
    url = new URL(
      req.url,
      `http://${req.headers.host || "localhost"}`
    );
  } catch {
    return send(res, 400, { error: "Invalid request URL" });
  }

  const path = url.pathname.replace(/\/+$/, "") || "/";

  try {
    // GET /api/health
    if (req.method === "GET" && path === "/api/health") {
      return send(res, 200, {
        ok: true,
        service: "PriceSage API",
      });
    }

    // GET /api/products
    // Optional filters: ?category=Phones&maxPrice=40000&sort=low
    if (req.method === "GET" && path === "/api/products") {
      const products = getProducts();
      const stores = getStores();

      const category = url.searchParams.get("category");
      const maxPrice = url.searchParams.get("maxPrice");
      const sort = url.searchParams.get("sort");

      if (
        maxPrice !== null &&
        (
          maxPrice.trim() === "" ||
          !Number.isFinite(Number(maxPrice)) ||
          Number(maxPrice) < 0
        )
      ) {
        return send(res, 400, {
          error: "maxPrice must be a valid non-negative number",
        });
      }

      let list = products.filter((product) => {
        const matchesCategory =
          !category ||
          category === "All" ||
          product.c === category;

        const matchesPrice =
          maxPrice === null ||
          product.best.v <= Number(maxPrice);

        return matchesCategory && matchesPrice;
      });

      switch (sort) {
        case "low":
          list.sort((a, b) => a.best.v - b.best.v);
          break;

        case "high":
          list.sort((a, b) => b.best.v - a.best.v);
          break;

        case "rate":
          list.sort((a, b) => b.r - a.r);
          break;

        case "save":
          list.sort(
            (a, b) =>
              (b.high - b.best.v) -
              (a.high - a.best.v)
          );
          break;
      }

      return send(res, 200, {
        stores,
        categories: [
          ...new Set(products.map((product) => product.c)),
        ],
        products: list,
      });
    }

    // GET /api/products/:id
    const productMatch = path.match(/^\/api\/products\/(\d+)$/);

    if (req.method === "GET" && productMatch) {
      const products = getProducts();
      const id = Number(productMatch[1]);
      const product = products.find((item) => item.id === id);

      if (!product) {
        return send(res, 404, {
          error: "Product not found",
        });
      }

      return send(res, 200, product);
    }

    // GET /api/compare?ids=1,2,3
    if (req.method === "GET" && path === "/api/compare") {
      const rawIds = url.searchParams.get("ids") || "";

      const ids = [
        ...new Set(
          rawIds
            .split(",")
            .map((value) => value.trim())
            .filter((value) => /^\d+$/.test(value))
            .map(Number)
        ),
      ].slice(0, 3);

      if (ids.length < 2) {
        return send(res, 400, {
          error: "Provide at least 2 valid product IDs",
        });
      }

      const products = getProducts();
      const items = products.filter((product) =>
        ids.includes(product.id)
      );

      if (items.length < 2) {
        return send(res, 404, {
          error: "At least 2 matching products are required",
        });
      }

      return send(res, 200, { items });
    }

    // POST /api/recommend
    // JSON body: { "query": "gaming laptop under 80000" }
    if (req.method === "POST" && path === "/api/recommend") {
      let body;

      try {
        body = await readBody(req);
      } catch (err) {
        const tooLarge =
          err.message === "Request body is too large";

        return send(res, tooLarge ? 413 : 400, {
          error: tooLarge
            ? "Request body is too large"
            : "Invalid JSON in request body",
        });
      }

      const query = body.query;

      if (typeof query !== "string" || !query.trim()) {
        return send(res, 400, {
          error: "A non-empty query is required",
        });
      }

      const result = recommend(
        query.trim().slice(0, 300),
        getProducts()
      );

      return send(res, 200, result);
    }

    // Unknown route or unsupported method.
    return send(res, 404, {
      error: "Route not found",
    });
  } catch (err) {
    handleError(res, err);
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`PriceSage API listening on ${HOST}:${PORT}`);
  });

  server.on("error", (err) => {
    console.error("Server startup error:", err.message);
    process.exitCode = 1;
  });
}

module.exports = server;

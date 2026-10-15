// Local SQLite storage for the product catalog and its price data.
// Requires Node.js 22.13+ (uses the built-in node:sqlite module).
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { PRODUCTS, STORES } = require("./products");

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "pricesage.db");
const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
    base_price REAL NOT NULL, rating REAL NOT NULL, review_count INTEGER NOT NULL,
    tags TEXT NOT NULL, specs TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS store_prices (
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    price REAL NOT NULL, delivery_days INTEGER NOT NULL,
    PRIMARY KEY (product_id, store_id)
  );
  CREATE TABLE IF NOT EXISTS price_history (
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    month_index INTEGER NOT NULL, price REAL NOT NULL,
    PRIMARY KEY (product_id, month_index)
  );
`);

function seedIfEmpty() {
  if (db.prepare("SELECT 1 FROM products LIMIT 1").get()) return;
  const insertStore = db.prepare("INSERT INTO stores (id, name) VALUES (?, ?)");
  const insertProduct = db.prepare(`INSERT INTO products
    (id, name, category, base_price, rating, review_count, tags, specs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertPrice = db.prepare(`INSERT INTO store_prices
    (product_id, store_id, price, delivery_days) VALUES (?, ?, ?, ?)`);
  const insertHistory = db.prepare(`INSERT INTO price_history
    (product_id, month_index, price) VALUES (?, ?, ?)`);
  db.exec("BEGIN");
  try {
    STORES.forEach((name, i) => insertStore.run(i + 1, name));
    for (const product of PRODUCTS) {
      insertProduct.run(product.id, product.n, product.c, product.b, product.r,
        product.rv, JSON.stringify(product.t), product.s);
      product.prices.forEach((price, i) => insertPrice.run(product.id, i + 1, price.v, price.d));
      product.hist.forEach((price, i) => insertHistory.run(product.id, i, price));
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function getStores() {
  return db.prepare("SELECT name FROM stores ORDER BY id").all().map((row) => row.name);
}

function getProducts() {
  return db.prepare(`
    SELECT p.id, p.name AS n, p.category AS c, p.base_price AS b,
      p.rating AS r, p.review_count AS rv, p.tags, p.specs AS s,
      sp.store_id, st.name AS store, sp.price, sp.delivery_days,
      ph.month_index, ph.price AS history_price
    FROM products p
    LEFT JOIN store_prices sp ON sp.product_id = p.id
    LEFT JOIN stores st ON st.id = sp.store_id
    LEFT JOIN price_history ph ON ph.product_id = p.id
    ORDER BY p.id, sp.store_id, ph.month_index
  `).all().reduce((products, row) => {
    let product = products[products.length - 1];
    if (!product || product.id !== row.id) {
      product = { id: row.id, n: row.n, c: row.c, b: row.b, r: row.r, rv: row.rv,
        t: JSON.parse(row.tags), s: row.s, prices: [], hist: [] };
      products.push(product);
    }
    if (row.store_id && !product.prices.some((price) => price.s === row.store)) {
      product.prices.push({ s: row.store, v: row.price, d: row.delivery_days });
    }
    if (row.month_index !== null && product.hist[row.month_index] === undefined) {
      product.hist[row.month_index] = row.history_price;
    }
    return products;
  }, []).map((product) => {
    product.best = product.prices.reduce((best, price) => !best || price.v < best.v ? price : best, null);
    product.high = Math.max(...product.prices.map((price) => price.v));
    return product;
  });
}

seedIfEmpty();
module.exports = { db, getProducts, getStores };

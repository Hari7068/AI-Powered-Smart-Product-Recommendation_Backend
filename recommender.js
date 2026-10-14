// Rule-based recommendation engine: query parsing + weighted scoring.
const { PRODUCTS } = require("./products");

const FEATURE_KEYWORDS = {
  gaming: ["gaming", "game", "fps"],
  camera: ["camera", "photo", "photography", "selfie"],
  battery: ["battery", "long lasting"],
  light: ["light", "lightweight", "portable", "travel"],
  student: ["student", "college", "study", "school"],
  noise: ["noise", "anc", "quiet"],
  music: ["music", "audio", "bass"],
  fitness: ["fitness", "gym", "running", "workout", "sport"],
  display: ["display", "screen", "amoled"],
  budget: ["cheap", "budget", "affordable"],
  premium: ["premium", "flagship", "best"],
  work: ["work", "office", "productivity"],
  drawing: ["drawing", "sketch", "art"],
};

const CATEGORY_KEYWORDS = {
  Phones: ["phone", "mobile", "smartphone"],
  Laptops: ["laptop", "notebook"],
  Headphones: ["headphone", "earbud", "earphone", "headset"],
  Watches: ["watch", "smartwatch", "band"],
  Tablets: ["tablet", "tab", "ipad"],
};

const inr = (n) => "₹" + n.toLocaleString("en-IN");

function parseQuery(query) {
  const q = String(query || "").toLowerCase();
  const intent = { cats: [], feats: [], budget: null };

  const m = q.match(/(?:under|below|within|less than|upto|up to|max|budget(?: of)?)\s*(?:rs\.?|₹)?\s*([\d,.]+)\s*(k|l|lakh)?/);
  if (m) {
    let v = parseFloat(m[1].replace(/,/g, ""));
    if (m[2] === "k") v *= 1e3;
    if (m[2] === "l" || m[2] === "lakh") v *= 1e5;
    if (!Number.isNaN(v)) intent.budget = v;
  }
  for (const c in CATEGORY_KEYWORDS) if (CATEGORY_KEYWORDS[c].some((w) => q.includes(w))) intent.cats.push(c);
  for (const f in FEATURE_KEYWORDS) if (FEATURE_KEYWORDS[f].some((w) => q.includes(w))) intent.feats.push(f);
  return intent;
}

function scoreProduct(p, intent) {
  const rating = (p.r - 3.5) / 1.5;

  const pool = PRODUCTS.filter((x) => x.c === p.c).map((x) => x.best.v);
  const lo = Math.min(...pool);
  const hi = Math.max(...pool);
  let value = hi === lo ? 1 : 1 - (p.best.v - lo) / (hi - lo);
  if (intent.budget) {
    value =
      p.best.v <= intent.budget
        ? 0.6 + 0.4 * (p.best.v / intent.budget > 0.6 ? 1 : 0.6)
        : Math.max(0, 0.4 - (p.best.v - intent.budget) / intent.budget);
  }

  const hits = intent.feats.filter((f) => p.t.includes(f));
  const fit = intent.feats.length ? hits.length / intent.feats.length : 0.5;
  const popular = Math.min(1, Math.log10(p.rv) / 4.4);
  const categoryOk = !intent.cats.length || intent.cats.includes(p.c) ? 1 : 0;

  const total = categoryOk * (0.3 * rating + 0.25 * value + 0.35 * fit + 0.1 * popular);

  const why = [];
  if (hits.length) why.push("matches " + hits.join(", "));
  if (intent.budget && p.best.v <= intent.budget) why.push("fits your " + inr(intent.budget) + " budget");
  if (p.r >= 4.5) why.push("top-rated (" + p.r + ")");
  if (value > 0.7 && !intent.budget) why.push("strong value for " + p.c.toLowerCase());
  if (!why.length) why.push("solid all-rounder");

  return {
    id: p.id,
    pct: Math.round(Math.max(0, Math.min(1, total / 0.95)) * 100),
    why: "Why: " + why.join("; ") + ".",
  };
}

function recommend(query) {
  const intent = parseQuery(query);
  const results = PRODUCTS.map((p) => scoreProduct(p, intent)).sort((a, b) => b.pct - a.pct);
  return { intent, results };
}

module.exports = { recommend, parseQuery };

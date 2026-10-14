// Product catalog + deterministic mock price generator.
// Replace this module with a database or a real price-feed API in production.
const STORES = ["Amazon", "Flipkart", "Croma", "Reliance Digital", "Vijay Sales"];

const RAW = [
  { id: 1, n: "Aero P12", c: "Phones", b: 27999, r: 4.4, rv: 8120, t: ["camera", "battery", "display", "5g"], s: "6.7in AMOLED, 5000 mAh" },
  { id: 2, n: "Volt G9", c: "Phones", b: 34999, r: 4.5, rv: 5230, t: ["gaming", "performance", "display", "battery", "5g"], s: "144 Hz, flagship chip" },
  { id: 3, n: "Lumen C7", c: "Phones", b: 42999, r: 4.6, rv: 3980, t: ["camera", "photo", "display", "premium"], s: "200 MP, night mode" },
  { id: 4, n: "Spark A3", c: "Phones", b: 11499, r: 4.1, rv: 15400, t: ["budget", "battery", "student"], s: "6000 mAh, 90 Hz" },
  { id: 5, n: "Slate Air 14", c: "Laptops", b: 72990, r: 4.5, rv: 2670, t: ["light", "portable", "battery", "work", "student", "premium"], s: "14in, 16 GB, 18 h battery" },
  { id: 6, n: "Forge G15", c: "Laptops", b: 89990, r: 4.4, rv: 1840, t: ["gaming", "performance", "display", "editing"], s: "RTX GPU, 165 Hz" },
  { id: 7, n: "Campus Lite 15", c: "Laptops", b: 38990, r: 4.0, rv: 6320, t: ["budget", "student", "work"], s: "15.6in, 8 GB, SSD" },
  { id: 8, n: "Hush ANC 700", c: "Headphones", b: 17990, r: 4.6, rv: 4410, t: ["noise", "music", "travel", "battery", "premium"], s: "40 h, active noise cancelling" },
  { id: 9, n: "BeatRun Sport", c: "Headphones", b: 2999, r: 4.2, rv: 21800, t: ["fitness", "sport", "budget", "water", "music"], s: "Sweatproof earbuds" },
  { id: 10, n: "Pulse Fit 3", c: "Watches", b: 4499, r: 4.1, rv: 12950, t: ["fitness", "sport", "budget", "battery", "water"], s: "14-day battery, SpO2" },
  { id: 11, n: "Orbit Pro", c: "Watches", b: 21999, r: 4.5, rv: 3140, t: ["fitness", "premium", "display", "gps", "health"], s: "AMOLED, GPS, ECG" },
  { id: 12, n: "Sketch Tab 11", c: "Tablets", b: 26999, r: 4.3, rv: 2210, t: ["student", "drawing", "display", "portable", "work"], s: "11in 120 Hz, stylus" },
];

const seed = (a, b) => {
  const x = Math.sin(a * 97.13 + b * 31.7) * 10000;
  return x - Math.floor(x);
};

const PRODUCTS = RAW.map((p) => {
  const prices = STORES.map((s, i) => ({
    s,
    v: Math.round((p.b * (0.93 + seed(p.id, i) * 0.14)) / 10) * 10,
    d: [1, 2, 3, 4, 2][i] + Math.round(seed(p.id, i + 9) * 2),
  }));
  const best = prices.reduce((a, b) => (a.v <= b.v ? a : b));
  const high = Math.max(...prices.map((x) => x.v));
  const hist = [];
  for (let m = 0; m < 6; m++) hist.push(Math.round((best.v * (1 + (seed(p.id, m + 20) - 0.35) * 0.16)) / 10) * 10);
  hist[5] = best.v;
  return { ...p, prices, best, high, hist };
});

module.exports = { PRODUCTS, STORES };

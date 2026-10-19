// ShopSphere backend. The SAME code runs as Blue (v1.0) and Green (v2.0).
// APP_VERSION decides: attributes (5 or 9), options (features), and the web layout that is served.
const express = require('express');
const os = require('os');
const path = require('path');
const seed = require('./data/products.json');

const VERSION = process.env.APP_VERSION || '1.0';
const ENV_NAME = (process.env.ENV_NAME || 'blue').toLowerCase();
const PORT = process.env.PORT || 3000;
const IS_V2 = VERSION.startsWith('2');

const V1_FIELDS = ['id', 'name', 'price', 'category', 'stock'];                    // 5 attributes
const V2_FIELDS = [...V1_FIELDS, 'brand', 'rating', 'discount', 'description'];    // 9 attributes
const FIELDS = IS_V2 ? V2_FIELDS : V1_FIELDS;
const DEFAULTS = { brand: 'Unbranded', rating: 0, discount: 0, description: 'No description available yet.' };
const FEATURES = IS_V2
  ? ['Search by name', 'Category filter', 'Brand filter', 'Sort by price / rating / discount', 'In-stock filter', 'Discount pricing', 'Star ratings', 'Quick view', 'Add to cart']
  : ['Search by name', 'Category filter'];
const LAYOUT = IS_V2 ? 'Modern card grid with filter sidebar' : 'Classic table list';

// Hidden bug used for the rollback demo (only possible in v2.0).
// When ON, product-detail pages fail for products with a discount of 20% or more.
let FAULT = process.env.FAULT === '1';

const shape = (p) => { const o = {}; for (const f of FIELDS) o[f] = p[f] !== undefined ? p[f] : DEFAULTS[f]; return o; };
let products = seed.map(shape);
let nextId = Math.max(...seed.map((p) => p.id)) + 1;

const ok = (res, data, extra = {}, status = 200) => res.status(status).json({ success: true, data, ...extra });
const fail = (res, status, message, details) => res.status(status).json({ success: false, error: { message, details } });

function validate(body, partial = false) {
  const errors = [], v = {};
  const has = (k) => body[k] !== undefined && body[k] !== '';
  const need = (k) => { if (!partial && !has(k)) errors.push(`${k} is required`); return has(k); };
  if (need('name')) { if (typeof body.name !== 'string' || !body.name.trim()) errors.push('name must be text'); else v.name = body.name.trim(); }
  if (need('category')) { if (typeof body.category !== 'string' || !body.category.trim()) errors.push('category must be text'); else v.category = body.category.trim(); }
  if (need('price')) { const n = Number(body.price); if (!(n >= 0)) errors.push('price must be a number >= 0'); else v.price = n; }
  if (need('stock')) { const n = Number(body.stock); if (!Number.isInteger(n) || n < 0) errors.push('stock must be a whole number >= 0'); else v.stock = n; }
  if (FIELDS.includes('brand') && has('brand')) v.brand = String(body.brand).trim();
  if (FIELDS.includes('description') && has('description')) v.description = String(body.description).trim();
  if (FIELDS.includes('rating') && has('rating')) { const n = Number(body.rating); if (!(n >= 0 && n <= 5)) errors.push('rating must be between 0 and 5'); else v.rating = n; }
  if (FIELDS.includes('discount') && has('discount')) { const n = Number(body.discount); if (!(n >= 0 && n <= 100)) errors.push('discount must be between 0 and 100'); else v.discount = n; }
  return { errors, v };
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public', IS_V2 ? 'green' : 'blue')));

app.get('/health', (req, res) => res.json({ status: 'ok', environment: ENV_NAME, version: VERSION }));   // stays OK even with the hidden bug

app.get('/api/info', (req, res) => ok(res, {
  environment: ENV_NAME, version: VERSION, attributeCount: FIELDS.length, attributes: FIELDS,
  features: FEATURES, layout: LAYOUT, hostname: os.hostname() }));

app.get('/api/products', (req, res) => {
  const q = (req.query.search || '').toString().toLowerCase();
  const cat = (req.query.category || '').toString().toLowerCase();
  let list = products.filter((p) => (!q || p.name.toLowerCase().includes(q)) && (!cat || p.category.toLowerCase() === cat));
  if (IS_V2) {   // extra options that exist only in v2.0
    const brand = (req.query.brand || '').toString().toLowerCase();
    if (brand) list = list.filter((p) => p.brand.toLowerCase() === brand);
    if (req.query.instock === '1') list = list.filter((p) => p.stock > 0);
    const sorters = { price_asc: (a, b) => a.price - b.price, price_desc: (a, b) => b.price - a.price,
      rating: (a, b) => b.rating - a.rating, discount: (a, b) => b.discount - a.discount };
    if (sorters[req.query.sort]) list = [...list].sort(sorters[req.query.sort]);
  }
  ok(res, list, { count: list.length });
});

app.get('/api/products/:id', (req, res) => {
  const p = products.find((x) => x.id === Number(req.params.id));
  if (!p) return fail(res, 404, 'Product not found');
  if (IS_V2 && FAULT && p.discount >= 20) {
    console.error(`BUG: discount calculation failed for product ${p.id}`);
    return fail(res, 500, 'Discount calculation failed (bug in v2.0)');
  }
  ok(res, p);
});

app.post('/api/products', (req, res) => {
  const { errors, v } = validate(req.body || {});
  if (errors.length) return fail(res, 400, 'Validation failed', errors);
  const p = shape({ ...v, id: nextId++ });
  products.push(p);
  ok(res, p, {}, 201);
});

app.put('/api/products/:id', (req, res) => {
  const i = products.findIndex((x) => x.id === Number(req.params.id));
  if (i < 0) return fail(res, 404, 'Product not found');
  const { errors, v } = validate(req.body || {}, true);
  if (errors.length) return fail(res, 400, 'Validation failed', errors);
  products[i] = shape({ ...products[i], ...v });
  ok(res, products[i]);
});

app.delete('/api/products/:id', (req, res) => {
  const i = products.findIndex((x) => x.id === Number(req.params.id));
  if (i < 0) return fail(res, 404, 'Product not found');
  ok(res, products.splice(i, 1)[0]);
});

// Used by the Deployment Console to simulate "a release that has a hidden bug"
app.get('/api/_fault', (req, res) => ok(res, { fault: FAULT, supported: IS_V2 }));
app.post('/api/_fault', (req, res) => {
  if (!IS_V2) return fail(res, 400, 'Fault simulation is only available in v2.0');
  FAULT = !!(req.body && req.body.enabled);
  ok(res, { fault: FAULT });
});

app.use('/api', (req, res) => fail(res, 404, 'API route not found'));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return fail(res, 400, 'Invalid JSON body');
  console.error(err); fail(res, 500, 'Internal server error');
});
app.listen(PORT, () => console.log(`ShopSphere ${ENV_NAME.toUpperCase()} v${VERSION} (${FIELDS.length} attributes) on port ${PORT}`));

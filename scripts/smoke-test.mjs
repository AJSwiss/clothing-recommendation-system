// Smoke test for a running Thread Match instance.
// Run it after `docker compose up` or `npm run dev`. It checks that the
// API answers, the database works and the main user flow does not break.
//
// Usage:
//   npm run smoke
//   npm run smoke -- http://localhost:3000
//   BASE_URL=http://my-host:3000 DATABASE_URL=postgres://... npm run smoke
//
// If the `pg` package is installed (run `npm install` first), the script also
// connects to Postgres directly and deletes the throwaway user it creates.
// Without `pg` it checks the database only through the API and leaves the
// throwaway user (smoke-test-*@example.com) in place.

import {createRequire} from 'node:module';

const BASE_URL = (process.argv[2] || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://clothes:clothes_dev@localhost:5432/clothes';
const TIMEOUT_MS = 10_000;

const useColor = process.stdout.isTTY;
const paint = (code, text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const green = (t) => paint(32, t), red = (t) => paint(31, t), yellow = (t) => paint(33, t), dim = (t) => paint(2, t);

let passed = 0, failed = 0, warned = 0;

class Skip extends Error {}

async function check(name, fn) {
  const started = Date.now();
  try {
    const note = await fn();
    passed++;
    console.log(`${green('PASS')} ${name} ${dim(`(${Date.now() - started}ms)`)}${note ? dim(` - ${note}`) : ''}`);
    return true;
  } catch (err) {
    if (err instanceof Skip) {
      warned++;
      console.log(`${yellow('SKIP')} ${name} ${dim(`- ${err.message}`)}`);
      return false;
    }
    failed++;
    console.log(`${red('FAIL')} ${name}\n     ${red(err.message)}`);
    return false;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(method, path, {body, token, expect = 200} = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(BASE_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(`${method} ${path} could not connect: ${err.cause?.code || err.message}`);
  }
  const text = await res.text();
  let data = text;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  if (res.status !== expect) {
    const detail = typeof data === 'object' && data?.error ? data.error : text.slice(0, 200);
    throw new Error(`${method} ${path} returned ${res.status}, expected ${expect}: ${detail}`);
  }
  return {res, data};
}

async function loadPg() {
  try {
    const require = createRequire(new URL('../server/package.json', import.meta.url));
    return require('pg');
  } catch {
    return null;
  }
}

console.log(`Smoke testing ${BASE_URL}\n`);

// ---- Direct database checks (optional) -------------------------------------
const pg = await loadPg();
let pool = null;

await check('Database accepts connections', async () => {
  if (!pg) throw new Skip('`pg` not installed; run `npm install` to enable direct DB checks');
  pool = new pg.Pool({connectionString: DATABASE_URL, connectionTimeoutMillis: 5000, max: 1});
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    await pool.end().catch(() => {});
    pool = null;
    throw new Error(`Could not connect to ${DATABASE_URL.replace(/:[^:@/]+@/, ':***@')}: ${err.message}`);
  }
});

if (pool) {
  await check('Database schema has the expected tables', async () => {
    const {rows} = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public'`);
    const have = new Set(rows.map((r) => r.table_name));
    const missing = ['users', 'user_preferences', 'clothing_items', 'user_interactions'].filter((t) => !have.has(t));
    assert(!missing.length, `Missing tables: ${missing.join(', ')}`);
  });

  await check('Catalog is loaded', async () => {
    const {rows} = await pool.query('SELECT count(*)::int AS n FROM clothing_items');
    assert(rows[0].n > 0, 'clothing_items is empty; the Kaggle catalog import has not run');
    return `${rows[0].n} items`;
  });
}

// ---- HTTP checks ------------------------------------------------------------
const serverUp = await check('GET /api/health', async () => {
  const {data} = await request('GET', '/api/health');
  assert(data?.ok === true, `Unexpected body: ${JSON.stringify(data)}`);
});

if (!serverUp) {
  console.log(red(`\nServer is not reachable at ${BASE_URL}; skipping the remaining HTTP checks.`));
} else {
  await check('GET / serves the web app', async () => {
    const {res, data} = await request('GET', '/');
    assert((res.headers.get('content-type') || '').includes('text/html'), 'Response is not HTML');
    assert(typeof data === 'string' && data.includes('<div id="root"'), 'HTML does not contain the React root element; is client/dist built?');
  });

  await check('GET /api/faq', async () => {
    const {data} = await request('GET', '/api/faq');
    assert(Array.isArray(data) && data.length > 0, 'FAQ list is empty');
  });

  await check('Protected routes reject missing tokens', async () => {
    await request('GET', '/api/recommendations', {expect: 401});
  });

  // Full user flow with a throwaway account (exercises DB reads and writes).
  const email = `smoke-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = 'smoke-test-password';
  let token = null, userId = null, item = null;

  await check('Register a new user (DB write)', async () => {
    const {data} = await request('POST', '/api/auth/register',
      {body: {email, firstName: 'Smoke', password}, expect: 201});
    assert(data.token && data.user?.id, 'Response is missing token or user id');
    userId = data.user.id;
  });

  await check('Log in as that user (DB read + bcrypt + JWT)', async () => {
    if (!userId) throw new Skip('registration failed');
    const {data} = await request('POST', '/api/auth/login', {body: {email, password}});
    assert(data.token, 'Response is missing token');
    token = data.token;
  });

  await check('Wrong password is rejected', async () => {
    if (!userId) throw new Skip('registration failed');
    await request('POST', '/api/auth/login', {body: {email, password: 'definitely-wrong'}, expect: 401});
  });

  const needToken = () => { if (!token) throw new Skip('login failed'); };

  await check('Save and read back preferences', async () => {
    needToken();
    const prefs = {colors: ['black'], shirtStyles: ['casual'], pantStyles: ['casual'], materials: ['cotton']};
    await request('POST', '/api/user/preferences', {token, body: prefs});
    const {data} = await request('GET', '/api/user/preferences', {token});
    assert(data?.preferred_colors?.includes('black'), 'Saved preferences were not returned');
  });

  await check('GET /api/recommendations', async () => {
    needToken();
    const {data} = await request('GET', '/api/recommendations?limit=5', {token});
    assert(Array.isArray(data.items), 'Response has no items array');
    if (!data.items.length) throw new Skip('no catalog items returned; is the catalog imported?');
    item = data.items[0];
    assert(typeof item.match_score === 'number', 'Items are missing match_score');
    return `${data.total} total`;
  });

  await check('GET /api/discover/next', async () => {
    needToken();
    const {data} = await request('GET', '/api/discover/next', {token});
    if (data === null) throw new Skip('no unseen items');
    assert(data.id, 'Item has no id');
  });

  await check('GET /api/items/:id and /similar', async () => {
    if (!item) throw new Skip('no item to look up');
    const {data} = await request('GET', `/api/items/${item.id}`);
    assert(data.id === item.id, 'Returned the wrong item');
    const {data: sim} = await request('GET', `/api/items/${item.id}/similar`);
    assert(Array.isArray(sim.similar), 'Response has no similar array');
  });

  await check('Unknown item returns 404', async () => {
    await request('GET', '/api/items/00000000-0000-0000-0000-000000000000', {expect: 404});
  });

  await check('Catalog image is served', async () => {
    if (!item?.image_url) throw new Skip('no item with an image_url');
    if (/^https?:\/\//.test(item.image_url)) {
      const res = await fetch(item.image_url, {method: 'HEAD', signal: AbortSignal.timeout(TIMEOUT_MS)});
      assert(res.ok, `${item.image_url} returned ${res.status}`);
    } else {
      const {res} = await request('GET', item.image_url.startsWith('/') ? item.image_url : `/${item.image_url}`);
      assert((res.headers.get('content-type') || '').startsWith('image/'), 'Response is not an image');
    }
  });

  await check('Swipe like, then see it in outfits', async () => {
    needToken();
    if (!item) throw new Skip('no item to swipe');
    await request('POST', '/api/discover/swipe', {token, body: {itemId: item.id, action: 'like'}});
    const {data} = await request('GET', '/api/outfits', {token});
    assert(Array.isArray(data) && data.some((x) => x.id === item.id), 'Liked item is missing from outfits');
  });

  // ---- Cleanup ----
  if (userId) {
    if (pool) {
      await check('Clean up the test user', async () => {
        await pool.query('DELETE FROM users WHERE id=$1', [userId]);
      });
    } else {
      console.log(dim(`\nNote: test user ${email} was left in the database (no direct DB access for cleanup).`));
    }
  }
}

if (pool) await pool.end();

const summary = `${passed} passed, ${failed} failed, ${warned} skipped`;
console.log(`\n${failed ? red(summary) : green(summary)}`);
process.exit(failed ? 1 : 0);

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');

const port = Number(process.env.PORT || 8000);
const host = process.env.HOST || '127.0.0.1';
const appFile = path.join(__dirname, 'Personalizer');
const dataDirectory = process.env.DATA_DIR || __dirname;
const dataFile = path.join(dataDirectory, '.personalizer-analytics.json');
const tokenFile = path.join(dataDirectory, '.personalizer-admin-token');
const cookieName = 'personalizer_visitor';
const visitorIds = new Set();
const personalizedVisitorIds = new Set();
let writeQueue = Promise.resolve();

const statsPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Personalizer Analytics</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f4f4;color:#171717;font-family:Arial,Helvetica,sans-serif}.top{background:#101010;color:#fff;padding:22px 16px;border-bottom:5px solid #ffd400}.top h1,main h2{margin:0}.top h1{font-size:25px}main{max-width:760px;margin:28px auto;padding:0 16px}form{display:flex;align-items:end;gap:12px;flex-wrap:wrap}label{display:grid;gap:7px;flex:1;min-width:220px;font-weight:700;font-size:14px}input{font:inherit;padding:12px;border:1px solid #bbb;border-radius:6px}button{border:0;border-radius:6px;padding:13px 18px;background:#ffd400;font-weight:700;cursor:pointer}.hint,#status{color:#555;font-size:14px;line-height:1.5}.counts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:24px}.count{background:#fff;border:1px solid #ddd;border-radius:6px;padding:20px}.count strong{display:block;font-size:36px;margin-bottom:8px}.count span{font-size:14px;color:#555}@media(max-width:520px){.counts{grid-template-columns:1fr}button{width:100%}}
</style>
</head>
<body>
<header class="top"><h1>Personalizer Analytics</h1></header>
<main>
<h2>Usage totals</h2>
<p class="hint">Counts are unique browsers and unique browsers that generated a flyer with a name. Names, photos, and IP addresses are not collected.</p>
<form id="stats-form"><label for="admin-token">Admin token<input id="admin-token" type="password" autocomplete="current-password" required></label><button type="submit">Load counts</button></form>
<p id="status" role="status" aria-live="polite"></p>
<section class="counts" aria-label="Analytics totals"><div class="count"><strong id="visitors">-</strong><span>Unique visitors</span></div><div class="count"><strong id="flyers">-</strong><span>Visitors who created a named flyer</span></div></section>
</main>
<script>
document.getElementById('stats-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = document.getElementById('status');
  status.textContent = 'Loading counts...';
  try {
    const response = await fetch('/api/stats', {
      headers: { Authorization: 'Bearer ' + document.getElementById('admin-token').value }
    });
    if (!response.ok) throw new Error(response.status === 401 ? 'The admin token was not accepted.' : 'Could not load analytics.');
    const counts = await response.json();
    document.getElementById('visitors').textContent = counts.uniqueVisitors;
    document.getElementById('flyers').textContent = counts.namedFlyerCreators;
    status.textContent = 'Counts updated.';
  } catch (error) {
    status.textContent = error.message || 'Could not reach the analytics server.';
  }
});
</script>
</body>
</html>`;

async function loadData() {
  try {
    const data = JSON.parse(await fs.readFile(dataFile, 'utf8'));
    for (const id of data.visitors || []) visitorIds.add(id);
    for (const id of data.namedFlyerCreators || []) personalizedVisitorIds.add(id);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function loadAdminToken() {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN;
  try {
    return (await fs.readFile(tokenFile, 'utf8')).trim();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const token = crypto.randomBytes(24).toString('hex');
    await fs.writeFile(tokenFile, token, { mode: 0o600, flag: 'wx' });
    return token;
  }
}

function saveData() {
  const snapshot = JSON.stringify({
    visitors: [...visitorIds],
    namedFlyerCreators: [...personalizedVisitorIds]
  });
  const nextWrite = writeQueue.catch(() => {}).then(async () => {
    const temporaryFile = `${dataFile}.${process.pid}.tmp`;
    await fs.writeFile(temporaryFile, snapshot, { mode: 0o600 });
    await fs.rename(temporaryFile, dataFile);
  });
  writeQueue = nextWrite;
  return nextWrite;
}

function visitorIdFromRequest(request, response) {
  const cookies = (request.headers.cookie || '').split(';');
  const visitorCookie = cookies.map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`));
  const existingId = visitorCookie && visitorCookie.slice(cookieName.length + 1);
  if (existingId && /^[0-9a-f-]{36}$/i.test(existingId)) return existingId;

  const visitorId = crypto.randomUUID();
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader('Set-Cookie', `${cookieName}=${visitorId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`);
  return visitorId;
}

function send(response, status, body, contentType = 'application/json; charset=utf-8') {
  response.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  });
  response.end(body);
}

function hasAdminToken(request, expectedToken) {
  const authorization = request.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) return false;
  const provided = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(expectedToken);
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

async function handleRequest(request, response, adminToken) {
  const pathname = new URL(request.url, 'http://localhost').pathname;

  if (request.method === 'GET' && (pathname === '/' || pathname === '/Personalizer')) {
    send(response, 200, await fs.readFile(appFile), 'text/html; charset=utf-8');
    return;
  }
  if (request.method === 'GET' && pathname === '/stats') {
    send(response, 200, statsPage, 'text/html; charset=utf-8');
    return;
  }
  if (request.method === 'POST' && (pathname === '/api/visit' || pathname === '/api/personalized')) {
    const visitorId = visitorIdFromRequest(request, response);
    const newVisitor = !visitorIds.has(visitorId);
    visitorIds.add(visitorId);
    const newCreator = pathname === '/api/personalized' && !personalizedVisitorIds.has(visitorId);
    if (newCreator) personalizedVisitorIds.add(visitorId);
    if (newVisitor || newCreator) await saveData();
    send(response, 204, '');
    return;
  }
  if (request.method === 'GET' && pathname === '/api/stats') {
    if (!hasAdminToken(request, adminToken)) {
      send(response, 401, JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    send(response, 200, JSON.stringify({
      uniqueVisitors: visitorIds.size,
      namedFlyerCreators: personalizedVisitorIds.size
    }));
    return;
  }
  send(response, 404, JSON.stringify({ error: 'Not found' }));
}

async function start() {
  await fs.mkdir(dataDirectory, { recursive: true });
  await loadData();
  const adminToken = await loadAdminToken();
  const server = http.createServer((request, response) => {
    handleRequest(request, response, adminToken).catch(error => {
      console.error('Request failed:', error.message);
      if (!response.headersSent) send(response, 500, JSON.stringify({ error: 'Internal server error' }));
      else response.destroy();
    });
  });
  server.listen(port, host, () => {
    const address = server.address();
    console.log(`Personalizer running at http://localhost:${address.port}`);
    console.log(`Analytics dashboard: http://localhost:${address.port}/stats`);
    if (!process.env.ADMIN_TOKEN) console.log(`Admin token saved in ${tokenFile}`);
  });
}

start().catch(error => {
  console.error('Could not start Personalizer:', error.message);
  process.exitCode = 1;
});
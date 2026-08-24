const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const args = process.argv.slice(2);
const getArg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const PORT = Number(getArg('port', process.env.PORT || 3000));
const OUT = path.resolve(getArg('dir', path.join(rootDir, 'out')));
const PID_FILE = path.join(rootDir, '.server.pid');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

try {
  fs.writeFileSync(PID_FILE, String(process.pid));
} catch {}

const candidatesFor = (p) => {
  const full = path.join(OUT, p);
  if (p.endsWith('/') || p === '') return [path.join(full, 'index.html')];
  return [full, `${full}.html`, path.join(full, 'index.html')];
};

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  const safe = path.normalize(urlPath).replace(/^(\.\.(\\|\/|$))+/, '');
  const full = path.resolve(OUT, `.${path.sep}${safe}`);
  if (!full.startsWith(OUT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  for (const file of candidatesFor(safe)) {
    try {
      const st = fs.statSync(file);
      if (!st.isFile()) continue;
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(file).pipe(res);
      return;
    } catch {}
  }

  const notFound = path.join(OUT, '404.html');
  try {
    const body = fs.readFileSync(notFound);
    res.writeHead(404, { 'Content-Type': MIME['.html'] });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Money Meva serving ${OUT}`);
  console.log(`http://localhost:${PORT}`);
});

const shutdown = () => {
  try {
    fs.unlinkSync(PID_FILE);
  } catch {}
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', () => {
  try {
    fs.unlinkSync(PID_FILE);
  } catch {}
});

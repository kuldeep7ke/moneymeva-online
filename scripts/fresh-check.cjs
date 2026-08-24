const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const ref = path.join(root, 'out', 'index.html');
if (!fs.existsSync(ref)) {
  console.log('STALE');
  process.exit(0);
}
const t = fs.statSync(ref).mtimeMs;

let stale = false;
const scan = (dir) => {
  if (stale) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (stale) return;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) {
      scan(f);
    } else if (fs.statSync(f).mtimeMs > t) {
      stale = true;
      return;
    }
  }
};

scan(path.join(root, 'src'));
scan(path.join(root, 'public'));
console.log(stale ? 'STALE' : 'FRESH');

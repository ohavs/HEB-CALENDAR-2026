// שרת סטטי שמחיל את הכותרות מ-firebase.json, אבל את ה-CSP באכיפה מלאה
// ולא ב-report-only - כדי לראות מה באמת היה נשבר.
const http = require('http'), fs = require('fs'), path = require('path');
const cfg = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
const all = cfg.hosting.headers.find(h => h.source === '**').headers;
const csp = all.find(h => h.key.startsWith('Content-Security-Policy')).value;
const others = all.filter(h => !h.key.startsWith('Content-Security-Policy'));
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json', '.ico':'image/x-icon' };

http.createServer((req, res) => {
  let p = path.join('dist', decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join('dist', 'index.html');
  for (const h of others) res.setHeader(h.key, h.value);
  res.setHeader('Content-Security-Policy', csp);  // אכיפה, לא דיווח
  res.setHeader('Content-Type', types[path.extname(p)] || 'application/octet-stream');
  res.end(fs.readFileSync(p));
}).listen(4180, '127.0.0.1', () => console.log('csp server on 4180'));

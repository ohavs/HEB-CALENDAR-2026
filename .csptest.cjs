const { chromium } = require('playwright');
const ok = (l, v, x) => console.log((v ? '✓' : '✗') + ' ' + l + (x ? ' — ' + x : ''));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 412, height: 900 } });
  const violations = [];
  p.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text().slice(0, 160)); });
  await p.goto('http://127.0.0.1:4180/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2000);
  ok('הלוח נטען תחת CSP אוכף', (await p.locator('[role="gridcell"]').count()) === 42);

  await p.getByRole('button', { name: 'אירוע חדש' }).click();
  await p.waitForTimeout(800);
  ok('גיליון נפתח (אנימציות עם סגנון מוטמע)', await p.locator('[role="dialog"]').count() === 1);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);

  await p.getByRole('button', { name: 'שבת וחגים' }).click();
  await p.waitForTimeout(900);
  ok('מסך שבת', await p.locator('text=/הדלקת נרות|כניסת שבת|הבדלה/').first().isVisible());

  await p.getByRole('button', { name: 'הגדרות', exact: true }).click();
  await p.waitForTimeout(900);
  ok('מסך הגדרות', await p.getByText('צפיפות הלוח').isVisible());

  ok('אין הפרות CSP', violations.length === 0, violations.length ? String(violations.length) : '');
  for (const v of violations.slice(0, 6)) console.log('   ' + v);
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

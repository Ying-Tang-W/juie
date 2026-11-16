const { chromium, devices } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const errors = [];
  async function run(name, opts) {
    const ctx = await b.newContext(opts);
    await ctx.addInitScript(() => { window.IA_USE_HTTP_API = false; localStorage.clear(); });
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errors.push(name + ' pageerror: ' + e.message));
    pg.on('console', m => { if (m.type() === 'error') errors.push(name + ' console: ' + m.text()); });
    await pg.goto('http://127.0.0.1:8777/index.html', { waitUntil: 'load' });
    await pg.waitForTimeout(400);
    await pg.screenshot({ path: `${OUT}/${name}-01-login.png` });
    // 登录：访客 + 账号登录
    await pg.fill('#loginName', '樱糖'); await pg.fill('#loginPwd', 'password123');
    await pg.click('#loginSubmit');
    await pg.waitForTimeout(700);
    await pg.waitForSelector('#thumbGrid .thumb', { timeout: 5000 }).catch(() => {});
    await pg.waitForTimeout(900);
    await pg.screenshot({ path: `${OUT}/${name}-02-app.png` });
    const info = await pg.evaluate(() => ({
      thumbs: document.querySelectorAll('.thumb').length,
      owner: document.getElementById('metaOwner').textContent,
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      title: document.getElementById('photoTitle').textContent
    }));
    console.log(name, JSON.stringify(info));
    if (opts.isMobile) {
      // 抽屉
      await pg.click('#btnDrawer'); await pg.waitForTimeout(450);
      await pg.screenshot({ path: `${OUT}/${name}-03-drawer.png` });
      const thumbs = await pg.$$('#thumbGrid .thumb');
      if (thumbs[1]) { await thumbs[1].click(); await pg.waitForTimeout(500); }
      const open = await pg.evaluate(() => document.getElementById('sidebar').classList.contains('is-open'));
      console.log(name, 'drawer closed after select:', !open);
      await pg.waitForTimeout(600);
      await pg.screenshot({ path: `${OUT}/${name}-04-after-select.png` });
    } else {
      await pg.click('.seg-btn[data-mode="note"]'); await pg.waitForTimeout(400);
      await pg.screenshot({ path: `${OUT}/${name}-03-note-mode.png` });
    }
    await ctx.close();
  }
  await run('desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await run('mobile', { ...devices['iPhone 13'], hasTouch: true });
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await b.close();
})();

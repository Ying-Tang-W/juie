const { chromium, devices } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const mk = async (opts) => {
    const ctx = await b.newContext(opts);
    await ctx.addInitScript(() => { window.IA_USE_HTTP_API = false; localStorage.clear(); });
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errors.push('pageerror: ' + e.message));
    pg.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await pg.goto('http://127.0.0.1:8777/index.html'); await pg.waitForSelector('#loginPwd', { state: 'visible' }); await pg.waitForTimeout(400);
    await pg.fill('#loginName', '樱糖'); await pg.fill('#loginPwd', 'password123');
    await pg.click('#loginSubmit'); await pg.waitForTimeout(1200);
    return { ctx, pg };
  };
  // 桌面：点光圈展开引线
  {
    const { ctx, pg } = await mk({ viewport: { width: 1440, height: 900 } });
    const dot = await pg.$('.mark-dot');
    await dot.click(); await pg.waitForTimeout(900);
    console.log('desktop leads drawn:', await pg.$$eval('.lead-h', e => e.length), 'dots visible:', await pg.$$eval('.mark-dot', e => e.length));
    await pg.screenshot({ path: `${OUT}/desktop-04-lead.png` });
    await ctx.close();
  }
  // 手机：编辑模式下点空白打点，弹窗贴底
  {
    const { ctx, pg } = await mk({ ...devices['iPhone 13'], hasTouch: true });
    await pg.click('#editSwitchWrap'); await pg.waitForTimeout(300);
    const box = await (await pg.$('#canvas')).boundingBox(); const pr = await (await pg.$('#photo')).boundingBox();
    await pg.touchscreen.tap(pr.x + pr.width * 0.5, pr.y + pr.height * 0.93);
    await pg.waitForTimeout(400);
    console.log('popover visible:', await pg.isVisible('#markPopover'));
    await pg.fill('#markName', '主体建筑'); await pg.fill('#markNote', '玻璃幕墙反光处理');
    await pg.screenshot({ path: `${OUT}/mobile-05-popover.png` });
    await pg.click('#markSave'); await pg.waitForTimeout(500);
    console.log('marks after save:', await pg.$$eval('.mark-dot', e => e.length), 'popover hidden:', !(await pg.isVisible('#markPopover')));
    // 双击放大
    const zoomBefore = await pg.textContent('#zoomLabel');
    await pg.click('#editSwitchWrap'); await pg.waitForTimeout(200);
    await pg.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await pg.waitForTimeout(80);
    await pg.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await pg.waitForTimeout(400);
    console.log('zoom before/after double-tap:', zoomBefore, await pg.textContent('#zoomLabel'));
    await pg.screenshot({ path: `${OUT}/mobile-06-zoomed.png` });
    await ctx.close();
  }
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await b.close();
})();

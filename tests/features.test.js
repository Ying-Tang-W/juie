const { chromium } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { window.IA_USE_HTTP_API = false; localStorage.clear(); });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const out = [];
  const ok = (id, c, d) => out.push(`${c ? 'PASS' : 'FAIL'} ${id} ${d || ''}`);
  await pg.goto('http://127.0.0.1:8777/index.html');
  await pg.waitForSelector('#loginPwd', { state: 'visible' }); await pg.waitForTimeout(400);
  await pg.fill('#loginName', '樱糖'); await pg.fill('#loginPwd', 'password123');
  await pg.click('#loginSubmit'); await pg.waitForTimeout(900);
  await pg.screenshot({ path: `${OUT}/d-app.png` });

  const cur = () => pg.evaluate(() => window.IA.State.currentId);
  const first = await cur();
  ok('K1 初始 上一张禁用', await pg.isDisabled('#btnPrev'));
  await pg.keyboard.press(']'); await pg.waitForTimeout(300);
  const second = await cur();
  ok('K1 ] 切到下一张', second !== first, `${first}->${second}`);
  ok('K1b 切换后上一张可用', !(await pg.isDisabled('#btnPrev')));
  await pg.click('#btnPrev'); await pg.waitForTimeout(300);
  ok('K2 上一张按钮回到第一张', (await cur()) === first);
  await pg.keyboard.press('2'); await pg.waitForTimeout(200);
  ok('K3 数字键 2 切到显示备注', (await pg.getAttribute('.seg-btn[data-mode="note"]', 'class')).includes('is-active'));
  await pg.keyboard.press('1'); await pg.waitForTimeout(200);
  ok('K3b 数字键 1 回到显示点', (await pg.getAttribute('.seg-btn[data-mode="pointer"]', 'class')).includes('is-active'));
  const z0 = await pg.textContent('#zoomLabel');
  await pg.keyboard.press('+'); await pg.waitForTimeout(100);
  const z1 = await pg.textContent('#zoomLabel');
  await pg.keyboard.press('-'); await pg.keyboard.press('-'); await pg.waitForTimeout(100);
  ok('K4 +/- 缩放', z0 !== z1 && (await pg.textContent('#zoomLabel')) !== z1, `${z0} ${z1} ${await pg.textContent('#zoomLabel')}`);
  await pg.keyboard.press('e'); await pg.waitForTimeout(200);
  ok('K5 E 开启编辑', await pg.isChecked('#editSwitch'));
  await pg.keyboard.press('e'); await pg.waitForTimeout(200);
  ok('K5b E 关闭编辑', !(await pg.isChecked('#editSwitch')));
  await pg.keyboard.press('/');
  ok('K6 / 聚焦搜索', await pg.evaluate(() => document.activeElement.id === 'searchInput'));
  await pg.keyboard.press('Escape');
  // 搜索后 下一张按钮 状态随筛选变化
  await pg.fill('#searchInput', '海岸'); await pg.waitForTimeout(400);
  ok('K7 搜索后 下一张禁用（仅一个结果）', await pg.isDisabled('#btnNext'));
  await pg.fill('#searchInput', ''); await pg.waitForTimeout(400);
  // 弹窗：点图标关闭
  await pg.click('#btnSettings'); await pg.waitForTimeout(250);
  await pg.click('#modalRoot .modal-head .icon-btn svg');
  await pg.waitForTimeout(250);
  ok('M1 点设置弹窗的关闭图标可关闭', await pg.isHidden('#modalRoot'));
  await pg.click('#btnSettings'); await pg.waitForTimeout(250);
  await pg.screenshot({ path: `${OUT}/d-settings.png` });
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  // 上传弹窗
  await pg.click('.nav-tab[data-tab="upload"]'); await pg.waitForTimeout(300);
  await pg.screenshot({ path: `${OUT}/d-upload.png` });
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  // 空状态：切到公开图库 的访客
  await pg.click('#userChip'); await pg.waitForTimeout(200);
  await pg.screenshot({ path: `${OUT}/d-usermenu.png` });
  console.log(out.join('\n'));
  console.log('JS errors:', errs.length ? errs : 'none');
  await b.close();
})();

// 回归测试：CODEX_HANDOFF 第二节交互规则（Mock 模式）
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { window.IA_USE_HTTP_API = false; localStorage.clear(); });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const results = [];
  const check = (id, ok, detail) => results.push(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail || ''}`);
  await pg.goto('http://127.0.0.1:8777/index.html');
  await pg.waitForSelector('#loginPwd', { state: 'visible' }); await pg.waitForTimeout(400);
  await pg.fill('#loginName', '樱糖'); await pg.fill('#loginPwd', 'password123');
  await pg.click('#loginSubmit'); await pg.waitForTimeout(900);
  const dots = () => pg.$$eval('#marks .mark-dot:not(.temp)', e => e.length);
  const leadsH = () => pg.$$eval('#leads .lead-h', e => e.length);
  const labels = () => pg.$$eval('#marks .mark-label', e => e.length);
  const closes = () => pg.$$eval('#marks .mark-label .close', e => e.length);
  const mode = (m) => pg.click(`.seg-btn[data-mode="${m}"]`).then(() => pg.waitForTimeout(250));
  const total = await pg.evaluate(() => window.IA.State.current().marks.length);
  const isOwnerEdit = await pg.evaluate(() => window.IA.State.canEdit());

  // R1 显示点：平时全部光圈可见
  await mode('pointer');
  check('R1a 显示点默认全部光圈可见', (await dots()) === total, `dots=${await dots()} total=${total}`);
  check('R1b 显示点默认不画引线', (await leadsH()) === 0);
  // R1c 点击某光圈：其余隐藏，只留一个 + 引线
  await pg.click('#marks .mark-dot:not(.temp)');
  await pg.waitForTimeout(700);
  check('R1c 点光圈后只留被点中的一个', (await dots()) === 1, `dots=${await dots()}`);
  check('R1d 点光圈后画出一条引线', (await leadsH()) === 1, `leads=${await leadsH()}`);
  // R1e 点 × 收回并恢复全部光圈
  await pg.click('#marks .mark-label .close');
  await pg.waitForTimeout(300);
  check('R1e 点 × 后全部光圈恢复', (await dots()) === total, `dots=${await dots()}`);
  check('R1f 收起后无引线', (await leadsH()) === 0);
  // R1g 点空白也收起
  await pg.click('#marks .mark-dot:not(.temp)'); await pg.waitForTimeout(500);
  const cb = await pg.$eval('#canvas', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top }; }); await pg.mouse.click(cb.x + 30, cb.y + 30); await pg.waitForTimeout(300);
  check('R1g 点画布空白收起引线', (await dots()) === total, `dots=${await dots()}`);

  // R2 显示备注 / 显示名字：不画光圈，画线+文字，标签无 ×
  await mode('note'); await pg.waitForTimeout(600);
  check('R2a 显示备注不画光圈', (await dots()) === 0, `dots=${await dots()}`);
  check('R2b 显示备注一次性画全部引线', (await leadsH()) === total, `leads=${await leadsH()} total=${total}`);
  check('R2c 标签上无 ×', (await closes()) === 0);
  await mode('name'); await pg.waitForTimeout(400);
  check('R2d 显示名字不画光圈', (await dots()) === 0);
  check('R2e 显示名字的标签数 = 标注数', (await labels()) === total, `labels=${await labels()}`);

  // R2f 标签不重叠（避让）
  const overlap = await pg.evaluate(() => {
    const els = [...document.querySelectorAll('#marks .mark-label')].map(e => e.getBoundingClientRect());
    let n = 0;
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i], c = els[j];
      if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) n++;
    }
    return n;
  });
  check('R2f 标签互不重叠', overlap === 0, `overlaps=${overlap}`);

  // R3 纯净模式：什么都不画，标注数隐藏
  await mode('clean'); await pg.waitForTimeout(300);
  check('R3a 纯净模式无光圈/引线/标签', (await dots()) === 0 && (await leadsH()) === 0 && (await labels()) === 0);
  check('R3b 纯净模式隐藏标注数', !(await pg.isVisible('#metaMarks')));
  await mode('pointer'); await pg.waitForTimeout(300);

  // R4 编辑模式：无论底部选哪个模式，都强制画全部光圈
  await pg.click('#editSwitchWrap'); await pg.waitForTimeout(200);
  check('R4a 编辑模式开启', await pg.isChecked('#editSwitch'));
  await mode('note'); await pg.waitForTimeout(400);
  check('R4b 编辑模式 + 显示备注仍画全部光圈', (await dots()) === total, `dots=${await dots()}`);
  await mode('clean'); await pg.waitForTimeout(200);
  check('R4c 纯净模式下编辑中不打点（光圈不画）', (await dots()) === 0);
  await mode('pointer'); await pg.waitForTimeout(200);
  await pg.click('#editSwitchWrap'); await pg.waitForTimeout(200);

  // R5 公开 ≠ 可编辑；访客只读
  check('R5a 所有者可编辑', isOwnerEdit === true);
  await pg.evaluate(() => { window.IA.State.user = { id: 'u3', name: '访客', avatar: '游', desc: '' }; });
  check('R5b 访客 canEdit=false', (await pg.evaluate(() => window.IA.State.canEdit())) === false);

  // R6 新增点不自动展开：模拟保存后 activeMarkId 为空、可见光圈 = 全部
  await pg.evaluate(() => { window.IA.State.user = { id: 'u1', name: '樱糖', avatar: '樱', desc: '' }; });

  console.log(results.join('\n'));
  console.log('JS errors:', errs.length ? errs : 'none');
  await b.close();
})();

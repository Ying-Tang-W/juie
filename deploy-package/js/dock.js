/* ============================================================
   dock.js —— 底部固定控制栏：三互斥单选 + 二级悬浮菜单
   ============================================================ */
window.IA = window.IA || {};

(function () {
  'use strict';
  var U = window.IA.util, S = window.IA.State;
  var $ = U.$;

  var Dock = {};

  Dock.init = function () {
    $('#dockSeg').addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.seg-btn') : null;
      if (!btn) return;
      var mode = btn.dataset.mode;
      // 已是「显示点」再点一次 = 收起/展开二级菜单
      if (mode === S.mode && mode === 'pointer') {
        S.submenuOpen = !S.submenuOpen;
        Dock.sync();
        return;
      }
      Dock.setMode(mode);
    });

    $('#submenu').addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.sub-btn') : null;
      if (!btn) return;
      S.sub = btn.dataset.sub;
      S.activeMarkId = null;
      S.hiddenLeads = {};
      S.submenuOpen = false;          // 选完即收起
      Dock.sync();
      window.IA.Canvas.renderMarks();
    });

    // 点击别处收起二级菜单
    document.addEventListener('mousedown', function (e) {
      if (!S.submenuOpen) return;
      if (e.target.closest && e.target.closest('#dockSeg')) return;
      S.submenuOpen = false;
      Dock.sync();
    });
  };

  Dock.setMode = function (mode) {
    if (S.mode === mode) return;
    S.mode = mode;
    S.activeMarkId = null;
    S.hiddenLeads = {};
    S.submenuOpen = (mode === 'pointer');   // 切到「显示点」时弹出，其余模式不弹出
    Dock.sync();
    window.IA.Canvas.renderMarks();
  };

  Dock.sync = function () {
    U.$$('#dockSeg .seg-btn').forEach(function (b) {
      var on = b.dataset.mode === S.mode;
      b.classList.toggle('is-active', on);
      b.classList.toggle('is-open', on && b.dataset.mode === 'pointer' && S.submenuOpen);
    });
    U.$$('#submenu .sub-btn').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.sub === S.sub);
    });

    var sub = $('#submenu');
    sub.hidden = !(S.mode === 'pointer' && S.submenuOpen);
    $('#segTag').textContent = S.sub === 'note' ? '备注' : '名字';

    var p = S.current();
    var modeText = S.mode === 'pointer'
      ? '显示点 · ' + (S.sub === 'note' ? '备注' : '名字')
      : (S.mode === 'note' ? '显示备注' : (S.mode === 'name' ? '显示名字' : '纯净模式'));

    var suffix = S.mode === 'pointer' ? '（点击光圈展开）' : (S.mode === 'clean' ? '' : '（全部展开）');
    $('#metaMode').textContent = '模式：' + modeText + suffix;

    // 纯净模式：连标注数量这类信息也不展示
    var metaMarks = $('#metaMarks'), sepMarks = $('#metaMarksSep');
    metaMarks.hidden = (S.mode === 'clean');
    if (sepMarks) sepMarks.hidden = (S.mode === 'clean');
    metaMarks.textContent = '标注 ' + (p ? p.marks.length : 0) + ' 个';

    var owner = '—';
    if (p) {
      var u = S.users.filter(function (x) { return x.id === p.ownerId; })[0];
      owner = (u ? u.name : '未知') + ' · ' + (p.isPublic ? '公开' : '私有');
      if (S.canEdit(p)) owner += ' · 可编辑';
      else if (!S.isGuest()) owner += ' · 只读';
      else owner += ' · 访客只读';
    }
    $('#metaOwner').textContent = owner;

    var hint = $('#dockHint');
    if (!p) hint.textContent = '滚轮缩放 · 拖拽平移';
    else if (S.mode === 'clean') {
      hint.textContent = (S.editMode && S.canEdit(p))
        ? '纯净模式：标注与信息已隐藏（退出纯净模式后继续编辑）· 滚轮缩放 · 拖拽平移'
        : '纯净模式：不显示任何标注点与信息 · 滚轮缩放 · 拖拽平移';
    }
    else if (S.editMode && S.canEdit(p)) hint.textContent = '编辑模式：点图片打点 · 点光圈可改内容或删除 · 拖动光圈改位置';
    else if (S.mode === 'pointer') hint.textContent = '点击光圈展开引线（其余光圈隐藏）· 点 × 收回并恢复全部';
    else hint.textContent = '已展开全部标注（不显示光圈）· 滚轮缩放 · 拖拽平移';
  };

  window.IA.Dock = Dock;
})();

/* ============================================================
   main.js —— 启动、导航、权限开关、数据装载
   ============================================================ */
window.IA = window.IA || {};

(function () {
  'use strict';
  var U = window.IA.util, S = window.IA.State, A = window.IA.Api, SET = window.IA.Settings;
  var $ = U.$;

  /* ---------------- 账号展示 ---------------- */
  window.IA.syncUserChip = function () {
    var u = S.user;
    if (!u) return;
    window.IA.Auth.paintAvatar($('#chipAvatar'), u);
    $('#chipName').textContent = u.name;
    if (!$('#userMenu').hidden) {
      window.IA.Auth.paintAvatar($('#menuAvatar'), u);
      $('#menuName').textContent = u.name;
      $('#menuDesc').textContent = u.desc || '';
    }
  };

  /* ---------------- 数据装载 ---------------- */
  window.IA.reloadPhotos = function (focusId, keepView) {
    return A.listPhotos({ tab: S.tab, userId: S.user ? S.user.id : null }).then(function (list) {
      S.photos = list;
      if (focusId) S.currentId = focusId;

      var exists = S.currentId && list.some(function (p) { return p.id === S.currentId; });
      if (!exists) {
        S.currentId = list.length ? list[0].id : null;
        S.selected = {};
        window.IA.Sidebar.render();
        window.IA.Canvas.loadPhoto();
        return;
      }
      window.IA.Sidebar.render();
      if (keepView && focusId) {
        window.IA.Canvas.syncTools();
        window.IA.Canvas.renderMarks();
      } else {
        window.IA.Canvas.loadPhoto();
      }
    });
  };

  /* ---------------- 进入应用（登录后调用） ---------------- */
  window.IA.startApp = function () {
    document.documentElement.style.setProperty('--sidebar-w', S.sidebarWidth + 'px');
    window.IA.Sidebar.setLayout('split');
    window.IA.switchTab(S.isGuest() ? 'public' : 'mine');
  };

  /* ---------------- Tab 切换 ---------------- */
  window.IA.switchTab = function (tab) {
    if (tab === 'upload') { window.IA.Modals.openUpload(); return; }
    if (tab === 'mine' && S.isGuest()) {
      window.IA.toast('访客没有个人相册，已切到公开图库', 'warn');
      tab = 'public';
    }
    S.tab = tab;
    U.$$('#navTabs .nav-tab').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.tab === tab);
    });
    S.keyword = '';
    $('#searchInput').value = '';
    $('#searchInput').parentElement.classList.remove('filled');
    S.selected = {};
    S.currentId = null;
    S.editMode = false;
    window.IA.reloadPhotos();
  };

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    $('#navTabs').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.nav-tab') : null;
      if (b) window.IA.switchTab(b.dataset.tab);
    });
    $('#btnSettings').addEventListener('click', function () { window.IA.Modals.openSettings(); });

    $('#visSwitch').addEventListener('change', function (e) {
      var p = S.current();
      if (!S.canEdit(p)) {
        e.target.checked = !!(p && p.isPublic);
        window.IA.toast(p ? '仅图片所有者可修改可见性' : '请先选择一张图片', 'warn');
        return;
      }
      var val = e.target.checked;
      A.updatePhoto(p.id, { isPublic: val }).then(function () {
        p.isPublic = val;
        window.IA.Canvas.syncTools();
        window.IA.Sidebar.render();
        window.IA.Dock.sync();
        window.IA.toast(val ? '已设为公开' : '已设为私有', 'ok');
      });
    });

    $('#editSwitch').addEventListener('change', function (e) {
      var p = S.current();
      if (!S.canEdit(p)) {
        e.target.checked = false;
        window.IA.toast('仅图片所有者可开启编辑', 'warn');
        return;
      }
      S.editMode = e.target.checked;
      if (!S.editMode) window.IA.Modals.closePopover(true);
      window.IA.Canvas.syncTools();
      window.IA.Dock.sync();
      window.IA.toast(
        !S.editMode ? '编辑模式已关闭'
          : (S.mode === 'clean' ? '编辑已开启，但纯净模式隐藏了标注 · 切回「显示点」即可打点' : '编辑模式已开启：点图片打点，点已有光圈可改内容或删除'),
        S.editMode && S.mode === 'clean' ? 'warn' : 'ok'
      );
    });

    $('#btnPrev').addEventListener('click', function () { window.IA.Sidebar.step(-1); });
    $('#btnNext').addEventListener('click', function () { window.IA.Sidebar.step(1); });

    document.addEventListener('keydown', function (e) {
      var typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      if (e.key === 'Escape') {
        if (!$('#markPopover').hidden) { window.IA.Modals.closePopover(true); return; }
        if (!$('#modalRoot').hidden) { window.IA.Modals.close(true); return; }
        return;
      }
      if (typing) return;
      if (!$('#modalRoot').hidden || !$('#markPopover').hidden) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // 图片切换 · 模式 · 编辑 · 缩放 · 搜索
      if (e.key === '[' || e.key === 'PageUp') { e.preventDefault(); window.IA.Sidebar.step(-1); return; }
      if (e.key === ']' || e.key === 'PageDown') { e.preventDefault(); window.IA.Sidebar.step(1); return; }
      if (e.key === '/') { e.preventDefault(); $('#searchInput').focus(); return; }
      if (['1', '2', '3', '4'].indexOf(e.key) >= 0) {
        var modes = ['pointer', 'note', 'name', 'clean'];
        window.IA.Dock.setMode(modes[+e.key - 1]);
        return;
      }
      if (e.key === 'e' || e.key === 'E') {
        if (!S.canEdit()) return;
        var sw = $('#editSwitch');
        sw.checked = !sw.checked;
        sw.dispatchEvent(new Event('change'));
        return;
      }
      if (e.key === '+' || e.key === '=') { window.IA.Canvas.zoomBy(1.2); return; }
      if (e.key === '-' || e.key === '_') { window.IA.Canvas.zoomBy(1 / 1.2); return; }

      var v = S.view, step = 40;
      if (e.key === 'ArrowLeft') { v.ox += step; window.IA.Canvas.applyView(); }
      if (e.key === 'ArrowRight') { v.ox -= step; window.IA.Canvas.applyView(); }
      if (e.key === 'ArrowUp') { v.oy += step; window.IA.Canvas.applyView(); }
      if (e.key === 'ArrowDown') { v.oy -= step; window.IA.Canvas.applyView(); }
      if (e.key === '0') { window.IA.Canvas.fit(); }
    });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    SET.load();
    SET.apply();

    window.IA.Sidebar.init();
    window.IA.Canvas.init();
    window.IA.Dock.init();
    window.IA.Modals.initPopover();
    bind();

    // 会话恢复 / 显示登录页
    window.IA.Auth.init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

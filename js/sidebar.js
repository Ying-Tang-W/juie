/* ============================================================
   sidebar.js —— 左侧缩略面板：筛选 / 布局切换 / 分栏拖动 / 批量选图
   ============================================================ */
window.IA = window.IA || {};

(function () {
  'use strict';
  var U = window.IA.util, S = window.IA.State, A = window.IA.Api;
  var $ = U.$;

  var Sidebar = {};

  /* ---------------- 渲染缩略图 ---------------- */
  Sidebar.render = function () {
    var grid = $('#thumbGrid');
    var kw = S.keyword.trim().toLowerCase();
    var ownerName = {};
    S.users.forEach(function (u) { ownerName[u.id] = u.name; });

    var list = S.photos.filter(function (p) {
      if (!kw) return true;
      var inMarks = (p.marks || []).some(function (m) {
        return (m.name || '').toLowerCase().indexOf(kw) >= 0 || (m.note || '').toLowerCase().indexOf(kw) >= 0;
      });
      return inMarks ||
        (p.title || '').toLowerCase().indexOf(kw) >= 0 ||
        (ownerName[p.ownerId] || '').toLowerCase().indexOf(kw) >= 0;
    });

    $('#sidebarStat').textContent = '共 ' + list.length + ' 张' + (kw ? '（已筛选）' : '');
    $('#drawerCount').textContent = list.length ? String(list.length) : '';
    grid.innerHTML = '';

    if (!list.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;padding:26px 8px;text-align:center;color:var(--ink-3);font-size:12.5px;line-height:1.7">' +
        (S.tab === 'mine' && S.isGuest() ? '访客没有个人相册<br>可切换到「公开图库」浏览' : '没有匹配的图片<br>试试其他关键词') + '</div>';
      Sidebar.renderBulkBar();
      return;
    }

    list.forEach(function (p) {
      var own = !S.isGuest() && p.ownerId === S.user.id;
      var el = document.createElement('div');
      el.className = 'thumb' + (p.id === S.currentId ? ' is-active' : '') + (S.selected[p.id] ? ' is-checked' : '');
      el.dataset.id = p.id;
      el.innerHTML =
        '<img class="thumb-img" src="' + U.esc(p.url) + '" alt="" loading="lazy" decoding="async">' +
        '<div class="thumb-tags">' +
          '<span class="tag ' + (p.isPublic ? 'public' : 'private') + '">' + (p.isPublic ? '公开' : '私有') + '</span>' +
          (p.marks.length ? '<span class="tag count">' + p.marks.length + ' 点</span>' : '') +
        '</div>' +
        (own && S.tab === 'mine' ? '<div class="thumb-check" data-check="1"></div>' : '') +
        '<div class="thumb-body">' +
          '<div class="thumb-title" title="' + U.esc(p.title) + '">' + U.esc(p.title) + '</div>' +
          '<div class="thumb-sub">' + U.esc(ownerName[p.ownerId] || '未知') + ' · ' + p.createdAt + '</div>' +
        '</div>';
      el.addEventListener('click', function (e) {
        if (e.target.dataset && e.target.dataset.check) {
          if (S.selected[p.id]) delete S.selected[p.id]; else S.selected[p.id] = true;
          Sidebar.render();
          return;
        }
        Sidebar.select(p.id);
      });
      grid.appendChild(el);
    });

    Sidebar.renderBulkBar();
  };

  Sidebar.renderBulkBar = function () {
    var ids = Object.keys(S.selected);
    var bar = $('#bulkBar');
    if (!ids.length || S.tab !== 'mine' || S.isGuest()) { bar.hidden = true; }
    else { bar.hidden = false; $('#bulkCount').textContent = '已选 ' + ids.length + ' 张'; }
    // 每次图库重绘后，同步「上一张 / 下一张」按钮的可用状态
    if (window.IA.Canvas) window.IA.Canvas.syncNav();
  };

  /* 按图库当前可见顺序（含搜索筛选）切换上一张 / 下一张 */
  Sidebar.step = function (delta) {
    var ids = U.$$('#thumbGrid .thumb').map(function (el) { return el.dataset.id; });
    var i = ids.indexOf(S.currentId);
    if (i < 0) return;
    var target = ids[i + delta];
    if (target) Sidebar.select(target);
  };

  /* ---------------- 选中图片 ---------------- */
  Sidebar.select = function (id) {
    S.currentId = id;
    S.activeMarkId = null;
    S.hiddenLeads = {};
    S.editMode = false;
    S.pendingMark = null;
    Sidebar.render();
    window.IA.Canvas.loadPhoto();
    Sidebar.closeDrawer();          // 手机端选中后自动收起抽屉，露出大图
  };

  /* ---------------- 手机抽屉（桌面端 CSS 不生效，仅 ≤760px 显示） ---------------- */
  Sidebar.isDrawerOpen = function () { return $('#sidebar').classList.contains('is-open'); };
  Sidebar.openDrawer = function () {
    $('#sidebar').classList.add('is-open');
    $('#drawerMask').classList.add('is-on');
    $('#workspace').classList.add('drawer-open');
    $('#btnDrawer').setAttribute('aria-expanded', 'true');
  };
  Sidebar.closeDrawer = function () {
    if (!Sidebar.isDrawerOpen()) return;
    $('#sidebar').classList.remove('is-open');
    $('#drawerMask').classList.remove('is-on');
    $('#workspace').classList.remove('drawer-open');
    $('#btnDrawer').setAttribute('aria-expanded', 'false');
  };

  Sidebar.initDrawer = function () {
    $('#btnDrawer').addEventListener('click', Sidebar.openDrawer);
    $('#drawerMask').addEventListener('click', Sidebar.closeDrawer);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && Sidebar.isDrawerOpen()) Sidebar.closeDrawer();
    });

    // 把手区域：点击收起，或向下拖动超过 60px 收起
    var handle = $('#sheetHandle'), sheet = $('#sidebar');
    var y0 = null, dy = 0;
    handle.addEventListener('click', Sidebar.closeDrawer);
    handle.addEventListener('pointerdown', function (e) { y0 = e.clientY; dy = 0; handle.setPointerCapture(e.pointerId); });
    handle.addEventListener('pointermove', function (e) {
      if (y0 == null) return;
      dy = Math.max(0, e.clientY - y0);
      sheet.style.transition = 'none';
      sheet.style.transform = 'translateY(' + dy + 'px)';
    });
    function end() {
      if (y0 == null) return;
      y0 = null;
      sheet.style.transition = '';
      sheet.style.transform = '';
      if (dy > 60) Sidebar.closeDrawer();
      dy = 0;
    }
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };

  /* ---------------- 布局切换 ---------------- */
  Sidebar.setLayout = function (layout) {
    var ws = $('#workspace');
    if (S.layout === layout && layout !== 'split') layout = 'split';    // 再次点击还原
    S.layout = layout;
    ws.dataset.layout = layout;
    var collapsed = layout === 'sidebar-collapsed', full = layout === 'sidebar-full';
    $('#btnCollapse span').textContent = collapsed ? '展开' : '收起';
    $('#btnCollapse').title = collapsed ? '展开图库' : '收起图库，画布铺满';
    $('#btnExpand span').textContent = full ? '还原' : '全屏';
    $('#btnExpand').title = full ? '还原图库宽度' : '图库铺满，便于批量选图';
    setTimeout(function () { window.IA.Canvas.refresh(); }, 280);
  };

  /* ---------------- 分栏拖动 ---------------- */
  Sidebar.initDivider = function () {
    var dv = $('#divider'), ws = $('#workspace');
    var startX = 0, startW = 0, dragging = false;

    function onMove(e) {
      if (!dragging) return;
      var w = U.clamp(startW + (e.clientX - startX), 190, Math.max(260, ws.clientWidth - 320));
      S.sidebarWidth = w;
      document.documentElement.style.setProperty('--sidebar-w', w + 'px');
      window.IA.Canvas.refresh();
    }
    function onUp() {
      dragging = false;
      dv.classList.remove('dragging');
      document.body.classList.remove('no-select', 'resizing');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    dv.addEventListener('mousedown', function (e) {
      if (S.layout !== 'split') { S.layout = 'split'; ws.dataset.layout = 'split'; Sidebar.setLayout('split'); }
      dragging = true;
      startX = e.clientX;
      startW = $('#sidebar').getBoundingClientRect().width;
      dv.classList.add('dragging');
      document.body.classList.add('no-select', 'resizing');
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      e.preventDefault();
    });
    dv.addEventListener('dblclick', function () {
      S.sidebarWidth = 300;
      document.documentElement.style.setProperty('--sidebar-w', '300px');
      window.IA.Canvas.refresh();
    });
  };

  /* ---------------- 搜索 ---------------- */
  Sidebar.initSearch = function () {
    var inp = $('#searchInput'), box = inp.parentElement;
    var timer = null;
    inp.addEventListener('input', function () {
      box.classList.toggle('filled', !!inp.value);
      clearTimeout(timer);
      timer = setTimeout(function () {
        S.keyword = inp.value;
        Sidebar.render();
      }, 160);
    });
    $('#clearSearch').addEventListener('click', function () {
      inp.value = ''; S.keyword = ''; box.classList.remove('filled'); Sidebar.render(); inp.focus();
    });
  };

  /* ---------------- 批量操作 ---------------- */
  Sidebar.initBulk = function () {
    $('#bulkBar').addEventListener('click', function (e) {
      var act = e.target.dataset && e.target.dataset.bulk;
      if (!act) return;
      var ids = Object.keys(S.selected);
      if (act === 'cancel') { S.selected = {}; Sidebar.render(); return; }
      if (!ids.length) return;

      if (act === 'delete') {
        if (!window.confirm('确定删除选中的 ' + ids.length + ' 张图片吗？删除后无法恢复。')) return;
        A.deletePhotos(ids).then(function () {
          if (ids.indexOf(S.currentId) >= 0) { S.currentId = null; window.IA.Canvas.loadPhoto(); }
          S.selected = {};
          window.IA.toast('已删除 ' + ids.length + ' 张图片', 'ok');
          window.IA.reloadPhotos();
        });
        return;
      }
      var patch = { isPublic: act === 'public' };
      Promise.all(ids.map(function (id) { return A.updatePhoto(id, patch); })).then(function () {
        S.selected = {};
        window.IA.toast(act === 'public' ? '已设为公开' : '已设为私有', 'ok');
        window.IA.reloadPhotos();
      });
    });
  };

  Sidebar.init = function () {
    Sidebar.initDivider();
    Sidebar.initSearch();
    Sidebar.initBulk();
    Sidebar.initDrawer();
    $('#btnCollapse').addEventListener('click', function () { Sidebar.setLayout('sidebar-collapsed'); });
    $('#btnExpand').addEventListener('click', function () { Sidebar.setLayout('sidebar-full'); });
    $('#btnReveal').addEventListener('click', function () { Sidebar.setLayout('split'); });
  };

  window.IA.Sidebar = Sidebar;
})();

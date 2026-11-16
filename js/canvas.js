/* ============================================================
   canvas.js —— 大图画布：缩放 / 平移 / 标注渲染 / 引线动画 / 打点
   ============================================================ */
window.IA = window.IA || {};

(function () {
  'use strict';
  var U = window.IA.util, S = window.IA.State, A = window.IA.Api;
  var $ = U.$;
  var NS = 'http://www.w3.org/2000/svg';

  var LEAD_V = 46;      // 竖线长度
  var LEAD_H = 96;      // 横线基准长度
  var LEAD_H_MAX = 150; // 横线最大长度
  var GAP = 30;         // 标签垂直最小间距（避让）

  var Canvas = {};
  var canvas, viewport, photo, leads, marks;

  Canvas.init = function () {
    canvas = $('#canvas'); viewport = $('#viewport'); photo = $('#photo');
    leads = $('#leads'); marks = $('#marks');

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('contextmenu', function (e) { if (e.pointerType === 'touch') e.preventDefault(); });

    // 画布尺寸变化（旋转手机 / 拖动分栏 / 抽屉开合）：还没手动缩放过就重新适应窗口
    function onResize() {
      if (S.view.fitted && photo.naturalWidth) Canvas.fit(); else Canvas.refresh();
    }
    window.addEventListener('resize', onResize);
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(canvas);

    photo.addEventListener('load', function () { canvas.classList.remove('is-loading'); photo.classList.add('is-loaded'); });
    photo.addEventListener('error', function () {
      canvas.classList.remove('is-loading');
      if (photo.getAttribute('src')) window.IA.toast('图片加载失败', 'warn');
    });

    $('#btnZoomIn').addEventListener('click', function () { Canvas.zoomBy(1.2); });
    $('#btnZoomOut').addEventListener('click', function () { Canvas.zoomBy(1 / 1.2); });
    $('#btnFit').addEventListener('click', function () { Canvas.fit(); });
  };

  /* ---------------- 载入图片 ---------------- */
  /* 上一张 / 下一张按钮与「无图」状态 */
  Canvas.syncNav = function () {
    if (!canvas) return;
    var ids = U.$$('#thumbGrid .thumb').map(function (el) { return el.dataset.id; });
    var idx = ids.indexOf(S.currentId);
    $('#btnPrev').disabled = idx <= 0;
    $('#btnNext').disabled = idx < 0 || idx >= ids.length - 1;
    canvas.classList.toggle('no-photo', !S.current());
  };

  Canvas.loadPhoto = function () {
    var p = S.current();
    var empty = $('#canvasEmpty');

    if (!p) {
      photo.removeAttribute('src');
      canvas.classList.remove('is-loading');
      viewport.style.transform = 'translate(0,0)';
      $('#photoTitle').textContent = '未选择图片';
      $('#visBadge').textContent = '—';
      $('#visBadge').className = 'vis-badge';
      empty.classList.remove('hidden');
      Canvas.syncNav();
      $('#emptyText').textContent = S.tab === 'mine' && S.isGuest()
        ? '访客没有个人相册，去「公开图库」看看吧'
        : '从左侧选择一张图片开始标注';
      Canvas.renderMarks();
      Canvas.syncTools();
      window.IA.Dock.sync();
      return;
    }
    empty.classList.add('hidden');
    Canvas.syncNav();

    $('#photoTitle').textContent = p.title;
    var badge = $('#visBadge');
    badge.textContent = p.isPublic ? '公开' : '私有';
    badge.className = 'vis-badge' + (p.isPublic ? '' : ' private');

    S.view.fitted = false;
    canvas.classList.add('is-loading');
    photo.classList.remove('is-loaded');
    photo.onload = function () { canvas.classList.remove('is-loading'); photo.classList.add('is-loaded'); Canvas.fit(); };
    photo.src = p.url;
    // 同一张图已在缓存（src 未变，load 不会再触发）：直接按完成处理
    if (photo.complete) {
      canvas.classList.remove('is-loading');
      if (photo.naturalWidth) { photo.classList.add('is-loaded'); Canvas.fit(); }
    }

    Canvas.syncTools();
    window.IA.Dock.sync();
  };

  /* ---------------- 工具区同步（权限相关） ---------------- */
  Canvas.syncTools = function () {
    var p = S.current();
    var canEdit = S.canEdit(p);

    var editWrap = $('#editSwitchWrap');
    editWrap.style.display = canEdit ? '' : 'none';
    $('#editSwitch').checked = canEdit && S.editMode;
    editWrap.classList.toggle('is-on', canEdit && S.editMode);

    var visWrap = $('#visSwitchWrap');
    visWrap.classList.toggle('is-disabled', !canEdit);
    $('#visSwitch').disabled = !p || !canEdit;
    $('#visSwitch').checked = !!(p && p.isPublic);
    visWrap.classList.toggle('is-on', !!(p && p.isPublic));
    $('#visSwitchLabel').textContent = p && p.isPublic ? '公开' : '私有';

    canvas.classList.toggle('is-editing', !!S.editMode && canEdit);
  };

  /* ---------------- 适应窗口 ---------------- */
  Canvas.fit = function () {
    var p = S.current();
    if (!p || !photo.naturalWidth) return;
    var cw = canvas.clientWidth, ch = canvas.clientHeight;
    var nw = photo.naturalWidth, nh = photo.naturalHeight;
    var sc = Math.min(cw / nw, ch / nh) * 0.92;
    sc = U.clamp(sc, 0.05, 10);
    S.view.scale = sc;
    var w = nw * sc, h = nh * sc;
    S.view.ox = (cw - w) / 2;
    S.view.oy = (ch - h) / 2;
    S.view.fitted = true;
    Canvas.applyView();
  };

  Canvas.zoomBy = function (f, px, py) {
    var cw = canvas.clientWidth, ch = canvas.clientHeight;
    Canvas.zoomTo(S.view.scale * f, px == null ? cw / 2 : px, py == null ? ch / 2 : py);
  };

  Canvas.zoomTo = function (ns, px, py) {
    var v = S.view;
    var s = U.clamp(ns, 0.05, 10);
    var r = s / v.scale;
    v.ox = px - (px - v.ox) * r;
    v.oy = py - (py - v.oy) * r;
    v.scale = s;
    v.fitted = false;
    Canvas.applyView();
  };

  Canvas.applyView = function () {
    var v = S.view;
    var nw = photo.naturalWidth || 1, nh = photo.naturalHeight || 1;
    photo.style.width = (nw * v.scale) + 'px';
    photo.style.height = (nh * v.scale) + 'px';
    viewport.style.transform = 'translate(' + v.ox + 'px,' + v.oy + 'px)';
    $('#zoomLabel').textContent = Math.round(v.scale * 100) + '%';
    Canvas.renderMarks();
    window.IA.Modals.repositionPopover();
  };

  Canvas.refresh = function () { Canvas.renderMarks(); window.IA.Modals.repositionPopover(); };

  /* ---------------- 交互：滚轮缩放 ---------------- */
  function onWheel(e) {
    var p = S.current();
    if (!p) return;
    e.preventDefault();
    var r = canvas.getBoundingClientRect();
    var px = e.clientX - r.left, py = e.clientY - r.top;
    var f = Math.pow(0.999, e.deltaY * (e.ctrlKey ? 2.4 : 1.2));
    Canvas.zoomBy(f, px, py);
  }

  /* ---------------- 交互：Pointer Events（鼠标 / 触摸 / 触控笔统一） ----------------
     单指/鼠标：平移、点击、打点、拖动点位
     双指：捏合缩放 + 同时平移
     双击 / 双击屏幕：在「适应窗口」与放大之间切换（编辑模式下关闭，避免误打点）   */
  var drag = null;
  var pointers = {};          // pointerId -> {x, y}（相对 canvas）
  var pinch = null;           // 双指状态
  var lastTap = null;         // 双击判定
  var lastTouchAt = 0;        // 最近一次触摸抬起时间，用来屏蔽合成的 dblclick

  function pt(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function count() { return Object.keys(pointers).length; }
  function moveSlop(e) { return e.pointerType === 'mouse' ? 3 : 8; }   // 手指抖动容差更大

  function onDown(e) {
    var p = S.current();
    if (!p) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // 按钮 / 标签自己处理点击；若在这里 capture，浏览器会把 click 改投给画布导致它们失灵
    if (e.target.closest && e.target.closest('button, .mark-label')) return;

    pointers[e.pointerId] = pt(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { }

    // 第二根手指落下：切换为捏合，取消当前的单指手势
    if (count() === 2) {
      drag = null;
      canvas.classList.remove('is-panning');
      startPinch();
      return;
    }
    if (count() > 2) return;

    var dot = e.target.closest ? e.target.closest('.mark-dot') : null;
    if (dot && dot.dataset.temp) return;

    // 点中已有点位：拖动改位置 / 单击打开编辑气泡或展开引线（统一在 onUp 判定）
    // 只有「编辑模式 + 有编辑权」才允许移动点位；否则只能点击，不能改位置
    if (dot && dot.dataset.id) {
      var canMove = !!(S.editMode && S.canEdit(p));
      drag = { type: 'mark', id: dot.dataset.id, moved: false, canMove: canMove, sx: e.clientX, sy: e.clientY };
      return;
    }

    var c = pt(e);
    drag = {
      type: 'pan', sx: e.clientX, sy: e.clientY,
      ox: S.view.ox, oy: S.view.oy, moved: false,
      cx: c.x, cy: c.y
    };
    canvas.classList.add('is-panning');
  }

  function startPinch() {
    var ids = Object.keys(pointers);
    var a = pointers[ids[0]], b = pointers[ids[1]];
    var v = S.view;
    var cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    pinch = {
      dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      scale: v.scale,
      // 捏合中心所对应的「图片内坐标」，缩放过程中保持它跟着手指走
      ix: (cx - v.ox) / v.scale,
      iy: (cy - v.oy) / v.scale
    };
  }

  function onMove(e) {
    if (!pointers[e.pointerId]) return;
    pointers[e.pointerId] = pt(e);

    if (pinch && count() >= 2) {
      var ids = Object.keys(pointers);
      var a = pointers[ids[0]], b = pointers[ids[1]];
      var d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      var cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      var s = U.clamp(pinch.scale * d / pinch.dist, 0.05, 10);
      var v = S.view;
      v.scale = s;
      v.ox = cx - pinch.ix * s;
      v.oy = cy - pinch.iy * s;
      v.fitted = false;
      Canvas.applyView();
      return;
    }
    if (!drag) return;

    if (drag.type === 'pan') {
      var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (Math.abs(dx) + Math.abs(dy) > moveSlop(e)) drag.moved = true;
      if (!drag.moved) return;
      S.view.ox = drag.ox + dx;
      S.view.oy = drag.oy + dy;
      S.view.fitted = false;
      Canvas.applyView();
    } else if (drag.type === 'mark') {
      if (!drag.canMove) return;          // 无编辑权限：点位不可移动
      var p = S.current(); if (!p) return;
      var r = canvas.getBoundingClientRect();
      var m = p.marks.filter(function (x) { return x.id === drag.id; })[0];
      if (!m) return;
      // 超过阈值才算拖动，避免单击被误判成移动
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > moveSlop(e)) drag.moved = true;
      if (!drag.moved) return;
      var w = photo.naturalWidth * S.view.scale, h = photo.naturalHeight * S.view.scale;
      m.x = U.clamp((e.clientX - r.left - S.view.ox) / w, 0, 1);
      m.y = U.clamp((e.clientY - r.top - S.view.oy) / h, 0, 1);
      Canvas.renderMarks();
      drag.dirty = true;
    }
  }

  function release(e) {
    delete pointers[e.pointerId];
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) { }
  }

  function onCancel(e) {
    release(e);
    if (count() < 2) pinch = null;
    drag = null;
    canvas.classList.remove('is-panning');
  }

  function onUp(e) {
    var wasPinch = !!pinch;
    release(e);

    if (e.pointerType !== 'mouse') lastTouchAt = Date.now();

    if (wasPinch) {
      // 捏合结束：剩下的那根手指无缝接成「平移」，且不会触发点击/打点
      if (count() < 2) pinch = null;
      drag = null;
      var left = Object.keys(pointers);
      if (left.length === 1) {
        var rc = canvas.getBoundingClientRect(), q = pointers[left[0]];
        drag = { type: 'pan', sx: q.x + rc.left, sy: q.y + rc.top, ox: S.view.ox, oy: S.view.oy, moved: true, cx: q.x, cy: q.y };
        canvas.classList.add('is-panning');
      } else canvas.classList.remove('is-panning');
      return;
    }

    canvas.classList.remove('is-panning');
    var d = drag; drag = null;
    if (!d) return;

    if (d.type === 'mark') {
      var pm = S.current();
      if (d.dirty && d.canMove) {                     // 拖动过且有权限 → 保存新位置
        var mm = pm.marks.filter(function (x) { return x.id === d.id; })[0];
        A.updateMark(pm.id, mm.id, { x: mm.x, y: mm.y }).then(function () {
          window.IA.toast('点位已更新', 'ok');
        });
        return;
      }
      if (!d.moved) {                                 // 单击 → 编辑气泡 / 展开引线
        if (S.editMode && S.canEdit(pm)) {
          window.IA.Modals.openPopover('edit', d.id);
        } else if (S.mode === 'pointer') {
          S.activeMarkId = S.activeMarkId === d.id ? null : d.id;
          Canvas.renderMarks();
        }
      }
      return;
    }

    if (d.type === 'pan' && !d.moved) {
      var photo_ = S.current();
      var editing = S.editMode && S.canEdit(photo_) && S.mode !== 'clean';

      // 触屏双击（鼠标走 dblclick 事件）：适应 ⇄ 放大
      if (e.pointerType !== 'mouse' && !editing) {
        var now = Date.now();
        if (lastTap && now - lastTap.t < 320 && Math.hypot(lastTap.x - d.cx, lastTap.y - d.cy) < 34) {
          lastTap = null;
          toggleZoomAt(d.cx, d.cy);
          return;
        }
        lastTap = { t: now, x: d.cx, y: d.cy };
      }

      // 纯净模式下不打点，画布保持纯浏览
      if (editing) {
        Canvas.startMark(d.cx, d.cy, e.clientX, e.clientY);
      } else if (S.mode === 'pointer') {
        // 点击空白：收起当前引线
        if (S.activeMarkId) { S.activeMarkId = null; Canvas.renderMarks(); }
      }
    }
  }

  /* 双击缩放：当前接近「适应」则放大到 2.5 倍适应比例，否则回到适应 */
  function fitScale() {
    var cw = canvas.clientWidth, ch = canvas.clientHeight;
    return U.clamp(Math.min(cw / photo.naturalWidth, ch / photo.naturalHeight) * 0.92, 0.05, 10);
  }
  function toggleZoomAt(px, py) {
    if (!photo.naturalWidth) return;
    var fs = fitScale();
    if (S.view.scale < fs * 1.4) Canvas.zoomTo(fs * 2.5, px, py);
    else Canvas.fit();
  }
  function onDblClick(e) {
    if (e.pointerType === 'touch' || Date.now() - lastTouchAt < 700 || !S.current()) return;
    if (e.target.closest && e.target.closest('.mark-dot, .mark-label')) return;
    if (S.editMode && S.canEdit()) return;
    var c = pt(e);
    toggleZoomAt(c.x, c.y);
  }

  /* ---------------- 打点流程 ---------------- */
  Canvas.startMark = function (cx, cy, clientX, clientY) {
    var v = S.view;
    var w = photo.naturalWidth * v.scale, h = photo.naturalHeight * v.scale;
    var x = (cx - v.ox) / w, y = (cy - v.oy) / h;
    if (x < 0 || x > 1 || y < 0 || y > 1) { window.IA.toast('请在图片范围内打点', 'warn'); return; }
    S.pendingMark = { x: x, y: y, clientX: clientX, clientY: clientY };
    Canvas.renderMarks();
    window.IA.Modals.openPopover('create');
  };

  /* ---------------- 标注渲染主逻辑 ---------------- */
  Canvas.renderMarks = function () {
    marks.innerHTML = '';
    leads.innerHTML = '';
    marks.classList.remove('is-on');
    leads.setAttribute('class', 'leads');

    var p = S.current();
    if (!p || !photo.naturalWidth) { window.IA.Dock.sync(); return; }

    // 纯净模式：不渲染任何光圈 / 引线 / 文字信息，只留图片本体
    canvas.classList.toggle('can-edit', !!(S.editMode && S.canEdit(p)));
    if (S.mode === 'clean') {
      canvas.classList.remove('can-edit');
      window.IA.Dock.sync();
      return;
    }

    var v = S.view;
    var w = photo.naturalWidth * v.scale, h = photo.naturalHeight * v.scale;
    var cw = canvas.clientWidth, ch = canvas.clientHeight;
    var showField = S.mode === 'pointer' ? S.sub : S.mode;   // name | note
    var globalMode = S.mode !== 'pointer';

    // 待确认的临时点
    if (S.pendingMark) {
      marks.appendChild(makeDot(S.pendingMark.x, S.pendingMark.y, w, h, null, true));
    }

    /* 光圈规则：
       显示点模式 —— 平时全部可见；点开某一个时，其余光圈隐藏（只留被点中的那个）
       显示名字 / 显示备注 —— 完全不画光圈，只画线 + 文字
       例外：编辑模式（仅所有者）下始终画光圈，否则无法选中/删除/拖动已有标注 */
    var editing = S.editMode && S.canEdit(p);
    var dotList = [];
    var leadList = [];
    if (!globalMode || editing) {
      dotList = (!editing && S.activeMarkId)
        ? p.marks.filter(function (m) { return m.id === S.activeMarkId; })
        : p.marks;
    }
    if (!globalMode) {
      if (S.activeMarkId) leadList = p.marks.filter(function (m) { return m.id === S.activeMarkId; });
    } else {
      leadList = p.marks.filter(function (m) { return !S.hiddenLeads[m.id]; });
    }

    dotList.forEach(function (m) {
      var dotEl = makeDot(m.x, m.y, w, h, m.id, false);
      if (S.activeMarkId === m.id) dotEl.classList.add('is-active');
      if (S.editingMarkId === m.id) dotEl.classList.add('is-editing');
      marks.appendChild(dotEl);
    });

    var items = [];
    leadList.forEach(function (m) {
      var ax = v.ox + m.x * w, ay = v.oy + m.y * h;
      if (ax < -200 || ax > cw + 200 || ay < -200 || ay > ch + 200) return;
      var text = (showField === 'note' ? (m.note || '（无备注）') : (m.name || '未命名点'));
      items.push({ m: m, ax: ax, ay: ay, text: text, isNote: showField === 'note' });
    });

    if (items.length) {
      // 阶段一：先插入隐藏标签，量出真实宽高（备注会换行，单行估算会重叠）
      items.forEach(function (it) {
        it.el = makeLabel(it, showField === 'note', !globalMode);
        it.el.style.visibility = 'hidden';
        marks.appendChild(it.el);
      });
      items.forEach(function (it) {
        it.w = it.el.offsetWidth || Math.min(260, it.text.length * 13 + 52);
        it.h = it.el.offsetHeight || 26;
      });

      // 阶段二：按真实高度做避让
      layoutLabels(items, cw, ch);

      items.forEach(function (it) {
        it.el.style.visibility = '';
        it.el.style.top = it.ly + 'px';
        if (it.side === 'left') {
          it.el.style.left = (it.lx - 6) + 'px';
          it.el.style.setProperty('--tx', '-100%');
        } else {
          it.el.style.left = (it.lx + 6) + 'px';
          it.el.style.setProperty('--tx', '0px');
        }
        drawLead(it);
      });

      // 动画：先竖线后横线，再淡入标签（全局模式一次性出现，不带逐条动画）
      if (globalMode) {
        leads.classList.add('instant');
        marks.classList.add('is-on');
      } else {
        requestAnimationFrame(function () {
          leads.classList.add('is-on');
          Array.prototype.forEach.call(marks.querySelectorAll('.mark-label'), function (l) { l.classList.add('show'); });
        });
      }
    }

    window.IA.Dock.sync();
  };

  /* ---------------- 光圈 ---------------- */
  function makeDot(x, y, w, h, id, temp) {
    var el = document.createElement('div');
    el.className = 'mark-dot' + (temp ? ' temp' : '');
    if (id) el.dataset.id = id; else el.dataset.temp = '1';
    el.style.left = (S.view.ox + x * w) + 'px';
    el.style.top = (S.view.oy + y * h) + 'px';
    el.innerHTML = '<span class="halo"></span><span class="ring"></span><span class="core"></span>';
    return el;
  }

  /* ---------------- 标签布局与避让 ---------------- */
  function layoutLabels(items, cw, ch) {
    var right = [], left = [];

    items.forEach(function (it) {
      var up = it.ay > LEAD_V + it.h / 2 + 10;
      var ly = up ? it.ay - LEAD_V : it.ay + LEAD_V;
      var side = 'right';
      var lx = it.ax + LEAD_H;
      if (lx + it.w + 14 > cw) {
        var lx2 = it.ax - LEAD_H;
        if (lx2 - it.w - 14 < 0) { lx = U.clamp(it.ax + LEAD_H, 20, cw - 20); }
        else { lx = lx2; side = 'left'; }
      }
      if (Math.abs(lx - it.ax) > LEAD_H_MAX) {
        lx = side === 'left' ? it.ax - LEAD_H_MAX : it.ax + LEAD_H_MAX;
      }
      it.lx = lx; it.ly = ly; it.side = side; it.up = up;
      (side === 'left' ? left : right).push(it);
    });

    [right, left].forEach(function (group) {
      group.sort(function (a, b) { return a.ly - b.ly; });

      // 相邻两个标签所需的最小中心距 = 各自半高之和 + 间隙（用真实高度，备注换行也不会叠）
      function needGap(a, b) { return (a.h + b.h) / 2 + 10; }

      for (var i = 0; i < group.length; i++) {
        var it = group[i];
        // 1) 避让推挤后若被顶回锚点附近（竖线穿点），改放锚点下方 22px；
        //    注意：绝不能把 ly 拉回 ay±LEAD_V，否则避让结果被覆盖、标签重叠
        if (Math.abs(it.ly - it.ay) < 22) it.ly = it.ay + 22;
        // 2) 与前一个标签保持间距（单向递增，保证不再回退）
        if (i > 0) {
          var g = needGap(group[i - 1], it);
          if (it.ly - group[i - 1].ly < g) it.ly = group[i - 1].ly + g;
        }
      }
      // 超出下边界则整体回推
      var last = group[group.length - 1];
      var overflow = last ? (last.ly + last.h / 2 + 8) - ch : 0;
      if (overflow > 0) {
        for (var j = group.length - 1; j >= 0; j--) {
          group[j].ly -= overflow;
          if (j > 0) {
            var g2 = needGap(group[j - 1], group[j]);
            if (group[j].ly - group[j - 1].ly < g2) {
              group[j - 1].ly -= (g2 - (group[j].ly - group[j - 1].ly));
            }
          }
        }
      }
      // 最终只 clamp 到画布内，不做任何会覆盖避让结果的二次修正
      group.forEach(function (it) {
        it.ly = U.clamp(it.ly, it.h / 2 + 6, ch - it.h / 2 - 6);
      });
    });

    return items;
  }

  /* ---------------- 引线（L 型：先竖线，后横线） ---------------- */
  function drawLead(it) {
    var vlen = Math.abs(it.ly - it.ay);
    var hlen = Math.abs(it.lx - it.ax);

    // 线头小圆点：全局模式不画光圈时，用它标出点位
    var cap = document.createElementNS(NS, 'circle');
    cap.setAttribute('class', 'lead-cap');
    cap.setAttribute('cx', it.ax);
    cap.setAttribute('cy', it.ay);
    cap.setAttribute('r', 2.6);
    leads.appendChild(cap);

    var pv = document.createElementNS(NS, 'path');
    pv.setAttribute('class', 'lead-v');
    pv.setAttribute('d', 'M' + it.ax + ' ' + it.ay + ' L' + it.ax + ' ' + it.ly);
    pv.style.setProperty('--len', vlen);

    var ph = document.createElementNS(NS, 'path');
    ph.setAttribute('class', 'lead-h');
    ph.setAttribute('d', 'M' + it.ax + ' ' + it.ly + ' L' + it.lx + ' ' + it.ly);
    ph.style.setProperty('--len', hlen);

    leads.appendChild(pv);
    leads.appendChild(ph);
  }

  /* ---------------- 标签 DOM ---------------- */
  function makeLabel(it, isNote, showClose) {
    var el = document.createElement('div');
    el.className = 'mark-label' + (isNote ? ' note' : '');
    el.dataset.id = it.m.id;
    el.innerHTML = '<span class="txt">' + U.esc(it.text) + '</span>' +
      (showClose ? '<button class="close" data-close="' + it.m.id + '" title="收起引线" aria-label="收起引线"><svg class="ico"><use href="#i-x"/></svg></button>' : '');

    el.addEventListener('click', function (e) {
      // 图标是 svg 子元素，点击目标未必是按钮本身，需要向上找 data-close
      var btn = e.target.closest ? e.target.closest('[data-close]') : null;
      var c = btn ? btn.dataset.close : null;
      if (!c) return;
      e.stopPropagation();
      // 收起：回到「全部光圈可见」状态
      S.activeMarkId = null;
      delete S.hiddenLeads[c];
      Canvas.renderMarks();
    });
    return el;
  }

  window.IA.Canvas = Canvas;
})();

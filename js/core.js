/* ============================================================
   core.js —— 全局状态 / 工具 / 主题设置 / Toast
   ============================================================ */
window.IA = window.IA || {};

(function () {
  'use strict';

  /* ---------------- 工具 ---------------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ---------------- Toast ---------------- */
  function toast(msg, kind) {
    var root = $('#toastRoot');
    var el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .25s, transform .25s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-6px)';
      setTimeout(function () { el.remove(); }, 260);
    }, 1900);
  }

  /* ---------------- 默认设置 ---------------- */
  var DEFAULTS = {
    mode: 'acrylic',        // acrylic | frost
    alpha: 0.74,            // 面板透明度
    tint: '#ffffff',        // 亚克力面板底色
    bgImage: ''             // 背景图片（dataURL 或 http 链接）
  };

  var Settings = {
    data: Object.assign({}, DEFAULTS),

    load: function () {
      var s = null;
      try { s = JSON.parse(localStorage.getItem('ia_settings') || 'null'); } catch (e) { s = null; }
      this.data = Object.assign({}, DEFAULTS, s || {});
      // 远端接口占位：Api.getSettings().then(...) 接入后覆盖本地
      return this.data;
    },

    save: function () {
      try { localStorage.setItem('ia_settings', JSON.stringify(this.data)); } catch (e) {}
      var S_ = window.IA.State;
      if (S_.user && !S_.isGuest()) {
        window.IA.Api.saveSettings(this.data).catch(function () { toast('外观已保存在本机，但同步到服务器失败', 'warn'); });
      }
      this.apply();
    },

    reset: function () {
      this.data = Object.assign({}, DEFAULTS);
      this.apply();
      try { localStorage.removeItem('ia_settings'); } catch (e) {}
    },

    set: function (k, v) { this.data[k] = v; this.apply(); },   // 实时预览，不落盘

    hexToRgb: function (hex) {
      var h = (hex || '#ffffff').replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    },

    apply: function () {
      var d = this.data;
      var rgb = this.hexToRgb(d.tint);
      var a = clamp(d.alpha, 0.05, 1);
      var rs = document.documentElement.style;

      rs.setProperty('--panel-bg', 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')');
      rs.setProperty('--panel-bg-strong', 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + clamp(a + 0.16, 0, 1) + ')');
      rs.setProperty('--panel-bg-soft', 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + clamp(a - 0.28, 0.05, 1) + ')');
      rs.setProperty('--panel-border', 'rgba(255,255,255,' + (d.mode === 'frost' ? .58 : .72) + ')');
      rs.setProperty('--panel-border-soft', 'rgba(255,255,255,' + (d.mode === 'frost' ? .34 : .48) + ')');
      rs.setProperty('--panel-blur', d.mode === 'frost' ? '22px' : '0px');
      rs.setProperty('--panel-sat', d.mode === 'frost' ? '185%' : '100%');

      // 毛玻璃模式下文字与描边略微增强对比
      rs.setProperty('--ink', d.mode === 'frost' ? '#1e293b' : '#23303f');

      var bg = $('#bgLayer');
      if (d.bgImage) {
        bg.classList.add('has-image');
        bg.style.backgroundImage = 'url("' + d.bgImage + '")';
      } else {
        bg.classList.remove('has-image');
        bg.style.backgroundImage = '';
      }
    }
  };

  /* ---------------- 全局状态 ---------------- */
  var State = {
    users: [],
    user: null,                 // 当前登录用户（u3 视为访客）
    tab: 'mine',                // mine | public
    keyword: '',
    photos: [],                 // 当前可见列表
    currentId: null,
    selected: {},               // 批量选择
    layout: 'split',            // split | sidebar-collapsed | sidebar-full
    sidebarWidth: 300,
    view: { scale: 1, ox: 0, oy: 0, fitted: false },
    mode: 'pointer',            // pointer | note | name（底部三互斥）
    sub: 'name',                // 显示点模式下的二级选项：name | note
    submenuOpen: false,         // 二级菜单是否展开（点「显示点」时才弹出）
    editMode: false,
    activeMarkId: null,         // 显示点模式下被点开引线的标注
    editingMarkId: null,        // 编辑模式下正在编辑（可删除）的标注
    hiddenLeads: {},            // 被 × 隐藏引线的标注
    pendingMark: null,          // 编辑模式下待确认的点位 {x,y}

    isGuest: function () { return !this.user || this.user.id === 'u3'; },
    current: function () {
      var id = this.currentId;
      return this.photos.filter(function (p) { return p.id === id; })[0] || null;
    },
    canEdit: function (photo) {
      var p = photo || this.current();
      return !!p && !this.isGuest() && p.ownerId === this.user.id;
    }
  };

  window.IA.util = { $: $, $$: $$, clamp: clamp, esc: esc };
  window.IA.toast = toast;
  window.IA.Settings = Settings;
  window.IA.State = State;
  window.IA.DEFAULTS = DEFAULTS;
})();

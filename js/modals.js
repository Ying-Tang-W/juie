/* ============================================================
   modals.js —— 设置弹窗 / 上传弹窗 / 我的账号 / 打点气泡
   ============================================================ */
window.IA = window.IA || {};

(function () {
  'use strict';
  var U = window.IA.util, S = window.IA.State, A = window.IA.Api, SET = window.IA.Settings;
  var $ = U.$;

  var Modals = {};
  var snapshot = null;

  /* ---------------- 通用模态 ---------------- */
  function openModal(html) {
    var root = $('#modalRoot');
    root.hidden = false;
    root.innerHTML = '<div class="modal acrylic">' + html + '</div>';
    root.onclick = function (e) { if (e.target === root) closeModal(true); };
    return root.querySelector('.modal');
  }
  function closeModal(silent) {
    $('#modalRoot').hidden = true;
    $('#modalRoot').innerHTML = '';
    if (!silent) return;
    // 取消：回滚到打开前的设置
    if (snapshot) { SET.data = Object.assign({}, snapshot); SET.apply(); snapshot = null; }
  }
  Modals.close = closeModal;

  /* ============================================================
     设置弹窗
     ============================================================ */
  Modals.openSettings = function () {
    snapshot = Object.assign({}, SET.data);
    var d = SET.data;

    var html =
      '<div class="modal-head"><h3>外观设置</h3><button class="icon-btn" data-close="1" aria-label="关闭"><svg class="ico"><use href="#i-x"/></svg></button></div>' +

      /* 1. 背景图片 */
      '<div class="field">' +
        '<div class="field-label">背景图片 <span class="tip">链接 / 本地上传 / 清空</span></div>' +
        '<div class="bg-preview" id="bgPreview">' + (d.bgImage ? '<img src="' + d.bgImage + '" alt="">' : '当前为默认渐变背景') + '</div>' +
        '<div class="row" style="margin-bottom:8px">' +
          '<input type="text" class="input-sm" id="bgUrl" placeholder="粘贴图片链接 https://…">' +
          '<button class="mini-btn" id="bgUrlApply" style="flex:none;padding:0 14px;height:32px">应用</button>' +
        '</div>' +
        '<div class="row">' +
          '<button class="mini-btn" id="bgUpload" style="height:32px">上传本地图片</button>' +
          '<button class="mini-btn" id="bgClear" style="height:32px">清空背景</button>' +
        '</div>' +
        '<input type="file" id="bgFile" accept="image/*" hidden>' +
      '</div>' +

      /* 2. 模式切换 */
      '<div class="field">' +
        '<div class="field-label">模式切换</div>' +
        '<div class="mode-cards">' +
          '<button class="mode-card' + (d.mode === 'acrylic' ? ' is-active' : '') + '" data-mode="acrylic">' +
            '<div class="mode-preview"></div>' +
            '<div class="mc-title">白色亚克力</div>' +
            '<div class="mc-desc">无背景模糊，通透清晰</div>' +
          '</button>' +
          '<button class="mode-card' + (d.mode === 'frost' ? ' is-active' : '') + '" data-mode="frost">' +
            '<div class="mode-preview"></div>' +
            '<div class="mc-title">毛玻璃磨砂</div>' +
            '<div class="mc-desc">backdrop-filter 模糊背景</div>' +
          '</button>' +
        '</div>' +
      '</div>' +

      /* 3. 透明度 */
      '<div class="field">' +
        '<div class="field-label">面板透明度 <span class="tip">实时作用于所有面板</span></div>' +
        '<div class="slider-row">' +
          '<input type="range" id="alphaRange" min="8" max="100" value="' + Math.round(d.alpha * 100) + '">' +
          '<span class="slider-val" id="alphaVal">' + Math.round(d.alpha * 100) + '%</span>' +
        '</div>' +
      '</div>' +

      /* 4. 底色 */
      '<div class="field">' +
        '<div class="field-label">亚克力面板底色</div>' +
        '<div class="color-row">' +
          '<input type="color" id="tintColor" value="' + d.tint + '">' +
          '<div class="swatches">' +
            ['#ffffff', '#f8fafc', '#eef2ff', '#f0fdf4', '#fff7ed', '#fdf2f8'].map(function (c) {
              return '<div class="swatch" data-color="' + c + '" style="background:' + c + '"></div>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div class="field-desc">修改后立即生效预览，点「保存」才会写入本地与服务端。</div>' +
      '</div>' +

      /* 5. 底部按钮 */
      '<div class="modal-foot">' +
        '<button class="mini-btn" id="btnReset">重置默认</button>' +
        '<button class="mini-btn primary" id="btnSave">保存</button>' +
      '</div>';

    var modal = openModal(html);

    modal.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest && t.closest('[data-close]')) { closeModal(true); return; }

      var mc = t.closest ? t.closest('.mode-card') : null;
      if (mc) {
        U.$$('.mode-card', modal).forEach(function (x) { x.classList.remove('is-active'); });
        mc.classList.add('is-active');
        SET.set('mode', mc.dataset.mode);
        return;
      }
      var sw = t.dataset ? t.dataset.color : null;
      if (sw) { SET.set('tint', sw); $('#tintColor').value = sw; }
    });

    // 背景：链接
    $('#bgUrlApply').addEventListener('click', function () {
      var v = $('#bgUrl').value.trim();
      if (!v) return;
      SET.set('bgImage', v);
      $('#bgPreview').innerHTML = '<img src="' + v + '" alt="">';
    });
    // 背景：本地上传
    $('#bgUpload').addEventListener('click', function () { $('#bgFile').click(); });
    $('#bgFile').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        SET.set('bgImage', fr.result);
        $('#bgPreview').innerHTML = '<img src="' + fr.result + '" alt="">';
      };
      fr.readAsDataURL(f);
    });
    // 背景：清空
    $('#bgClear').addEventListener('click', function () {
      SET.set('bgImage', '');
      $('#bgUrl').value = '';
      $('#bgPreview').textContent = '当前为默认渐变背景';
      window.IA.toast('已清空背景');
    });

    // 透明度
    var range = $('#alphaRange');
    function syncRange() {
      var pct = Math.round((range.value - range.min) / (range.max - range.min) * 100);
      range.style.setProperty('--pct', pct + '%');
      $('#alphaVal').textContent = range.value + '%';
    }
    range.addEventListener('input', function () { syncRange(); SET.set('alpha', range.value / 100); });
    syncRange();

    // 取色器
    $('#tintColor').addEventListener('input', function (e) { SET.set('tint', e.target.value); });

    // 重置 / 保存
    $('#btnReset').addEventListener('click', function () {
      SET.reset();
      U.$$('.mode-card', modal).forEach(function (x) { x.classList.toggle('is-active', x.dataset.mode === 'acrylic'); });
      range.value = Math.round(SET.data.alpha * 100); syncRange();
      $('#tintColor').value = SET.data.tint;
      $('#bgPreview').textContent = '当前为默认渐变背景';
      $('#bgUrl').value = '';
      window.IA.toast('已重置为默认外观');
    });
    $('#btnSave').addEventListener('click', function () {
      snapshot = null;
      SET.save();
      $('#modalRoot').hidden = true; $('#modalRoot').innerHTML = '';
      window.IA.toast('设置已保存', 'ok');
    });
  };

  /* ============================================================
     上传照片
     ============================================================ */
  Modals.openUpload = function () {
    if (S.isGuest()) {
      var guestModal = openModal(
        '<div class="modal-head"><h3>登录后上传照片</h3><button class="icon-btn" data-close="1" aria-label="关闭"><svg class="ico"><use href="#i-x"/></svg></button></div>' +
        '<p style="margin:0 0 18px;color:var(--ink-2);line-height:1.7">当前为访客浏览模式。登录或注册账号后即可上传图片，并管理自己的相册。</p>' +
        '<div class="modal-foot"><button class="mini-btn" data-close="1">稍后</button><button class="mini-btn primary" id="uploadNeedLogin">去登录 / 注册</button></div>'
      );
      guestModal.addEventListener('click', function (e) {
        if (e.target && e.target.id === 'uploadNeedLogin') { closeModal(false); window.IA.Auth.logout(); }
        else if (e.target && e.target.closest && e.target.closest('[data-close]')) closeModal(false);
      });
      return;
    }
    var html =
      '<div class="modal-head"><h3>上传照片</h3><button class="icon-btn" data-close="1" aria-label="关闭"><svg class="ico"><use href="#i-x"/></svg></button></div>' +
      '<div class="field">' +
        '<div class="field-label">图片标题</div>' +
        '<input type="text" class="input-sm" id="upTitle" placeholder="给这张图起个名字">' +
      '</div>' +
      '<div class="field">' +
        '<div class="field-label">选择文件</div>' +
        '<div class="dropzone" id="upZone">' +
          '<div class="dz-ill"><svg class="ico"><use href="#i-image"/></svg></div>' +
          '<div>点击选择图片，或拖拽到此处</div>' +
          '<div class="field-desc" id="upName" style="margin-top:6px"></div>' +
        '</div>' +
        '<input type="file" id="upFile" accept="image/*" hidden>' +
      '</div>' +
      '<div class="field">' +
        '<div class="field-label">可见性</div>' +
        '<div class="row">' +
          '<button class="mini-btn" data-vis="public" style="height:34px">公开（所有人可见）</button>' +
          '<button class="mini-btn" data-vis="private" style="height:34px">私有（仅我可见）</button>' +
        '</div>' +
        '<div class="field-desc">当前：<b id="upVisText">私有</b></div>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button class="mini-btn" data-close="1">取消</button>' +
        '<button class="mini-btn primary" id="upSave">上传</button>' +
      '</div>';

    var modal = openModal(html);
    var dataUrl = '', isPublic = false;

    function pick() { $('#upFile').click(); }
    $('#upZone').addEventListener('click', pick);
    $('#upZone').addEventListener('dragover', function (e) { e.preventDefault(); $('#upZone').classList.add('over'); });
    $('#upZone').addEventListener('dragleave', function () { $('#upZone').classList.remove('over'); });
    $('#upZone').addEventListener('drop', function (e) {
      e.preventDefault(); $('#upZone').classList.remove('over');
      var f = e.dataTransfer.files[0]; if (f) read(f);
    });
    $('#upFile').addEventListener('change', function (e) { if (e.target.files[0]) read(e.target.files[0]); });

    var selectedFile = null;
    function read(f) {
      if (!/^image\//.test(f.type)) { window.IA.toast('请选择图片文件', 'warn'); return; }
      if (f.size > 20 * 1024 * 1024) { window.IA.toast('图片不能超过 20 MiB', 'warn'); return; }
      selectedFile = f;
      var fr = new FileReader();
      fr.onload = function () {
        dataUrl = fr.result;
        $('#upName').textContent = '已选择：' + f.name;
        if (!$('#upTitle').value) $('#upTitle').value = f.name.replace(/\.[^.]+$/, '');
      };
      fr.readAsDataURL(f);
    }

    modal.addEventListener('click', function (e) {
      var t = e.target;
      if (t.dataset && t.dataset.vis) {
        isPublic = t.dataset.vis === 'public';
        $('#upVisText').textContent = isPublic ? '公开' : '私有';
        U.$$('[data-vis]', modal).forEach(function (b) {
          b.style.background = (b.dataset.vis === (isPublic ? 'public' : 'private')) ? 'var(--green-soft)' : '';
          b.style.color = (b.dataset.vis === (isPublic ? 'public' : 'private')) ? 'var(--green-ink)' : '';
        });
        return;
      }
      if (t.closest && t.closest('[data-close]')) { closeModal(true); }
    });

    $('#upSave').addEventListener('click', function () {
      if (!dataUrl) { window.IA.toast('请先选择一张图片', 'warn'); return; }
      var saveButton = $('#upSave');
      saveButton.disabled = true;
      saveButton.textContent = '上传中…';
      A.uploadPhoto({
        title: $('#upTitle').value.trim(), url: dataUrl, file: selectedFile, ownerId: S.user.id, isPublic: isPublic
      }).then(function (p) {
        snapshot = null;
        $('#modalRoot').hidden = true; $('#modalRoot').innerHTML = '';
        window.IA.toast('上传成功', 'ok');
        window.IA.switchTab('mine');
        window.IA.reloadPhotos(p.id);
      }).catch(function (err) {
        saveButton.disabled = false;
        saveButton.textContent = '上传';
        window.IA.toast('上传失败：' + (err && err.message ? err.message : '请稍后重试'), 'warn');
      });
    });
  };

  /* ============================================================
     打点气泡
     ============================================================ */
  Modals.openPopover = function (kind, markId) {
    var isEdit = kind === 'edit';
    var pop = $('#markPopover');

    S.editingMarkId = isEdit ? markId : null;
    if (isEdit && S.pendingMark) S.pendingMark = null;

    pop.hidden = false;
    $('#popTitle').textContent = isEdit ? '编辑标注点' : '新增标注点';
    $('#markDelete').style.display = isEdit ? '' : 'none';

    if (isEdit) {
      var p0 = S.current();
      var m0 = p0 ? p0.marks.filter(function (x) { return x.id === markId; })[0] : null;
      if (!m0) { Modals.closePopover(false); return; }
      $('#markName').value = m0.name || '';
      $('#markNote').value = m0.note || '';
    } else {
      $('#markName').value = '';
      $('#markNote').value = '';
    }
    Modals.repositionPopover();
    window.IA.Canvas.renderMarks();     // 让被编辑的光圈高亮
    setTimeout(function () { $('#markName').focus(); }, 30);
  };

  Modals.closePopover = function (clearPending) {
    $('#markPopover').hidden = true;
    var wasEditing = !!S.editingMarkId;
    S.editingMarkId = null;
    if (clearPending && S.pendingMark) S.pendingMark = null;
    if (wasEditing || clearPending) window.IA.Canvas.renderMarks();
  };

  Modals.repositionPopover = function () {
    var pop = $('#markPopover');
    if (pop.hidden) return;
    var m = null;
    if (S.editingMarkId) {
      var p = S.current();
      m = p ? p.marks.filter(function (x) { return x.id === S.editingMarkId; })[0] : null;
    } else if (S.pendingMark) {
      m = S.pendingMark;
    }
    if (!m) return;
    var v = S.view;
    var c = $('#canvas').getBoundingClientRect();
    var w = ($('#photo').naturalWidth || 1) * v.scale, h = ($('#photo').naturalHeight || 1) * v.scale;
    var x = c.left + v.ox + m.x * w;
    var y = c.top + v.oy + m.y * h;
    var pw = 270, ph = pop.offsetHeight || 220;
    var left = U.clamp(x + 18, 12, window.innerWidth - pw - 12);
    var top = U.clamp(y - 20, 12, window.innerHeight - ph - 12);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  };

  Modals.initPopover = function () {
    $('#markCancel').addEventListener('click', function () { Modals.closePopover(true); });
    $('#markSave').addEventListener('click', Modals.saveMark);
    $('#markDelete').addEventListener('click', Modals.deleteMark);
    $('#markName').addEventListener('keydown', function (e) { if (e.key === 'Enter') Modals.saveMark(); });
    $('#markNote').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) Modals.saveMark();
      if (e.key === 'Escape') Modals.closePopover(true);
    });
    // 用 pointerdown 而不是 mousedown：触屏点击后浏览器会补发 mousedown，
    // 会把刚在 pointerup 时打开的弹窗误判为「点击外部」而立即关闭
    document.addEventListener('pointerdown', function (e) {
      var pop = $('#markPopover');
      if (pop.hidden) return;
      if (pop.contains(e.target)) return;
      if (e.target.closest && e.target.closest('.mark-dot')) return;
      Modals.closePopover(true);
    });
  };

  Modals.saveMark = function () {
    var p = S.current();
    if (!p) return;
    var name = $('#markName').value.trim();
    var note = $('#markNote').value.trim();
    if (!name && !note) { window.IA.toast('请至少填写标记名或备注', 'warn'); $('#markName').focus(); return; }

    // 编辑已有点：只更新内容，不改变展开状态
    if (S.editingMarkId) {
      var id = S.editingMarkId;
      A.updateMark(p.id, id, { name: name || '未命名点', note: note }).then(function () {
        Modals.closePopover(false);
        window.IA.reloadPhotos(p.id, true);
        window.IA.toast('标注已更新', 'ok');
      });
      return;
    }

    // 新增点：保存后只是多了一个点，不自动展开它的引线
    if (!S.pendingMark) return;
    var payload = { x: S.pendingMark.x, y: S.pendingMark.y, name: name || '未命名点', note: note };
    A.createMark(p.id, payload).then(function () {
      S.pendingMark = null;
      Modals.closePopover(false);
      window.IA.reloadPhotos(p.id, true);
      window.IA.toast('标注已保存', 'ok');
    });
  };

  Modals.deleteMark = function () {
    var p = S.current();
    if (!p || !S.editingMarkId) return;
    if (!S.canEdit(p)) { window.IA.toast('只有图片所有者可删除标注', 'warn'); return; }
    var id = S.editingMarkId;
    A.deleteMark(p.id, id).then(function () {
      if (S.activeMarkId === id) S.activeMarkId = null;
      Modals.closePopover(false);
      window.IA.reloadPhotos(p.id, true);
      window.IA.toast('标注已删除', 'ok');
    });
  };

  window.IA.Modals = Modals;
})();

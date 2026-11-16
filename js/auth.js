/* ============================================================
   auth.js —— 登录页 / 会话 / 头像上传 / 退出登录
   ------------------------------------------------------------
   会话与头像存 localStorage；账号体系走 Api.login（接口桩）。
   ============================================================ */
window.IA = window.IA || {};

(function () {
  'use strict';
  var U = window.IA.util, S = window.IA.State, A = window.IA.Api;
  var $ = U.$;

  var Auth = {};
  var K_SESSION = 'ia.session';        // { userId }
  var K_LAST = 'ia.lastName';          // 上次登录的账号名（回填）
  var K_AVATAR = 'ia.avatar.';         // + userId -> dataURL

  /* ---------------- localStorage 读写（全部容错） ---------------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }

  function readSession() {
    try { return JSON.parse(lsGet(K_SESSION) || 'null'); } catch (e) { return null; }
  }
  function avatarOf(id) { return lsGet(K_AVATAR + id) || ''; }

  /* ---------------- 头像绘制 ---------------- */
  Auth.paintAvatar = function (el, u) {
    if (!el || !u) return;
    if (u.avatarImg) {
      el.innerHTML = '<img src="' + u.avatarImg + '" alt="' + U.esc(u.name) + '">';
      el.classList.add('has-img');
    } else {
      el.textContent = u.avatar || (u.name || '?').slice(0, 1);
      el.classList.remove('has-img');
    }
    el.classList.toggle('guest', u.id === 'u3' && !u.avatarImg);
  };

  /* ---------------- 登录页显隐 ---------------- */
  Auth.show = function () {
    document.body.classList.add('logged-out');
    $('#loginView').hidden = false;
    $('#userMenu').hidden = true;
    var last = lsGet(K_LAST) || '';
    $('#loginName').value = last;
    $('#loginPwd').value = '';
    Auth.paintAvatar($('#loginAvatar'), { name: last || '图记', avatar: (last || '图').slice(0, 1) });
    setTimeout(function () { (last ? $('#loginPwd') : $('#loginName')).focus(); }, 60);
  };

  Auth.hide = function () {
    document.body.classList.remove('logged-out');
    $('#loginView').hidden = true;
  };

  /* ---------------- 进入应用 ---------------- */
  Auth.enter = function (u) {
    if (!S.users.some(function (x) { return x.id === u.id; })) S.users.push(u);
    S.user = u;
    u.avatarImg = avatarOf(u.id) || u.avatarImg || '';
    lsSet(K_SESSION, JSON.stringify({ userId: u.id }));
    lsSet(K_LAST, u.name);
    Auth.hide();
    window.IA.syncUserChip();
    window.IA.startApp();
    // 账号的外观设置以服务端为准（登录后拉取；访客没有个人设置）
    if (!S.isGuest() && A.getSettings) {
      A.getSettings().then(function (remote) {
        if (remote && typeof remote === 'object') { window.IA.Settings.data = Object.assign({}, window.IA.DEFAULTS, remote); window.IA.Settings.apply(); }
      }).catch(function () { });
    }
    window.IA.toast('欢迎回来，' + u.name, 'ok');
  };

  /* ---------------- 登录 ---------------- */
  Auth.login = function (name, pwd) {
    name = (name || '').trim();
    if (!name) { window.IA.toast('请输入账号', 'warn'); $('#loginName').focus(); return; }
    if (!pwd) { window.IA.toast('请输入密码', 'warn'); $('#loginPwd').focus(); return; }
    var btn = $('#loginSubmit');
    btn.disabled = true; btn.classList.add('is-loading'); btn.textContent = '登录中…';
    A.login({ name: name, password: pwd }).then(function (u) {
      btn.disabled = false; btn.classList.remove('is-loading'); btn.textContent = '登 录';
      Auth.enter(u);
    }).catch(function (err) {
      // 失败要恢复按钮，并把焦点放回密码框，否则用户会卡在「登录中…」
      btn.disabled = false; btn.classList.remove('is-loading'); btn.textContent = '登 录';
      window.IA.toast((err && err.message) || '登录失败，请稍后重试', 'warn');
      $('#loginPwd').value = '';
      $('#loginPwd').focus();
    });
  };

  Auth.loginAsGuest = function () {
    var g = S.users.filter(function (x) { return x.id === 'u3'; })[0];
    if (!g) { window.IA.toast('访客账号不可用', 'warn'); return; }
    Auth.enter(g);
  };

  /* ---------------- 退出登录 ---------------- */
  Auth.logout = function () {
    if (window.IA.httpApi) window.IA.httpApi.logout().catch(function () {});
    lsDel(K_SESSION);
    $('#userMenu').hidden = true;
    window.IA.Modals.closePopover(true);
    if (!$('#modalRoot').hidden) window.IA.Modals.close(true);
    S.user = null;
    S.editMode = false;
    S.currentId = null;
    S.selected = {};
    S.photos = [];
    Auth.show();
    window.IA.toast('已退出登录', 'ok');
  };

  /* ---------------- 头像上传 ---------------- */
  function compress(src, cb) {
    var img = new Image();
    img.onload = function () {
      try {
        var size = 160;
        var c = document.createElement('canvas');
        c.width = size; c.height = size;
        var ctx = c.getContext('2d');
        var s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        cb(c.toDataURL('image/jpeg', 0.86));
      } catch (e) { cb(src); }
    };
    img.onerror = function () { cb(src); };
    img.src = src;
  }

  function pickAvatar(e) {
    var input = e.target;
    var f = input.files && input.files[0];
    input.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) { window.IA.toast('请选择图片文件', 'warn'); return; }
    var fr = new FileReader();
    fr.onload = function () {
      compress(fr.result, function (dataUrl) {
        var u = S.user; if (!u) return;
        lsSet(K_AVATAR + u.id, dataUrl);
        u.avatarImg = dataUrl;
        A.updateUser(u.id, { avatarImg: dataUrl });   // PATCH /api/users/:id
        window.IA.syncUserChip();
        window.IA.toast('头像已更新', 'ok');
      });
    };
    fr.readAsDataURL(f);
  }

  /* ---------------- 头像菜单 ---------------- */
  Auth.toggleMenu = function (force) {
    var m = $('#userMenu');
    var next = (typeof force === 'boolean') ? force : m.hidden;
    m.hidden = !next;
    if (next && S.user) {
      Auth.paintAvatar($('#menuAvatar'), S.user);
      $('#menuName').textContent = S.user.name;
      $('#menuDesc').textContent = S.user.desc || '';
    }
  };

  /* ---------------- 初始化 ---------------- */
  Auth.init = function () {
    $('#loginSubmit').addEventListener('click', function () {
      Auth.login($('#loginName').value, $('#loginPwd').value);
    });
    $('#loginGuest').addEventListener('click', Auth.loginAsGuest);
    ['#loginName', '#loginPwd'].forEach(function (sel) {
      $(sel).addEventListener('keydown', function (e) {
        if (e.key === 'Enter') Auth.login($('#loginName').value, $('#loginPwd').value);
      });
    });
    // 输入账号时实时预览头像首字
    $('#loginName').addEventListener('input', function () {
      Auth.paintAvatar($('#loginAvatar'), { name: this.value || '图记', avatar: (this.value || '图').slice(0, 1) });
    });

    $('#userChip').addEventListener('click', function (e) {
      e.stopPropagation();
      Auth.toggleMenu();
    });
    $('#umAvatar').addEventListener('click', function () {
      $('#userMenu').hidden = true;
      $('#avatarFile').click();
    });
    $('#umLogout').addEventListener('click', function () { Auth.logout(); });
    $('#avatarFile').addEventListener('change', pickAvatar);

    document.addEventListener('click', function (e) {
      if ($('#userMenu').hidden) return;
      if (e.target.closest && e.target.closest('#userChip')) return;
      Auth.toggleMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') Auth.toggleMenu(false);
    });

    // 恢复会话：有则直接进应用，否则显示登录页
    return A.listUsers().then(function (users) {
      S.users = users;
      if (window.IA.httpCurrentUser) { Auth.enter(window.IA.httpCurrentUser); return; }
      var sess = readSession();
      var u = sess && users.filter(function (x) { return x.id === sess.userId; })[0];
      if (u) Auth.enter(u);
      else Auth.show();
    });
  };

  window.IA.Auth = Auth;
})();

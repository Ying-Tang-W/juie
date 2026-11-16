/* Set IA_USE_HTTP_API to false in the browser console to use demo data. */
(function () {
  'use strict';
  var Api = window.IA.Api;
  var enabled = location.protocol !== 'file:';
  function request(path, options) {
    options = options || {};
    options.credentials = 'same-origin';
    options.headers = Object.assign({}, options.headers || {});
    if (options.body && !(options.body instanceof FormData)) options.headers['Content-Type'] = 'application/json';
    return fetch('api.php' + path, options).then(function (r) {
      return r.text().then(function (t) {
        var body = {};
        if (t) { try { body = JSON.parse(t); } catch (_) { body = { error: t.slice(0, 300) }; } }
        if (!r.ok) throw new Error(body.error || '请求失败 (' + r.status + ')');
        return body;
      });
    });
  }
  var http = {
    listUsers: function () { return Promise.all([request('/users'), request('/me').catch(function () { return null; })]).then(function (r) { window.IA.httpCurrentUser = r[1]; return r[0].concat([{ id: 'u3', name: '访客', avatar: '游', desc: '仅可浏览公开图片' }]); }); },
    login: function (p) { return request('/login', { method: 'POST', body: JSON.stringify(p) }); },
    logout: function () { return request('/logout', { method: 'POST' }); },
    me: function () { return request('/me'); },
    updateUser: function (id, p) {
      if (p && p.avatarImg) { var f = new FormData(); f.append('avatar', p.avatarImg); return request('/users/' + encodeURIComponent(id) + '/avatar', { method: 'POST', body: f }); }
      return request('/users/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(p) });
    },
    listPhotos: function (q) { return request('/photos?' + new URLSearchParams(q || {}).toString()); },
    uploadPhoto: function (p) { var f = new FormData(); f.append('title', p.title || ''); f.append('isPublic', p.isPublic ? '1' : '0'); f.append('image', p.file); return request('/photos', { method: 'POST', body: f }); },
    updatePhoto: function (id, p) { return request('/photos/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(p) }); },
    deletePhotos: function (ids) { return request('/photos', { method: 'DELETE', body: JSON.stringify({ ids: ids }) }); },
    createMark: function (pid, m) { return request('/photos/' + encodeURIComponent(pid) + '/marks', { method: 'POST', body: JSON.stringify(m) }); },
    updateMark: function (pid, mid, p) { return request('/photos/' + encodeURIComponent(pid) + '/marks/' + encodeURIComponent(mid), { method: 'PATCH', body: JSON.stringify(p) }); },
    deleteMark: function (pid, mid) { return request('/photos/' + encodeURIComponent(pid) + '/marks/' + encodeURIComponent(mid), { method: 'DELETE' }); },
    getSettings: function () { return request('/settings'); },
    saveSettings: function (s) { return request('/settings', { method: 'PUT', body: JSON.stringify(s) }); }
  };
  window.IA.Api = enabled && window.IA_USE_HTTP_API !== false ? http : Api;
  window.IA.httpApi = http;
})();

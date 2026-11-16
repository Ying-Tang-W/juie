/* ============================================================
   api.js —— 数据访问层（后端接口预留）
   ------------------------------------------------------------
   当前为「内存 Mock 实现」，所有方法均返回 Promise，
   接入真实后端时，只需把每个方法体替换为 fetch(...) 即可，
   上层调用方无需改动。
   预留接口一览：
     GET    /api/photos               -> Api.listPhotos({ tab, keyword, userId })
     POST   /api/photos               -> Api.uploadPhoto({ title, dataUrl, isPublic })
     PATCH  /api/photos/:id           -> Api.updatePhoto(id, patch)
     DELETE /api/photos               -> Api.deletePhotos(ids)
     POST   /api/photos/:id/marks     -> Api.createMark(photoId, mark)
     PATCH  /api/marks/:id            -> Api.updateMark(photoId, markId, patch)
     DELETE /api/marks/:id            -> Api.deleteMark(photoId, markId)
     GET    /api/users               -> Api.listUsers()
     GET/PUT /api/settings           -> Api.getSettings() / Api.saveSettings()
   ============================================================ */
window.IA = window.IA || {};

(function () {
  'use strict';

  /* ---------- 示例图片生成（离线可用，避免外链失败） ---------- */
  function art(type, c1, c2, c3, seed) {
    var s = seed || 1;
    var body = '';
    if (type === 'mountain') {
      body =
        '<circle cx="' + (140 + s * 17) + '" cy="70" r="34" fill="' + c3 + '" opacity=".85"/>' +
        '<path d="M0 260 L' + (110 + s * 9) + ' 130 L' + (180 + s * 7) + ' 210 L260 150 L360 260 Z" fill="' + c1 + '"/>' +
        '<path d="M0 260 L140 180 L300 260 Z" fill="' + c2 + '" opacity=".9"/>' +
        '<path d="M0 258 L360 258 L360 268 L0 268 Z" fill="' + c2 + '" opacity=".35"/>';
    } else if (type === 'wave') {
      body =
        '<circle cx="290" cy="62" r="26" fill="' + c3 + '" opacity=".9"/>' +
        '<rect y="150" width="360" height="120" fill="' + c2 + '" opacity=".45"/>' +
        '<path d="M0 170 q45 -22 90 0 t90 0 t90 0 t90 0 v30 H0 Z" fill="' + c1 + '"/>' +
        '<path d="M0 205 q45 -22 90 0 t90 0 t90 0 t90 0 v30 H0 Z" fill="' + c2 + '"/>';
    } else if (type === 'city') {
      var b = '';
      for (var i = 0; i < 9; i++) {
        var h = 60 + ((s * 37 + i * 53) % 130);
        var w = 30 + ((i * 13 + s * 7) % 18);
        b += '<rect x="' + (6 + i * 40) + '" y="' + (250 - h) + '" width="' + w + '" height="' + h + '" fill="' + (i % 2 ? c1 : c2) + '" opacity="' + (0.55 + (i % 3) * 0.15) + '"/>';
      }
      body = '<rect y="120" width="360" height="150" fill="' + c3 + '" opacity=".18"/>' + b +
        '<rect y="248" width="360" height="22" fill="' + c2 + '" opacity=".6"/>';
    } else { // bloom
      var p = '';
      for (var j = 0; j < 7; j++) {
        var cx = 40 + ((s * 29 + j * 47) % 290);
        var cy = 50 + ((s * 41 + j * 61) % 180);
        p += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (14 + (j * 7 + s * 3) % 26) + '" fill="' + (j % 2 ? c1 : c3) + '" opacity=".55"/>';
      }
      body = p + '<circle cx="180" cy="140" r="76" fill="' + c2 + '" opacity=".35"/>';
    }
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="540" viewBox="0 0 360 270">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + c3 + '" stop-opacity=".55"/>' +
      '<stop offset="1" stop-color="' + c1 + '" stop-opacity=".30"/></linearGradient></defs>' +
      '<rect width="360" height="270" fill="url(#g)"/>' + body + '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* ---------- Mock 数据库 ---------- */
  var DB = {
    users: [
      { id: 'u1', name: '樱糖', avatar: '樱', desc: '图片所有者 · 可编辑、可打点' },
      { id: 'u2', name: '林一白', avatar: '林', desc: '协作者 · 已公开部分图库' },
      { id: 'u3', name: '访客', avatar: '游', desc: '仅可浏览公开图片' }
    ],
    photos: [],
    settings: null
  };

  function mk(p) { DB.photos.push(p); return p; }

  mk({
    id: 'p1', title: '滨江天际线 · 外景', ownerId: 'u1', isPublic: true,
    url: art('city', '#7dd3fc', '#a5b4fc', '#e0f2fe', 3), createdAt: '2026-10-12',
    marks: [
      { id: 'm1', x: .22, y: .30, name: '主楼玻璃幕墙', note: '南侧 3-5 层有反光过曝，建议补拍或局部压光。' },
      { id: 'm2', x: .55, y: .18, name: '塔吊', note: '施工设备入镜，后期需擦除。' },
      { id: 'm3', x: .74, y: .48, name: '江面反光', note: '保留，作为画面高光锚点。' },
      { id: 'm4', x: .38, y: .62, name: '行人', note: '可作为比例参照，保留。' }
    ]
  });
  mk({
    id: 'p2', title: '山脊日出 · 样张', ownerId: 'u1', isPublic: false,
    url: art('mountain', '#fbbf24', '#f472b6', '#fde68a', 5), createdAt: '2026-10-18',
    marks: [
      { id: 'm5', x: .32, y: .26, name: '日出方向', note: '太阳位置偏高，等待 10 分钟后重拍。' },
      { id: 'm6', x: .66, y: .58, name: '前景山脊', note: '层次清晰，作为视觉引导线。' }
    ]
  });
  mk({
    id: 'p3', title: '海岸线色卡对照', ownerId: 'u1', isPublic: true,
    url: art('wave', '#38bdf8', '#0ea5e9', '#bae6fd', 2), createdAt: '2026-10-20',
    marks: [
      { id: 'm7', x: .18, y: .42, name: '色卡 A', note: '白平衡偏差 +200K。' },
      { id: 'm8', x: .48, y: .36, name: '浪花高光', note: '高光溢出 12%，需降曝。' },
      { id: 'm9', x: .80, y: .55, name: '礁石', note: '构图压角，可裁切。' }
    ]
  });
  mk({
    id: 'p4', title: '产品静物 · 打光测试', ownerId: 'u2', isPublic: true,
    url: art('bloom', '#c4b5fd', '#f9a8d4', '#ddd6fe', 7), createdAt: '2026-10-22',
    marks: [
      { id: 'm10', x: .40, y: .38, name: '主光位', note: '45° 侧逆光，边缘轮廓偏硬。' },
      { id: 'm11', x: .62, y: .62, name: '阴影', note: '需要补一块反光板。' }
    ]
  });
  mk({
    id: 'p5', title: '城市夜景长曝', ownerId: 'u2', isPublic: true,
    url: art('city', '#1e3a8a', '#312e81', '#0f172a', 11), createdAt: '2026-10-24',
    marks: [
      { id: 'm12', x: .28, y: .34, name: '车流轨迹', note: '曝光 8s，轨迹连续。' },
      { id: 'm13', x: .58, y: .22, name: '霓虹招牌', note: '高光溢出严重，建议降两档。' },
      { id: 'm14', x: .82, y: .50, name: '天际线', note: '水平线右倾 1.2°，需校正。' }
    ]
  });
  mk({
    id: 'p6', title: '私人草稿 · 未修图', ownerId: 'u1', isPublic: false,
    url: art('mountain', '#94a3b8', '#64748b', '#e2e8f0', 9), createdAt: '2026-10-26',
    marks: [{ id: 'm15', x: .50, y: .45, name: '待修区域', note: '整体偏灰，先做曲线。' }]
  });
  mk({
    id: 'p7', title: '花田色调实验', ownerId: 'u1', isPublic: true,
    url: art('bloom', '#fca5a5', '#fcd34d', '#fed7aa', 4), createdAt: '2026-10-27',
    marks: [
      { id: 'm16', x: .26, y: .30, name: '暖调中心', note: '色温 5600K 偏暖，可尝试 5200K。' },
      { id: 'm17', x: .55, y: .52, name: '主体花簇', note: '对焦点准确，锐度足够。' },
      { id: 'm18', x: .78, y: .30, name: '边缘杂色', note: '有明显紫边，需消除。' }
    ]
  });
  mk({
    id: 'p8', title: '客户交付 · 终稿', ownerId: 'u2', isPublic: true,
    url: art('wave', '#5eead4', '#34d399', '#a7f3d0', 6), createdAt: '2026-10-29',
    marks: [{ id: 'm19', x: .45, y: .40, name: '交付主体', note: '客户已确认，无需修改。' }]
  });
  mk({
    id: 'p9', title: '空景素材 · 备用', ownerId: 'u1', isPublic: false,
    url: art('wave', '#c7d2fe', '#a5b4fc', '#eef2ff', 8), createdAt: '2026-10-30',
    marks: []
  });

  /* ---------- 工具 ---------- */
  function delay(v, ms) {
    return new Promise(function (res) { setTimeout(function () { res(v); }, ms || 90); });
  }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function uid(p) { return (p || 'x') + '_' + Math.random().toString(36).slice(2, 9); }

  /* ---------- 对外接口 ---------- */
  var Api = {
    /* GET /api/users */
    listUsers: function () { return delay(clone(DB.users)); },

    /* POST /api/login —— 演示实现：同名即登录，否则自动建号 */
    login: function (payload) {
      var name = ((payload && payload.name) || '').trim();
      var u = DB.users.filter(function (x) { return x.name === name; })[0];
      if (!u) {
        u = {
          id: uid('u'), name: name, avatar: name.slice(0, 1),
          desc: '新用户 · 可上传并标注自己的图片'
        };
        DB.users.push(u);
      }
      return delay(clone(u), 260);
    },

    /* PATCH /api/users/:id —— 更新资料（头像等） */
    updateUser: function (id, patch) {
      var u = DB.users.filter(function (x) { return x.id === id; })[0];
      if (u) Object.keys(patch || {}).forEach(function (k) { u[k] = patch[k]; });
      return delay({ ok: true }, 80);
    },

    /* GET /api/photos?tab=&keyword=&userId= */
    listPhotos: function (query) {
      var q = query || {};
      var kw = (q.keyword || '').trim().toLowerCase();
      var list = DB.photos.filter(function (p) {
        // 权限：仅本人可见自己的私有图；访客只能看公开图
        if (q.tab === 'mine') {
          if (q.userId === 'u3') return false;               // 访客无相册
          if (p.ownerId !== q.userId) return false;
        } else {
          if (!p.isPublic && p.ownerId !== q.userId) return false;
        }
        if (!kw) return true;
        var inMarks = (p.marks || []).some(function (m) {
          return (m.name || '').toLowerCase().indexOf(kw) >= 0 ||
                 (m.note || '').toLowerCase().indexOf(kw) >= 0;
        });
        var owner = DB.users.filter(function (u) { return u.id === p.ownerId; })[0] || {};
        return inMarks ||
          (p.title || '').toLowerCase().indexOf(kw) >= 0 ||
          (owner.name || '').toLowerCase().indexOf(kw) >= 0;
      });
      return delay(clone(list), 60);
    },

    /* POST /api/photos */
    uploadPhoto: function (payload) {
      var p = {
        id: uid('p'), title: payload.title || ('未命名 ' + new Date().toLocaleDateString('zh-CN')),
        ownerId: payload.ownerId, isPublic: !!payload.isPublic, url: payload.url,
        createdAt: new Date().toISOString().slice(0, 10), marks: []
      };
      DB.photos.unshift(p);
      return delay(clone(p), 220);
    },

    /* PATCH /api/photos/:id */
    updatePhoto: function (id, patch) {
      var p = DB.photos.filter(function (x) { return x.id === id; })[0];
      if (p) { for (var k in patch) { p[k] = patch[k]; } }
      return delay(clone(p), 60);
    },

    /* DELETE /api/photos */
    deletePhotos: function (ids) {
      DB.photos = DB.photos.filter(function (p) { return ids.indexOf(p.id) < 0; });
      return delay({ ok: true }, 120);
    },

    /* POST /api/photos/:id/marks */
    createMark: function (photoId, mark) {
      var p = DB.photos.filter(function (x) { return x.id === photoId; })[0];
      if (!p) return delay(null);
      var m = { id: uid('m'), x: mark.x, y: mark.y, name: mark.name || '', note: mark.note || '' };
      p.marks.push(m);
      return delay(clone(m), 80);
    },

    /* PATCH /api/marks/:id */
    updateMark: function (photoId, markId, patch) {
      var p = DB.photos.filter(function (x) { return x.id === photoId; })[0];
      if (!p) return delay(null);
      var m = p.marks.filter(function (x) { return x.id === markId; })[0];
      if (m) { for (var k in patch) { m[k] = patch[k]; } }
      return delay(clone(m), 60);
    },

    /* DELETE /api/marks/:id */
    deleteMark: function (photoId, markId) {
      var p = DB.photos.filter(function (x) { return x.id === photoId; })[0];
      if (p) p.marks = p.marks.filter(function (m) { return m.id !== markId; });
      return delay({ ok: true }, 60);
    },

    /* GET /api/settings */
    getSettings: function () { return delay(DB.settings ? clone(DB.settings) : null, 30); },

    /* PUT /api/settings */
    saveSettings: function (s) { DB.settings = clone(s); return delay({ ok: true }, 80); }
  };

  window.IA.Api = Api;
  window.IA.uid = uid;
})();

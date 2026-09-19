/* ============================================================
 * 人生之路（青云录）本地离线后端模拟层
 * 拦截所有对 backend.appmiaoda.com 的请求，在本地模拟
 * Supabase Auth / PostgREST / RPC / Edge Functions。
 * 数据全部保存在 localStorage，完全离线可玩。
 * ============================================================ */
(function () {
  'use strict';

  var API = 'https://backend.appmiaoda.com/projects/supabase348700203341103104';
  var OFFLINE_USER_ID = 'offline-local-player-00000001';
  var DB_KEY = '__lifesave_db_v1__';
  var SAVE_KEY = '__lifesave_active__';

  /* ---------------- 存储层 ---------------- */
  function loadDB() {
    try {
      var raw = localStorage.getItem(DB_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveDB(db) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) {}
  }
  function table(name) {
    var db = loadDB();
    if (!db[name]) { db[name] = []; saveDB(db); }
    return db[name];
  }
  function saveTable(name, rows) {
    var db = loadDB();
    db[name] = rows;
    saveDB(db);
  }

  /* ---------------- 工具 ---------------- */
  function genId() {
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function nowISO() { return new Date().toISOString(); }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function jsonResp(obj, status) {
    var body = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return new Response(body, {
      status: status || 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,PUT,OPTIONS',
        'Access-Control-Allow-Headers': 'authorization,apikey,content-type,prefer,x-client-info,x-supabase-api-version,range,accept'
      }
    });
  }
  function textResp(str, status) {
    return new Response(str, {
      status: status || 200,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  /* ---------------- 伪 JWT / 会话 ---------------- */
  function b64url(obj) {
    var s = JSON.stringify(obj);
    var b = btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return b;
  }
  function makeAccessToken() {
    var now = Math.floor(Date.now() / 1000);
    var header = b64url({ alg: 'HS256', typ: 'JWT' });
    var payload = b64url({
      aud: 'authenticated',
      exp: now + 60 * 60 * 24 * 365 * 10,
      iat: now,
      iss: 'supabase',
      role: 'authenticated',
      sub: OFFLINE_USER_ID
    });
    return header + '.' + payload + '.offlinesignature';
  }
  function fakeUser() {
    return {
      id: OFFLINE_USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'offline@local.game',
      email_confirmed_at: nowISO(),
      phone: '',
      confirmed_at: nowISO(),
      last_sign_in_at: nowISO(),
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      identities: [{ id: OFFLINE_USER_ID, user_id: OFFLINE_USER_ID, identity_data: { sub: OFFLINE_USER_ID }, provider: 'email', last_sign_in_at: nowISO(), created_at: nowISO() }],
      created_at: nowISO(),
      updated_at: nowISO()
    };
  }
  function makeSession() {
    return {
      access_token: makeAccessToken(),
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'offline-refresh-' + Date.now(),
      user: fakeUser()
    };
  }

  /* ---------------- 存档辅助 ---------------- */
  function listSaves() { return table('player_saves'); }
  function getSaveById(id) {
    return listSaves().find(function (r) { return r.id === id; }) || null;
  }

  var realFetch = window.fetch;
  var handlers = {};

  function register(type, name, fn) { handlers[type + ':' + name] = fn; }
  function getHandler(type, name) { return handlers[type + ':' + name]; }

  /* ============================================================
   * Auth 端点（GoTrue）
   * ============================================================ */
  var authHandlers = {
    'POST:token': function (params) {
      return jsonResp(makeSession(), 200);
    },
    'POST:signup': function (params) {
      return jsonResp({ access_token: null, token_type: null, expires_in: null, user: fakeUser() }, 200);
    },
    'POST:logout': function () {
      return jsonResp({}, 200);
    },
    'GET:user': function () {
      return jsonResp(fakeUser(), 200);
    },
    'GET:settings': function () {
      return jsonResp({}, 200);
    }
  };
  register('auth', 'token', authHandlers['POST:token']);
  register('auth', 'password', authHandlers['POST:token']);
  register('auth', 'refresh_token', authHandlers['POST:token']);
  register('auth', 'signup', authHandlers['POST:signup']);
  register('auth', 'logout', authHandlers['POST:logout']);
  register('auth', 'user', authHandlers['GET:user']);
  register('auth', 'settings', authHandlers['GET:settings']);

  /* ============================================================
   * PostgREST 通用表模拟
   * ============================================================ */
  function parseQuery(qs) {
    var out = {};
    if (!qs) return out;
    qs.split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      var k = i < 0 ? kv : decodeURIComponent(kv.slice(0, i));
      var v = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1));
      out[k] = v;
    });
    return out;
  }
  function parseOrder(str) {
    var out = [];
    if (!str) return out;
    str.split(',').forEach(function (part) {
      var p = part.split('.');
      out.push({ col: p[0], asc: (p[1] === 'asc' || p[2] === 'asc'), nullsFirst: p[3] === 'nullsfirst' });
    });
    return out;
  }
  function matchFilter(row, key, val) {
    var neg = false;
    var k = key;
    if (k.indexOf('not.') === 0) { neg = true; k = k.slice(4); }
    var op = 'eq';
    var operand = val;
    if (val.indexOf('eq.') === 0) { op = 'eq'; operand = val.slice(3); }
    else if (val.indexOf('neq.') === 0) { op = 'neq'; operand = val.slice(4); }
    else if (val.indexOf('gt.') === 0) { op = 'gt'; operand = val.slice(3); }
    else if (val.indexOf('gte.') === 0) { op = 'gte'; operand = val.slice(4); }
    else if (val.indexOf('lt.') === 0) { op = 'lt'; operand = val.slice(3); }
    else if (val.indexOf('lte.') === 0) { op = 'lte'; operand = val.slice(4); }
    else if (val.indexOf('in.') === 0) { op = 'in'; operand = val.slice(3); }
    else if (val.indexOf('is.') === 0) { op = 'is'; operand = val.slice(3); }
    else if (val.indexOf('like.') === 0) { op = 'like'; operand = val.slice(5); }
    else if (val.indexOf('ilike.') === 0) { op = 'ilike'; operand = val.slice(6); }
    else if (val.indexOf('cs.') === 0) { op = 'cs'; operand = val.slice(3); }

    function norm(x) {
      if (x === 'true') return true;
      if (x === 'false') return false;
      var n = Number(x);
      if (x !== '' && !isNaN(n)) return n;
      return x;
    }
    var rv = norm(operand);
    var actual = row[k];
    var res;
    switch (op) {
      case 'eq': res = actual === rv || String(actual) === String(rv); break;
      case 'neq': res = actual !== rv; break;
      case 'gt': res = actual > rv; break;
      case 'gte': res = actual >= rv; break;
      case 'lt': res = actual < rv; break;
      case 'lte': res = actual <= rv; break;
      case 'in': res = String(rv).split(',').indexOf(String(actual)) >= 0; break;
      case 'is': res = (rv === 'null') ? (actual === null || actual === undefined) : actual === rv; break;
      case 'like': {
        var re = new RegExp('^' + String(rv).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$');
        res = re.test(String(actual)); break;
      }
      case 'ilike': {
        var re2 = new RegExp('^' + String(rv).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i');
        res = re2.test(String(actual)); break;
      }
      case 'cs': res = false; break;
      default: res = true;
    }
    return neg ? !res : res;
  }
  function filterRows(rows, query) {
    var res = rows.slice();
    Object.keys(query).forEach(function (key) {
      if (key === 'select' || key === 'order' || key === 'limit' || key === 'offset' || key === 'apikey'
          || key === 'from' || key === 'to' || key === 'prefer') return;
      if (key.indexOf('or') === 0) return;
      var val = query[key];
      res = res.filter(function (r) { return matchFilter(r, key, val); });
    });
    if (query.order) {
      var orders = parseOrder(query.order);
      res.sort(function (a, b) {
        for (var i = 0; i < orders.length; i++) {
          var o = orders[i];
          var av = a[o.col], bv = b[o.col];
          if (av === bv) continue;
          if (av === undefined || av === null) return o.asc ? -1 : 1;
          if (bv === undefined || bv === null) return o.asc ? 1 : -1;
          if (typeof av === 'number' && typeof bv === 'number') return o.asc ? av - bv : bv - av;
          var cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
          return o.asc ? cmp : -cmp;
        }
        return 0;
      });
    }
    if (query.limit) {
      var lim = parseInt(query.limit, 10);
      if (!isNaN(lim)) res = res.slice(0, lim);
    }
    if (query.offset) {
      var off = parseInt(query.offset, 10);
      if (!isNaN(off)) res = res.slice(off);
    }
    return res;
  }
  function pickFields(row, select) {
    if (!select || select === '*' || select === '') return row;
    var out = {};
    select.split(',').forEach(function (f) {
      var key = f.trim();
      if (!key || key === '*') { out = Object.assign({}, row); return; }
      out[key] = row[key];
    });
    return out;
  }
  function doSelect(tableName, query, wantsSingle) {
    var rows = filterRows(table(tableName), query);
    var out = rows.map(function (r) { return pickFields(r, query.select); });
    if (wantsSingle) {
      return out.length ? out[0] : null;
    }
    return out;
  }
  function doInsert(tableName, body, query) {
    var rows = table(tableName);
    var arr = Array.isArray(body) ? body : [body];
    var inserted = [];
    arr.forEach(function (item) {
      var row = Object.assign({}, item);
      if (!row.id) row.id = genId();
      if (row.created_at === undefined) row.created_at = nowISO();
      rows.push(row);
      inserted.push(row);
    });
    saveTable(tableName, rows);
    return inserted;
  }
  function doUpsert(tableName, body, query) {
    var rows = table(tableName);
    var arr = Array.isArray(body) ? body : [body];
    var onConflictCol = query['on_conflict'] || 'id';
    var inserted = [];
    arr.forEach(function (item) {
      var keyVal = item[onConflictCol];
      var idx = rows.findIndex(function (r) { return r[onConflictCol] === keyVal; });
      if (idx >= 0) {
        rows[idx] = Object.assign({}, rows[idx], item);
        inserted.push(rows[idx]);
      } else {
        var row = Object.assign({}, item);
        if (!row.id) row.id = genId();
        if (row.created_at === undefined) row.created_at = nowISO();
        rows.push(row);
        inserted.push(row);
      }
    });
    saveTable(tableName, rows);
    return inserted;
  }
  function doUpdate(tableName, body, query) {
    var rows = table(tableName);
    var matched = filterRows(rows, query);
    matched.forEach(function (r) {
      Object.assign(r, body);
      r.updated_at = nowISO();
    });
    saveTable(tableName, rows);
    return matched;
  }
  function doDelete(tableName, query) {
    var rows = table(tableName);
    var keep = rows.filter(function (r) {
      var keepIt = true;
      Object.keys(query).forEach(function (key) {
        if (key === 'select' || key === 'order' || key === 'limit' || key === 'offset' || key === 'apikey' || key === 'prefer') return;
        if (!matchFilter(r, key, query[key])) keepIt = false;
      });
      return keepIt;
    });
    var deleted = rows.filter(function (r) { return keep.indexOf(r) < 0; });
    saveTable(tableName, keep);
    return deleted;
  }

  /* 处理 REST 请求 */
  function handleRest(method, tableName, url, query, init) {
    var prefer = (init && init.headers && (init.headers.get ? init.headers.get('prefer') : init.headers['prefer'])) || '';
    var accept = (init && init.headers && (init.headers.get ? init.headers.get('accept') : init.headers['accept'])) || '';
    var wantsSingle = prefer.indexOf('return=representation') >= 0 && accept.indexOf('vnd.pgrst.object+json') >= 0;
    var body = null;
    if (init && init.body) {
      try { body = JSON.parse(init.body); } catch (e) { body = init.body; }
    }
    var result;
    switch (method) {
      case 'GET':
        result = doSelect(tableName, query, wantsSingle);
        return jsonResp(result, 200);
      case 'POST':
        if (prefer.indexOf('resolution=merge-duplicates') >= 0) {
          result = doUpsert(tableName, body, query);
        } else {
          result = doInsert(tableName, body, query);
        }
        if (prefer.indexOf('return=representation') >= 0) {
          return jsonResp(wantsSingle ? (result[0] || null) : result, 201);
        }
        return jsonResp([], 201);
      case 'PATCH':
      case 'PUT':
        result = doUpdate(tableName, body, query);
        if (prefer.indexOf('return=representation') >= 0) {
          return jsonResp(wantsSingle ? (result[0] || null) : result, 200);
        }
        return jsonResp([], 200);
      case 'DELETE':
        result = doDelete(tableName, query);
        if (prefer.indexOf('return=representation') >= 0) {
          return jsonResp(result, 200);
        }
        return jsonResp([], 200);
      default:
        return jsonResp({}, 400);
    }
  }

  /* ============================================================
   * RPC 模拟（注册 handler 见 rpc-handlers 部分）
   * ============================================================ */
  var rpcHandlers = {};

  function handleRpc(name, body) {
    if (rpcHandlers[name]) return rpcHandlers[name](body);
    return jsonResp({ data: null, error: { message: 'RPC not found: ' + name } }, 404);
  }

  /* ============================================================
   * Edge Functions 模拟（见 functions-handlers 部分）
   * ============================================================ */
  var fnHandlers = {};
  function handleFn(name, body) {
    if (fnHandlers[name]) return fnHandlers[name](body);
    return jsonResp({ error: 'function not found: ' + name }, 404);
  }

  /* ============================================================
   * 主 fetch 拦截
   * ============================================================ */
  window.fetch = function (input, init) {
    var url = (typeof input === 'string') ? input : (input && input.url);
    init = init || {};
    if (!url || url.indexOf(API) !== 0) {
      return realFetch.apply(this, arguments);
    }
    var method = (init.method || (typeof input === 'string' ? 'GET' : (input.method || 'GET'))).toUpperCase();
    var after = url.slice(API.length);
    try { console.log('[LB] ' + method + ' ' + after); } catch (e) {}
    // 处理 OPTIONS 预检
    if (method === 'OPTIONS') {
      return Promise.resolve(new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,PUT,OPTIONS', 'Access-Control-Allow-Headers': '*' } }));
    }
    var qIdx = after.indexOf('?');
    var path = qIdx >= 0 ? after.slice(0, qIdx) : after;
    var query = parseQuery(qIdx >= 0 ? after.slice(qIdx + 1) : '');

    // --- Auth ---
    if (path.indexOf('/auth/v1/') === 0) {
      var authPath = path.slice('/auth/v1/'.length);
      var grant = query.grant_type;
      var key = method + ':' + (grant || authPath.split('/')[0]);
      var handler = getHandler('auth', grant || authPath.split('/')[0]);
      var body = null;
      if (init.body) { try { body = JSON.parse(init.body); } catch (e) { body = init.body; } }
      if (handler) return Promise.resolve(handler(body, query));
      return Promise.resolve(jsonResp({}, 200));
    }

    // --- Functions ---
    if (path.indexOf('/functions/v1/') === 0) {
      var fnName = path.slice('/functions/v1/'.length).split('?')[0];
      var fnBody = null;
      if (init.body) { try { fnBody = JSON.parse(init.body); } catch (e) { fnBody = init.body; } }
      return Promise.resolve(handleFn(fnName, fnBody, query));
    }

    // --- REST RPC ---
    if (path.indexOf('/rest/v1/rpc/') === 0) {
      var rpcName = path.slice('/rest/v1/rpc/'.length);
      var rpcBody = null;
      if (init.body) { try { rpcBody = JSON.parse(init.body); } catch (e) { rpcBody = init.body; } }
      return Promise.resolve(handleRpc(rpcName, rpcBody));
    }

    // --- REST table ---
    if (path.indexOf('/rest/v1/') === 0) {
      var tableName = decodeURIComponent(path.slice('/rest/v1/'.length));
      return Promise.resolve(handleRest(method, tableName, url, query, init));
    }

    return Promise.resolve(jsonResp({}, 404));
  };

  /* ============================================================
   * 注册 RPC / Functions（在 rpc-handlers.js 中补充）
   * ============================================================ */
  window.__localBackend = {
    API: API,
    OFFLINE_USER_ID: OFFLINE_USER_ID,
    table: table,
    saveTable: saveTable,
    listSaves: listSaves,
    getSaveById: getSaveById,
    jsonResp: jsonResp,
    registerRpc: function (name, fn) { rpcHandlers[name] = fn; },
    registerFn: function (name, fn) { fnHandlers[name] = fn; }
  };

})();

/* StrategyStore — shared client for server-backed persistence + versioning.
 *
 * Loaded by both strategy docs via <script src="/store.js"></script> (a classic
 * script, served same-origin so the page's cached Basic-Auth credentials ride
 * along automatically on every fetch). The page wires it up with:
 *
 *   StrategyStore.init({
 *     doc: 'may2026',                                   // document slug
 *     getState: () => S,                                // current live state
 *     applyState: (state) => { S = state; sv(); R(); }, // load a version in
 *   });
 *
 * Then: await StrategyStore.loadDraft() on startup, StrategyStore.queueDraftSave(S)
 * inside sv(), and StrategyStore.openVersions() from the Versions button.
 */
(function () {
  'use strict';

  var cfg = { doc: null, getState: null, applyState: null };
  var SAVE_DELAY = 600;

  // ---- API client -----------------------------------------------------------
  function base() { return '/api/docs/' + encodeURIComponent(cfg.doc); }

  async function call(path, method, body) {
    var init = {
      method: method || 'GET',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    var res = await fetch(base() + path, init);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' on ' + path);
    return res;
  }

  async function loadDraft() {
    if (!cfg.doc) return null;
    var res = await call('/draft', 'GET');
    if (res.status === 204) return null;          // no draft saved yet
    return res.json();                            // { state, updatedAt }
  }
  function putDraft(state) { return call('/draft', 'PUT', { state: state }); }
  async function listVersions() { return (await call('/versions', 'GET')).json(); }
  async function saveVersion(name, author, state) {
    return (await call('/versions', 'POST', { name: name, author: author, state: state })).json();
  }
  async function getVersion(id) { return (await call('/versions/' + encodeURIComponent(id), 'GET')).json(); }
  function deleteVersion(id) { return call('/versions/' + encodeURIComponent(id), 'DELETE'); }

  // ---- Debounced draft autosave ---------------------------------------------
  var pending = null, timer = null;

  function queueDraftSave(state) {
    if (!cfg.doc) return;
    pending = state;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { flush(false); }, SAVE_DELAY);
  }

  async function flush(useKeepalive) {
    if (timer) { clearTimeout(timer); timer = null; }
    if (pending == null) return;
    var state = pending; pending = null;
    if (useKeepalive) {
      // Page is going away — fire with keepalive so it completes after unload.
      try {
        fetch(base() + '/draft', {
          method: 'PUT', credentials: 'same-origin', keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: state }),
        });
      } catch (e) { /* nothing more we can do on the way out */ }
      return;
    }
    setStatus('Saving…');
    try {
      await putDraft(state);
      setStatus('Saved to server ✓');
    } catch (e) {
      pending = state;                            // keep for the next attempt
      setStatus('Offline — saved on this device');
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && pending != null) flush(true);
  });
  window.addEventListener('pagehide', function () { if (pending != null) flush(true); });

  // ---- Versions UI -----------------------------------------------------------
  var overlay, listEl, nameInput, authorInput, saveBtn, statusEl, toastEl, toastTimer, built = false;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function rel(iso) {
    var t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 45) return 'just now';
    var m = Math.round(s / 60);
    if (m < 60) return m + (m === 1 ? ' min ago' : ' mins ago');
    var h = Math.round(m / 60);
    if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    var d = Math.round(h / 24);
    if (d < 7) return d + (d === 1 ? ' day ago' : ' days ago');
    return new Date(iso).toLocaleDateString();
  }

  var CSS = ''
    + '.ss-overlay{position:fixed;inset:0;background:rgba(20,18,14,.55);display:flex;align-items:flex-start;justify-content:center;z-index:9999;padding:56px 16px;overflow:auto}'
    + '.ss-overlay[hidden]{display:none}'
    + '.ss-modal{background:#fff;color:var(--dark,#241f18);width:100%;max-width:460px;border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:var(--font-body,system-ui,sans-serif);overflow:hidden}'
    + '.ss-head{display:flex;align-items:center;justify-content:space-between;padding:15px 20px;border-bottom:1px solid #eee}'
    + '.ss-title{font-family:var(--font-head,Georgia,serif);font-size:18px;font-weight:600}'
    + '.ss-x{background:none;border:none;font-size:22px;line-height:1;cursor:pointer;color:#999;padding:0 4px}'
    + '.ss-x:hover{color:#333}'
    + '.ss-save{display:flex;flex-direction:column;gap:8px;padding:16px 20px;border-bottom:1px solid #eee;background:#faf8f4}'
    + '.ss-save input{padding:9px 11px;border:1px solid #ddd;border-radius:6px;font-size:13px;font-family:inherit;width:100%;box-sizing:border-box}'
    + '.ss-save input:focus{outline:none;border-color:var(--sky,#7fb2c9)}'
    + '.ss-save-btn{align-self:flex-start;background:var(--dark,#241f18);color:#fff;border:none;padding:9px 16px;border-radius:6px;font-size:13px;cursor:pointer;font-family:inherit}'
    + '.ss-save-btn:hover{opacity:.9}.ss-save-btn:disabled{opacity:.5;cursor:default}'
    + '.ss-status{font-size:12px;color:#8a8a8a}.ss-status:not(:empty){padding:10px 20px 0}'
    + '.ss-list{padding:8px 12px 14px;max-height:50vh;overflow:auto}'
    + '.ss-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 8px;border-radius:6px}'
    + '.ss-row:hover{background:#f6f4ef}'
    + '.ss-row-name{font-size:14px;font-weight:500}'
    + '.ss-row-meta{font-size:11.5px;color:#9a948a;margin-top:2px}'
    + '.ss-row-actions{display:flex;gap:6px;flex-shrink:0}'
    + '.ss-btn{border:1px solid #ddd;background:#fff;border-radius:5px;padding:5px 10px;font-size:12px;cursor:pointer;font-family:inherit;color:#333}'
    + '.ss-btn:hover{background:#f0ede7}'
    + '.ss-del{color:#b3402f;border-color:#e8c9c2}.ss-del:hover{background:#fbeeeb}'
    + '.ss-empty{padding:20px 12px;text-align:center;color:#a8a29a;font-size:13px}'
    + '.ss-info{padding:18px 20px;font-size:13px;line-height:1.55;color:#3a352c}'
    + '.ss-info p{margin:0 0 12px}.ss-info p:last-child{margin-bottom:0}'
    + '.ss-info b{color:var(--dark,#241f18);font-weight:600}'
    + '.ss-toast{position:fixed;left:20px;bottom:20px;background:var(--dark,#241f18);color:#fff;padding:9px 15px;border-radius:7px;font-size:12.5px;font-family:var(--font-body,system-ui,sans-serif);opacity:0;transform:translateY(8px);transition:opacity .25s,transform .25s;z-index:10000;pointer-events:none;max-width:320px}'
    + '.ss-toast.show{opacity:.96;transform:translateY(0)}';

  var stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function ensureUI() {
    if (built) return;
    built = true;

    injectStyles();

    overlay = document.createElement('div');
    overlay.className = 'ss-overlay';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="ss-modal" role="dialog" aria-modal="true" aria-label="Versions">'
      + '<div class="ss-head"><span class="ss-title">Versions</span>'
      + '<button class="ss-x" aria-label="Close">×</button></div>'
      + '<div class="ss-save">'
      + '<input class="ss-name" type="text" placeholder="Version name (e.g. Pre-workshop draft)">'
      + '<input class="ss-author" type="text" placeholder="Your name (optional)">'
      + '<button class="ss-save-btn">Save current as a version</button>'
      + '</div>'
      + '<div class="ss-status" aria-live="polite"></div>'
      + '<div class="ss-list"></div>'
      + '</div>';
    document.body.appendChild(overlay);

    listEl = overlay.querySelector('.ss-list');
    nameInput = overlay.querySelector('.ss-name');
    authorInput = overlay.querySelector('.ss-author');
    saveBtn = overlay.querySelector('.ss-save-btn');
    statusEl = overlay.querySelector('.ss-status');

    try { authorInput.value = localStorage.getItem('ss_author') || ''; } catch (e) {}

    overlay.querySelector('.ss-x').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !overlay.hidden) close();
    });

    saveBtn.addEventListener('click', onSave);
    listEl.addEventListener('click', onListClick);
  }

  function setStatus(msg) {
    if (statusEl && overlay && !overlay.hidden) statusEl.textContent = msg;
    toast(msg);
  }

  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'ss-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2500);
  }

  async function openVersions() {
    if (!cfg.doc) return;
    ensureUI();
    statusEl.textContent = '';
    overlay.hidden = false;
    nameInput.focus();
    await refresh();
  }

  function close() {
    if (overlay) overlay.hidden = true;
  }

  async function refresh() {
    listEl.innerHTML = '<div class="ss-empty">Loading…</div>';
    try {
      var vs = await listVersions();
      listEl.innerHTML = vs.length
        ? vs.map(rowHTML).join('')
        : '<div class="ss-empty">No saved versions yet.</div>';
    } catch (e) {
      listEl.innerHTML = '<div class="ss-empty">Could not load versions (offline?).</div>';
    }
  }

  function rowHTML(v) {
    var meta = (v.author ? esc(v.author) + ' · ' : '') + rel(v.createdAt);
    return '<div class="ss-row">'
      + '<div class="ss-row-main"><div class="ss-row-name">' + esc(v.name) + '</div>'
      + '<div class="ss-row-meta">' + meta + '</div></div>'
      + '<div class="ss-row-actions">'
      + '<button class="ss-btn ss-load" data-id="' + esc(v.id) + '">Load</button>'
      + '<button class="ss-btn ss-del" data-id="' + esc(v.id) + '">Delete</button>'
      + '</div></div>';
  }

  async function onSave() {
    if (typeof cfg.getState !== 'function') return;
    var name = nameInput.value.trim();
    var author = authorInput.value.trim();
    saveBtn.disabled = true;
    try {
      await saveVersion(name, author, cfg.getState());
      nameInput.value = '';
      try { localStorage.setItem('ss_author', author); } catch (e) {}
      await refresh();
      setStatus('Version saved ✓');
    } catch (e) {
      setStatus('Could not save version (offline?).');
    } finally {
      saveBtn.disabled = false;
    }
  }

  async function onListClick(e) {
    var loadBtn = e.target.closest('.ss-load');
    var delBtn = e.target.closest('.ss-del');
    if (loadBtn) {
      var id = loadBtn.getAttribute('data-id');
      if (!confirm('Load this version? It will replace the current working content.\n\nTip: save the current content as a version first if you want to keep it.')) return;
      try {
        var v = await getVersion(id);
        if (typeof cfg.applyState === 'function') cfg.applyState(v.state);
        close();
        setStatus('Loaded “' + (v.name || 'version') + '”');
      } catch (err) { setStatus('Could not load that version.'); }
    } else if (delBtn) {
      var did = delBtn.getAttribute('data-id');
      if (!confirm('Delete this version permanently?')) return;
      try { await deleteVersion(did); await refresh(); setStatus('Version deleted.'); }
      catch (err) { setStatus('Could not delete that version.'); }
    }
  }

  // ---- "How saving works" info modal ----------------------------------------
  var infoOverlay, infoBuilt = false;

  function ensureInfoUI() {
    if (infoBuilt) return;
    infoBuilt = true;
    injectStyles();
    infoOverlay = document.createElement('div');
    infoOverlay.className = 'ss-overlay';
    infoOverlay.hidden = true;
    infoOverlay.innerHTML =
      '<div class="ss-modal" role="dialog" aria-modal="true" aria-label="How saving works">'
      + '<div class="ss-head"><span class="ss-title">How saving &amp; versions work</span>'
      + '<button class="ss-x" aria-label="Close">×</button></div>'
      + '<div class="ss-info">'
      + '<p><b>Autosave.</b> Every edit you make saves automatically to a shared database within about a second — there\'s no Save button for everyday editing.</p>'
      + '<p><b>Shared.</b> Everyone with the site password edits the same content, on any device. If two people edit at the same time, the most recent change wins.</p>'
      + '<p><b>Works offline.</b> If your connection drops, edits are kept on your device and sync automatically once you\'re back online.</p>'
      + '<p><b>Versions.</b> Use the <b>Versions</b> button to save a named snapshot of the current content (optionally with your name). Reopen that list anytime to <b>Load</b> an earlier snapshot back in, or <b>Delete</b> ones you don\'t need. Snapshots never change once saved — loading one replaces the current working content, so save the current state as a version first if you want to keep it.</p>'
      + '</div></div>';
    document.body.appendChild(infoOverlay);
    var hide = function () { infoOverlay.hidden = true; };
    infoOverlay.querySelector('.ss-x').addEventListener('click', hide);
    infoOverlay.addEventListener('click', function (e) { if (e.target === infoOverlay) hide(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !infoOverlay.hidden) hide(); });
  }

  function openInfo() { ensureInfoUI(); infoOverlay.hidden = false; }

  // ---- Public API ------------------------------------------------------------
  window.StrategyStore = {
    init: function (opts) {
      opts = opts || {};
      if (opts.doc) cfg.doc = opts.doc;
      if (opts.getState) cfg.getState = opts.getState;
      if (opts.applyState) cfg.applyState = opts.applyState;
    },
    get doc() { return cfg.doc; },
    set doc(v) { cfg.doc = v; },
    loadDraft: loadDraft,
    queueDraftSave: queueDraftSave,
    flush: function () { return flush(false); },
    listVersions: listVersions,
    saveVersion: saveVersion,
    getVersion: getVersion,
    deleteVersion: deleteVersion,
    openVersions: openVersions,
    openInfo: openInfo,
  };
})();

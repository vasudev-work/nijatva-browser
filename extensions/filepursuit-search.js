// ==UserScript==
// @name        FilePursuit search
// @description Search FilePursuit's index of open servers and files
// @match       *
// @run-at      document-end
// @grant       GM_xmlhttpRequest
// @grant       GM_getValue
// @grant       GM_setValue
// ==/UserScript==

/*
 * Nijatva extension: search FilePursuit from any page.
 *
 * This is BRUHItsABunny/go-filepursuit (a Go client for the FilePursuit app's
 * API) rebuilt as a browser panel. Everything below is taken from that repo:
 *
 *   base            https://app.filepursuit.com/
 *   search          GET  api/?q=<words>&start=<n>&sort=<sort>&type=<type>
 *                        &filetype=&device=mobile
 *   headers         user-agent: Dart/2.15 (dart:io)
 *                   accept: application/json
 *                   http_test: blbtH5XHQz      (no key)
 *                   x-rapidapi-host / x-rapidapi-key  (with a RapidAPI key)
 *   response        {status, files_found: [...], result: [...]}
 *   entry fields    file_name, file_link, file_size, file_type, domain_name,
 *                   time_ago, folder_name, folder_link, files_inside
 *
 * Notes on the original, kept honest here:
 *  - `filetype=` (empty) and `device=mobile` are sent because the real app sends
 *    them; the library's author says as much in a comment.
 *  - Without a RapidAPI key the API still answers, with the `http_test` header
 *    instead. A key raises the rate limit, so the panel has a field for one.
 *  - go-filepursuit also has Discover (browse a folder) and Suggest (type-ahead).
 *    Discover is a POST with a form body and would need a second round trip per
 *    click; it is not here. Suggest would fire a request on every keystroke,
 *    which is rude to an API that is not even rate limited properly.
 *
 * Pattern: *  (pill sits bottom-left, above the "Dirs" pill, so the two do not
 *              overlap; the AnythingLLM pill is on the bottom-right)
 */
(function () {
  try {
    if (window.__nijatvaFilePursuit) return; // never run twice
    window.__nijatvaFilePursuit = 1;

    var BASE = 'https://app.filepursuit.com/';
    var UA = 'Dart/2.15 (dart:io)';
    var TEST_HEADER = 'blbtH5XHQz';
    var RAPID_HOST = 'filepursuit.p.rapidapi.com';
    var PAGE = 30; // results per request

    var TYPES = [
      {id: 'all', label: 'All'},
      {id: 'archive', label: 'Archive'},
      {id: 'mobile', label: 'Mobile'},
      {id: 'ebook', label: 'Ebook'},
      {id: 'audio', label: 'Audio'},
      {id: 'video', label: 'Video'}
    ];

    var SORTS = [
      {id: 'datedesc', label: 'Newest'},
      {id: 'sizedesc', label: 'Largest'},
      {id: 'sizeasc', label: 'Smallest'},
      {id: 'fileasc', label: 'A\u2013Z'}
    ];

    var pill = null;
    var panel = null;
    var body = null;
    var busy = false;

    var state = {
      text: '',
      type: 'all',
      sort: 'datedesc',
      start: 0,
      results: [],
      total: 0,
      error: '',
      note: ''
    };

    var CSS =
      '#nijatva-fp-pill{' +
      'position:fixed!important;left:12px!important;bottom:58px!important;' +
      'z-index:2147483645!important;margin:0!important;padding:0 11px!important;' +
      'height:30px!important;border:0!important;border-radius:15px!important;' +
      'background:rgba(20,20,22,.72)!important;color:#fff!important;' +
      'font:12px/30px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;' +
      'opacity:.62!important;cursor:pointer!important;' +
      'box-shadow:0 2px 10px rgba(0,0,0,.3)!important;' +
      '}' +
      '#nijatva-fp-pill:hover{opacity:1!important}' +
      '#nijatva-fp-panel{' +
      'position:fixed!important;left:12px!important;bottom:96px!important;' +
      'width:360px!important;max-width:calc(100vw - 24px)!important;' +
      'max-height:min(74vh,600px)!important;z-index:2147483647!important;' +
      'display:none;flex-direction:column!important;' +
      'background:#1b1b1f!important;color:#f1f1f3!important;' +
      'border:1px solid rgba(255,255,255,.10)!important;border-radius:12px!important;' +
      'box-shadow:0 12px 40px rgba(0,0,0,.5)!important;overflow:hidden!important;' +
      'font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;' +
      'box-sizing:border-box!important;' +
      '}' +
      '#nijatva-fp-panel *{box-sizing:border-box!important}' +
      '#nijatva-fp-panel .fp-head{' +
      'display:flex!important;align-items:center!important;justify-content:space-between!important;' +
      'padding:10px 12px!important;border-bottom:1px solid rgba(255,255,255,.08)!important;' +
      'font-weight:600!important;' +
      '}' +
      '#nijatva-fp-panel .fp-x,#nijatva-fp-panel .fp-gear{' +
      'background:transparent!important;border:0!important;color:#9a9aa2!important;' +
      'font-size:15px!important;line-height:1!important;cursor:pointer!important;padding:2px 5px!important;' +
      '}' +
      '#nijatva-fp-panel .fp-body{padding:12px!important;overflow-y:auto!important;flex:1 1 auto!important}' +
      '#nijatva-fp-panel input[type=text],#nijatva-fp-panel input[type=password]{' +
      'width:100%!important;margin:0 0 9px!important;padding:8px 10px!important;' +
      'background:#121214!important;color:#f1f1f3!important;' +
      'border:1px solid rgba(255,255,255,.12)!important;border-radius:7px!important;' +
      'font:13px/1.4 inherit!important;' +
      '}' +
      '#nijatva-fp-panel .fp-label{' +
      'display:block!important;margin:0 0 5px!important;font-size:11px!important;' +
      'letter-spacing:.03em!important;text-transform:uppercase!important;color:#9a9aa2!important;' +
      '}' +
      '#nijatva-fp-panel .fp-chips{display:flex!important;flex-wrap:wrap!important;gap:6px!important;' +
      'margin:0 0 10px!important}' +
      '#nijatva-fp-panel .fp-chip{' +
      'padding:4px 9px!important;border:1px solid rgba(255,255,255,.14)!important;' +
      'border-radius:13px!important;background:transparent!important;color:#cfcfd6!important;' +
      'font:12px/1.2 inherit!important;cursor:pointer!important;' +
      '}' +
      '#nijatva-fp-panel .fp-chip.fp-on{background:#4b6cf6!important;border-color:#4b6cf6!important;color:#fff!important}' +
      '#nijatva-fp-panel .fp-go{' +
      'display:block!important;width:100%!important;margin:2px 0 10px!important;' +
      'padding:9px 10px!important;border:0!important;border-radius:7px!important;' +
      'background:#4b6cf6!important;color:#fff!important;font:600 13px/1.4 inherit!important;' +
      'cursor:pointer!important;' +
      '}' +
      '#nijatva-fp-panel .fp-go[disabled]{opacity:.55!important;cursor:default!important}' +
      '#nijatva-fp-panel .fp-more{' +
      'display:block!important;width:100%!important;margin:6px 0 0!important;' +
      'padding:7px 10px!important;border:1px solid rgba(255,255,255,.14)!important;' +
      'border-radius:7px!important;background:transparent!important;color:#cfcfd6!important;' +
      'font:12px/1.4 inherit!important;cursor:pointer!important;' +
      '}' +
      '#nijatva-fp-panel .fp-err{color:#ff9b9b!important;font-size:12px!important;margin:0 0 8px!important}' +
      '#nijatva-fp-panel .fp-note{color:#9a9aa2!important;font-size:11.5px!important;margin:0 0 8px!important}' +
      '#nijatva-fp-panel .fp-hit{' +
      'border-top:1px solid rgba(255,255,255,.07)!important;padding:8px 0!important;' +
      '}' +
      '#nijatva-fp-panel .fp-name{' +
      'display:block!important;color:#cfd8ff!important;text-decoration:none!important;' +
      'font-size:12.5px!important;word-break:break-word!important;line-height:1.35!important;' +
      '}' +
      '#nijatva-fp-panel .fp-name:hover{text-decoration:underline!important}' +
      '#nijatva-fp-panel .fp-meta{' +
      'color:#8e8e97!important;font-size:11px!important;margin:3px 0 0!important;' +
      'word-break:break-word!important;' +
      '}';

    /* ---------- storage ---------- */

    function get(k, d) {
      try {
        if (typeof window.GM_getValue !== 'function') return d;
        var v = window.GM_getValue(k, d);
        return v === null || v === undefined || v === '' ? d : String(v);
      } catch (e) {
        return d;
      }
    }

    function set(k, v) {
      try {
        if (typeof window.GM_setValue === 'function') window.GM_setValue(k, v);
      } catch (e) {}
    }

    function loadState() {
      try {
        var t = get('type', 'all');
        var s = get('sort', 'datedesc');
        for (var i = 0; i < TYPES.length; i++) if (TYPES[i].id === t) state.type = t;
        for (var j = 0; j < SORTS.length; j++) if (SORTS[j].id === s) state.sort = s;
      } catch (e) {}
    }

    /* ---------- request ---------- */

    function searchUrl(words, start) {
      try {
        return BASE + 'api/?q=' + encodeURIComponent(words) +
          '&start=' + start +
          '&sort=' + encodeURIComponent(state.sort) +
          '&type=' + encodeURIComponent(state.type) +
          '&filetype=&device=mobile';
      } catch (e) {
        return '';
      }
    }

    function headers() {
      var h = {
        'user-agent': UA,
        'accept': 'application/json'
      };
      var key = get('apikey', '');
      if (key) {
        h['x-rapidapi-host'] = RAPID_HOST;
        h['x-rapidapi-key'] = key;
      } else {
        h['http_test'] = TEST_HEADER;
      }
      return h;
    }

    function fetchResults(words, start, done) {
      try {
        if (typeof window.GM_xmlhttpRequest !== 'function') {
          done('This browser did not give the script GM_xmlhttpRequest, so it ' +
            'cannot reach the API.', null);
          return;
        }

        var url = searchUrl(words, start);
        if (!url) {
          done('Could not build the request.', null);
          return;
        }

        window.GM_xmlhttpRequest({
          method: 'GET',
          url: url,
          headers: headers(),
          onload: function (r) {
            try {
              var j = null;
              try {
                j = JSON.parse(r && r.responseText);
              } catch (e) {}
              if (!j) {
                done('The API answered, but not with JSON.', null);
                return;
              }
              var list = j.files_found || j.result || [];
              if (!list || !list.length) {
                done('', {items: [], more: false, note: 'No results for that.'});
                return;
              }
              done('', {
                items: list,
                more: list.length >= PAGE,
                note: j.status ? String(j.status) : ''
              });
            } catch (e) {
              done('Could not read the answer.', null);
            }
          },
          onerror: function (r) {
            try {
              var status = r && r.status;
              if (status === 429) {
                done('Rate limited by FilePursuit (429). Add a RapidAPI key in ' +
                  'settings, or wait a minute.', null);
                return;
              }
              if (status === 403 || status === 401) {
                done('The API refused the request (' + status + '). If you added ' +
                  'a RapidAPI key, check it.', null);
                return;
              }
              if (status) {
                done('FilePursuit answered with HTTP ' + status + '.', null);
                return;
              }
              done('Could not reach app.filepursuit.com. Check the connection.',
                null);
            } catch (e) {
              done('Could not reach app.filepursuit.com.', null);
            }
          }
        });
      } catch (e) {
        done('The request failed before it started.', null);
      }
    }

    /* ---------- DOM ---------- */

    function injectCss() {
      try {
        if (document.getElementById('nijatva-fp-style')) return;
        var s = document.createElement('style');
        s.id = 'nijatva-fp-style';
        s.textContent = CSS;
        (document.head || document.documentElement).appendChild(s);
      } catch (e) {}
    }

    function el(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text !== undefined && text !== null) n.textContent = String(text);
      return n;
    }

    function ensurePill() {
      try {
        if (pill && document.documentElement.contains(pill)) return pill;
        pill = el('button', null, 'Files');
        pill.id = 'nijatva-fp-pill';
        pill.type = 'button';
        pill.title = 'Search FilePursuit';
        pill.addEventListener('click', function (ev) {
          try {
            ev.preventDefault();
            ev.stopPropagation();
            if (panel && panel.style.display === 'flex') closePanel();
            else openPanel();
          } catch (e) {}
        }, false);
        document.documentElement.appendChild(pill);
        return pill;
      } catch (e) {
        return null;
      }
    }

    function ensurePanel() {
      try {
        if (panel && document.documentElement.contains(panel)) return panel;
        panel = el('div');
        panel.id = 'nijatva-fp-panel';

        var head = el('div', 'fp-head');
        head.appendChild(el('span', null, 'FilePursuit'));
        var right = el('div');
        var gear = el('button', 'fp-gear', '\u2699');
        gear.type = 'button';
        gear.title = 'RapidAPI key';
        gear.addEventListener('click', function () {
          try {
            renderSettings();
          } catch (e) {}
        }, false);
        right.appendChild(gear);
        var x = el('button', 'fp-x', '\u00d7');
        x.type = 'button';
        x.setAttribute('aria-label', 'Close');
        x.addEventListener('click', closePanel, false);
        right.appendChild(x);
        head.appendChild(right);
        panel.appendChild(head);

        body = el('div', 'fp-body');
        panel.appendChild(body);

        document.documentElement.appendChild(panel);
        return panel;
      } catch (e) {
        return null;
      }
    }

    function openPanel() {
      try {
        if (!ensurePanel()) return;
        panel.style.setProperty('display', 'flex', 'important');
        render();
      } catch (e) {}
    }

    function closePanel() {
      try {
        if (panel) panel.style.setProperty('display', 'none', 'important');
      } catch (e) {}
    }

    /* ---------- views ---------- */

    function renderSettings() {
      try {
        body.textContent = '';
        body.appendChild(el('p', 'fp-note',
          'FilePursuit answers without a key. A RapidAPI key only raises the ' +
          'rate limit; paste one from rapidapi.com/azharxes/api/filepursuit.'));

        body.appendChild(el('span', 'fp-label', 'RapidAPI key (optional)'));
        var k = el('input');
        k.type = 'password';
        k.placeholder = 'leave empty to use no key';
        k.value = get('apikey', '');
        body.appendChild(k);

        var save = el('button', 'fp-go', 'Save');
        save.type = 'button';
        save.addEventListener('click', function () {
          try {
            set('apikey', String(k.value || '').trim());
            render();
          } catch (e) {}
        }, false);
        body.appendChild(save);

        var back = el('button', 'fp-more', 'Back');
        back.type = 'button';
        back.addEventListener('click', render, false);
        body.appendChild(back);
      } catch (e) {}
    }

    function render() {
      try {
        if (!body) return;
        body.textContent = '';

        var q = el('input');
        q.type = 'text';
        q.value = state.text || '';
        q.placeholder = 'file name or words';
        q.setAttribute('autocapitalize', 'off');
        q.setAttribute('autocorrect', 'off');
        q.setAttribute('spellcheck', 'false');
        body.appendChild(q);

        body.appendChild(el('span', 'fp-label', 'Type'));
        var tchips = el('div', 'fp-chips');
        for (var i = 0; i < TYPES.length; i++) {
          (function (t) {
            var b = el('button', 'fp-chip' + (state.type === t.id ? ' fp-on' : ''), t.label);
            b.type = 'button';
            b.addEventListener('click', function () {
              try {
                state.type = t.id;
                set('type', t.id);
                state.results = [];
                state.start = 0;
                render();
              } catch (e) {}
            }, false);
            tchips.appendChild(b);
          })(TYPES[i]);
        }
        body.appendChild(tchips);

        body.appendChild(el('span', 'fp-label', 'Sort'));
        var schips = el('div', 'fp-chips');
        for (var j = 0; j < SORTS.length; j++) {
          (function (s) {
            var b = el('button', 'fp-chip' + (state.sort === s.id ? ' fp-on' : ''), s.label);
            b.type = 'button';
            b.addEventListener('click', function () {
              try {
                state.sort = s.id;
                set('sort', s.id);
                state.results = [];
                state.start = 0;
                render();
              } catch (e) {}
            }, false);
            schips.appendChild(b);
          })(SORTS[j]);
        }
        body.appendChild(schips);

        var go = el('button', 'fp-go', 'Search');
        go.type = 'button';
        go.disabled = busy;
        body.appendChild(go);

        if (state.error) body.appendChild(el('p', 'fp-err', state.error));

        var list = el('div');
        body.appendChild(list);
        paintResults(list, go);

        function submit(fresh) {
          try {
            var words = String(q.value || '').trim();
            state.text = String(q.value || '');
            if (!words) {
              state.error = 'Type something to search for.';
              render();
              return;
            }
            if (busy) return;
            busy = true;
            go.disabled = true;
            state.error = '';
            if (fresh) {
              state.results = [];
              state.start = 0;
            }

            fetchResults(words, state.start, function (err, data) {
              try {
                busy = false;
                if (err) {
                  state.error = err;
                  render();
                  return;
                }
                if (data.items.length) {
                  state.results = state.results.concat(data.items);
                  state.start = state.start + data.items.length;
                }
                state.note = data.note || '';
                state.more = !!data.more;
                render();
              } catch (e) {
                busy = false;
              }
            });
          } catch (e) {}
        }

        go.addEventListener('click', function () { submit(true); }, false);
        q.addEventListener('keydown', function (ev) {
          try {
            if (ev.key === 'Enter') {
              ev.preventDefault();
              submit(true);
            }
          } catch (e) {}
        }, false);
        q.addEventListener('input', function () {
          try {
            state.text = String(q.value || '');
          } catch (e) {}
        }, false);

        var moreBtn = body.querySelector('.fp-more.fp-next');
        if (moreBtn) {
          moreBtn.addEventListener('click', function () { submit(false); }, false);
        }

        try {
          if (!state.results.length) q.focus();
        } catch (e) {}
      } catch (e) {}
    }

    function paintResults(list, go) {
      try {
        if (!state.results.length) {
          if (state.note) list.appendChild(el('p', 'fp-note', state.note));
          return;
        }

        for (var i = 0; i < state.results.length; i++) {
          var r = state.results[i] || {};
          var row = el('div', 'fp-hit');

          var isFolder = !r.file_link && r.folder_link;
          var name = r.file_name || r.folder_name || r.domain_name || '(no name)';
          var link = r.file_link || r.folder_link || r.domain_link || '';

          if (link) {
            var a = el('a', 'fp-name', name);
            a.href = link;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            row.appendChild(a);
          } else {
            row.appendChild(el('span', 'fp-name', name));
          }

          var bits = [];
          if (isFolder) {
            bits.push('folder');
            if (r.files_inside) bits.push(r.files_inside + ' files');
          } else if (r.file_size) {
            bits.push(r.file_size);
          }
          if (r.file_type) bits.push(r.file_type);
          if (r.domain_name) bits.push(r.domain_name);
          if (r.time_ago) bits.push(r.time_ago);

          if (bits.length) row.appendChild(el('p', 'fp-meta', bits.join(' \u00b7 ')));
          list.appendChild(row);
        }

        if (state.more) {
          var more = el('button', 'fp-more fp-next', 'Load more');
          more.type = 'button';
          more.disabled = busy;
          list.appendChild(more);
        }
      } catch (e) {}
    }

    /* ---------- start ---------- */

    function start() {
      try {
        injectCss();
        loadState();
        if (document.body) ensurePill();
        else document.addEventListener('DOMContentLoaded', ensurePill);
        document.addEventListener('keydown', function (ev) {
          try {
            if ((ev.key === 'Escape' || ev.keyCode === 27) &&
                panel && panel.style.display === 'flex') closePanel();
          } catch (e) {}
        }, true);
      } catch (e) {}
    }

    start();
  } catch (e) {}
})();

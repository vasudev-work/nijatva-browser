// ==UserScript==
// @name        Open directory search
// @description Find direct download links in open directories
// @match       *
// @run-at      document-end
// @grant       GM_getValue
// @grant       GM_setValue
// ==/UserScript==

/*
 * Nijatva extension: search open directory listings from any page.
 *
 * This is ewasion's Open Directory Finder (opendirectory-finder, a single
 * static HTML page) rebuilt as a panel you can open anywhere. The query it
 * builds is the same one, character for character:
 *
 *   <words> +(<filetype>) -inurl:(jsp|pl|php|html|aspx|htm|cf|shtml)
 *   intitle:index.of -inurl:(listen77|mp3raid|mp3toss|mp3drug|index_of|index-of|
 *   wallywashis|downloadmana)
 *
 * The `intitle:index.of` part is what limits results to open directory
 * listings; the `-inurl:(jsp|pl|...)` part drops script pages that are not
 * listings; the last -inurl list drops the known scraper sites. The filetype
 * group is added only when a type is picked.
 *
 * File types, engines and the FilePursuit path are taken from the original
 * page, so the same words give the same results as the website.
 *
 * Pattern: *  (the pill sits bottom-left, so it does not fight the
 *              "Ask AnythingLLM" pill on the bottom-right)
 */
(function () {
  try {
    if (window.__nijatvaOpenDirectory) return; // never run twice
    window.__nijatvaOpenDirectory = 1;

    // --- from the original page ---
    var SUFFIX =
      ' -inurl:(jsp|pl|php|html|aspx|htm|cf|shtml) intitle:index.of' +
      ' -inurl:(listen77|mp3raid|mp3toss|mp3drug|index_of|index-of|wallywashis|downloadmana)';

    var TYPES = [
      {id: 'all', label: 'Anything', files: '', res: ''},
      {
        id: 'video',
        label: 'Video',
        files: 'mkv|mp4|avi|mov|mpg|wmv|divx|mpeg',
        res: 'video'
      },
      {
        id: 'books',
        label: 'Books',
        files: 'MOBI|CBZ|CBR|CBC|CHM|EPUB|FB2|LIT|LRF|ODT|PDF|PRC|PDB|PML|RB|RTF|TCR|DOC|DOCX',
        res: 'ebook'
      },
      {
        id: 'music',
        label: 'Music',
        files: 'mp3|wav|ac3|ogg|flac|wma|m4a|aac|mod',
        res: 'audio'
      },
      {
        id: 'software',
        label: 'Software',
        files: 'exe|iso|dmg|tar|7z|bz2|gz|rar|zip|apk',
        res: 'archive'
      },
      {
        id: 'images',
        label: 'Images',
        files: 'jpg|png|bmp|gif|tif|tiff|psd',
        res: 'picture'
      }
    ];

    var ENGINES = [
      {id: 'google', label: 'Google'},
      {id: 'googol', label: 'Googol'},
      {id: 'startpage', label: 'Startpage'},
      {id: 'searx', label: 'Searx'},
      {id: 'filepursuit', label: 'FilePursuit'}
    ];

    var pill = null;
    var panel = null;
    var body = null;
    var state = {type: 'all', engine: 'google', text: ''};

    var CSS =
      '#nijatva-odf-pill{' +
      'position:fixed!important;left:12px!important;bottom:14px!important;' +
      'z-index:2147483645!important;margin:0!important;padding:0 12px!important;' +
      'height:34px!important;border:0!important;border-radius:17px!important;' +
      'background:rgba(20,20,22,.72)!important;color:#fff!important;' +
      'font:13px/34px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;' +
      'opacity:.62!important;cursor:pointer!important;' +
      'box-shadow:0 2px 10px rgba(0,0,0,.3)!important;' +
      '}' +
      '#nijatva-odf-pill:hover{opacity:1!important}' +
      '#nijatva-odf-panel{' +
      'position:fixed!important;left:12px!important;bottom:56px!important;' +
      'width:340px!important;max-width:calc(100vw - 24px)!important;' +
      'max-height:min(72vh,580px)!important;z-index:2147483647!important;' +
      'display:none;flex-direction:column!important;' +
      'background:#1b1b1f!important;color:#f1f1f3!important;' +
      'border:1px solid rgba(255,255,255,.10)!important;border-radius:12px!important;' +
      'box-shadow:0 12px 40px rgba(0,0,0,.5)!important;overflow:hidden!important;' +
      'font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;' +
      'box-sizing:border-box!important;' +
      '}' +
      '#nijatva-odf-panel *{box-sizing:border-box!important}' +
      '#nijatva-odf-panel .odf-head{' +
      'display:flex!important;align-items:center!important;justify-content:space-between!important;' +
      'padding:10px 12px!important;border-bottom:1px solid rgba(255,255,255,.08)!important;' +
      'font-weight:600!important;' +
      '}' +
      '#nijatva-odf-panel .odf-x{' +
      'background:transparent!important;border:0!important;color:#9a9aa2!important;' +
      'font-size:16px!important;line-height:1!important;cursor:pointer!important;padding:2px 4px!important;' +
      '}' +
      '#nijatva-odf-panel .odf-body{padding:12px!important;overflow-y:auto!important;flex:1 1 auto!important}' +
      '#nijatva-odf-panel input[type=text]{' +
      'width:100%!important;margin:0 0 10px!important;padding:8px 10px!important;' +
      'background:#121214!important;color:#f1f1f3!important;' +
      'border:1px solid rgba(255,255,255,.12)!important;border-radius:7px!important;' +
      'font:13px/1.4 inherit!important;' +
      '}' +
      '#nijatva-odf-panel .odf-label{' +
      'display:block!important;margin:0 0 5px!important;font-size:11px!important;' +
      'letter-spacing:.03em!important;text-transform:uppercase!important;color:#9a9aa2!important;' +
      '}' +
      '#nijatva-odf-panel .odf-chips{display:flex!important;flex-wrap:wrap!important;gap:6px!important;' +
      'margin:0 0 10px!important}' +
      '#nijatva-odf-panel .odf-chip{' +
      'padding:5px 9px!important;border:1px solid rgba(255,255,255,.14)!important;' +
      'border-radius:14px!important;background:transparent!important;color:#cfcfd6!important;' +
      'font:12px/1.2 inherit!important;cursor:pointer!important;' +
      '}' +
      '#nijatva-odf-panel .odf-chip.odf-on{' +
      'background:#4b6cf6!important;border-color:#4b6cf6!important;color:#fff!important;' +
      '}' +
      '#nijatva-odf-panel .odf-go{' +
      'display:block!important;width:100%!important;margin:2px 0 8px!important;' +
      'padding:9px 10px!important;border:0!important;border-radius:7px!important;' +
      'background:#4b6cf6!important;color:#fff!important;font:600 13px/1.4 inherit!important;' +
      'cursor:pointer!important;' +
      '}' +
      '#nijatva-odf-panel .odf-err{color:#ff9b9b!important;font-size:12px!important;margin:0 0 8px!important}' +
      '#nijatva-odf-panel .odf-q{' +
      'font:11.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace!important;' +
      'color:#9a9aa2!important;background:#121214!important;border-radius:7px!important;' +
      'padding:8px 9px!important;word-break:break-word!important;margin:0!important;' +
      'max-height:88px!important;overflow-y:auto!important;' +
      '}';

    /* ---------- storage (remember the last choices) ---------- */

    function loadState() {
      try {
        if (typeof window.GM_getValue !== 'function') return;
        var t = window.GM_getValue('type', 'all');
        var e = window.GM_getValue('engine', 'google');
        for (var i = 0; i < TYPES.length; i++) {
          if (TYPES[i].id === t) state.type = t;
        }
        for (var j = 0; j < ENGINES.length; j++) {
          if (ENGINES[j].id === e) state.engine = e;
        }
      } catch (x) {}
    }

    function saveState() {
      try {
        if (typeof window.GM_setValue === 'function') {
          window.GM_setValue('type', state.type);
          window.GM_setValue('engine', state.engine);
        }
      } catch (e) {}
    }

    /* ---------- the query ---------- */

    function typeById(id) {
      for (var i = 0; i < TYPES.length; i++) {
        if (TYPES[i].id === id) return TYPES[i];
      }
      return TYPES[0];
    }

    function buildQuery(words) {
      try {
        var t = typeById(state.type);
        var q = String(words || '').trim();
        if (!q) return '';
        if (t.files) return q + ' +(' + t.files + ')' + SUFFIX;
        return q + SUFFIX;
      } catch (e) {
        return '';
      }
    }

    function buildUrl(words) {
      try {
        var q = String(words || '').trim();
        if (!q) return '';
        var t = typeById(state.type);

        if (state.engine === 'filepursuit') {
          var res = t.res || 'all';
          return 'https://filepursuit.com/search/' +
            encodeURIComponent(q).replace(/%20/g, '+') + '/type/' + res;
        }

        var finalQuery = buildQuery(q);
        if (state.engine === 'googol') {
          return 'https://googol.warriordudimanche.net/?q=' + encodeURIComponent(finalQuery);
        }
        if (state.engine === 'startpage') {
          return 'https://www.startpage.com/do/dsearch?query=' + encodeURIComponent(finalQuery);
        }
        if (state.engine === 'searx') {
          return 'https://searx.me/?q=' + encodeURIComponent(finalQuery);
        }
        return 'https://www.google.com/search?q=' + encodeURIComponent(finalQuery);
      } catch (e) {
        return '';
      }
    }

    /* ---------- DOM ---------- */

    function injectCss() {
      try {
        if (document.getElementById('nijatva-odf-style')) return;
        var s = document.createElement('style');
        s.id = 'nijatva-odf-style';
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
        pill = el('button', null, 'Dirs');
        pill.id = 'nijatva-odf-pill';
        pill.type = 'button';
        pill.title = 'Search open directory listings';
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
        panel.id = 'nijatva-odf-panel';

        var head = el('div', 'odf-head');
        head.appendChild(el('span', null, 'Open directory search'));
        var x = el('button', 'odf-x', '\u00d7');
        x.type = 'button';
        x.setAttribute('aria-label', 'Close');
        x.addEventListener('click', closePanel, false);
        head.appendChild(x);
        panel.appendChild(head);

        body = el('div', 'odf-body');
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

    /* ---------- the panel ---------- */

    function render() {
      try {
        if (!body) return;
        body.textContent = '';

        var q = el('input');
        q.type = 'text';
        q.value = state.text || '';
        q.placeholder = 'file name or words, e.g. ubuntu 24.04 iso';
        q.setAttribute('autocapitalize', 'off');
        q.setAttribute('autocorrect', 'off');
        q.setAttribute('spellcheck', 'false');
        body.appendChild(q);

        body.appendChild(el('span', 'odf-label', 'File type'));
        var chips = el('div', 'odf-chips');
        for (var i = 0; i < TYPES.length; i++) {
          (function (t) {
            var b = el('button', 'odf-chip' + (state.type === t.id ? ' odf-on' : ''), t.label);
            b.type = 'button';
            b.addEventListener('click', function () {
              try {
                state.type = t.id;
                saveState();
                render();
              } catch (e) {}
            }, false);
            chips.appendChild(b);
          })(TYPES[i]);
        }
        body.appendChild(chips);

        body.appendChild(el('span', 'odf-label', 'Search with'));
        var echips = el('div', 'odf-chips');
        for (var j = 0; j < ENGINES.length; j++) {
          (function (en) {
            var b = el('button', 'odf-chip' + (state.engine === en.id ? ' odf-on' : ''), en.label);
            b.type = 'button';
            b.addEventListener('click', function () {
              try {
                state.engine = en.id;
                saveState();
                render();
              } catch (e) {}
            }, false);
            echips.appendChild(b);
          })(ENGINES[j]);
        }
        body.appendChild(echips);

        var err = el('p', 'odf-err');
        body.appendChild(err);

        var go = el('button', 'odf-go', 'Search');
        go.type = 'button';
        body.appendChild(go);

        var preview = el('p', 'odf-q');
        body.appendChild(preview);

        function update() {
          try {
            state.text = String(q.value || '');
            var words = String(q.value || '').trim();
            err.textContent = '';
            if (!words) {
              preview.textContent = '';
              return;
            }
            if (state.engine === 'filepursuit') {
              preview.textContent = 'FilePursuit: ' + words + ' (type: ' +
                (typeById(state.type).res || 'all') + ')';
            } else {
              preview.textContent = buildQuery(words);
            }
          } catch (e) {}
        }

        q.addEventListener('input', update, false);
        update();

        function run() {
          try {
            var words = String(q.value || '').trim();
            if (!words) {
              err.textContent = 'Type a file name or some words first.';
              return;
            }
            var url = buildUrl(words);
            if (!url) {
              err.textContent = 'Could not build a search URL for that.';
              return;
            }
            window.open(url, '_blank', 'noopener');
          } catch (e) {}
        }

        go.addEventListener('click', run, false);
        q.addEventListener('keydown', function (ev) {
          try {
            if (ev.key === 'Enter') {
              ev.preventDefault();
              run();
            }
          } catch (e) {}
        }, false);

        try {
          q.focus();
        } catch (e) {}
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

// ==UserScript==
// @name        Ask AnythingLLM
// @description Ask your own AnythingLLM about the page you are on
// @match       *
// @run-at      document-end
// @grant       GM_xmlhttpRequest
// @grant       GM_getValue
// @grant       GM_setValue
// ==/UserScript==

/*
 * Nijatva extension: ask your own AnythingLLM workspace about the page you are on.
 *
 * AnythingLLM is a self-hosted server (Node + vector database + your LLM key).
 * It cannot be recreated as a userscript - there is no server here, no vector
 * store, no embeddings. What a script CAN do is be its client: take the page
 * you are reading, send it to your own instance, and show the answer in a
 * panel without leaving the page.
 *
 * This is that client. It uses the documented API:
 *   POST {server}/api/v1/workspace/{slug}/chat
 *   Authorization: Bearer <API key>
 *   {"message": "...", "mode": "chat"}
 * and reads back {"textResponse": "...", "sources": [...]}.
 *
 * Two honest limits:
 *  - The app's native request has a 20 second read timeout. A slow LLM answer
 *    that takes longer than that fails with "no response". Nothing the script
 *    can do about it; use a faster model on the server if it bites.
 *  - The server URL and API key are stored in this app's extension preferences,
 *    in plain text. Treat the API key like a password.
 *
 * Pattern: *  (you may want to ask about any page; the panel is a small pill
 *              that stays out of the way until tapped)
 */
(function () {
  try {
    if (window.__nijatvaAskAnything) return; // never run twice
    window.__nijatvaAskAnything = 1;

    var MAX_PAGE = 6000; // characters of page text sent as context
    var MAX_SEL = 4000;

    var pill = null;
    var panel = null;
    var body = null; // where the current view (setup or ask) is rendered
    var busy = false;

    var CSS =
      '#nijatva-allm-pill{' +
      'position:fixed!important;right:12px!important;bottom:14px!important;' +
      'z-index:2147483645!important;margin:0!important;padding:0 12px!important;' +
      'height:34px!important;border:0!important;border-radius:17px!important;' +
      'background:rgba(20,20,22,.72)!important;color:#fff!important;' +
      'font:13px/34px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;' +
      'opacity:.62!important;cursor:pointer!important;' +
      'box-shadow:0 2px 10px rgba(0,0,0,.3)!important;' +
      '}' +
      '#nijatva-allm-pill:hover{opacity:1!important}' +
      '#nijatva-allm-panel{' +
      'position:fixed!important;right:12px!important;bottom:56px!important;' +
      'width:330px!important;max-width:calc(100vw - 24px)!important;' +
      'max-height:min(70vh,560px)!important;z-index:2147483647!important;' +
      'display:none;flex-direction:column!important;' +
      'background:#1b1b1f!important;color:#f1f1f3!important;' +
      'border:1px solid rgba(255,255,255,.10)!important;border-radius:12px!important;' +
      'box-shadow:0 12px 40px rgba(0,0,0,.5)!important;overflow:hidden!important;' +
      'font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;' +
      'box-sizing:border-box!important;' +
      '}' +
      '#nijatva-allm-panel *{box-sizing:border-box!important}' +
      '#nijatva-allm-panel .allm-head{' +
      'display:flex!important;align-items:center!important;justify-content:space-between!important;' +
      'padding:10px 12px!important;border-bottom:1px solid rgba(255,255,255,.08)!important;' +
      'font-weight:600!important;font-size:13px!important;' +
      '}' +
      '#nijatva-allm-panel .allm-x{' +
      'background:transparent!important;border:0!important;color:#9a9aa2!important;' +
      'font-size:16px!important;line-height:1!important;cursor:pointer!important;padding:2px 4px!important;' +
      '}' +
      '#nijatva-allm-panel .allm-body{' +
      'padding:12px!important;overflow-y:auto!important;flex:1 1 auto!important;' +
      '}' +
      '#nijatva-allm-panel label{' +
      'display:block!important;margin:0 0 4px!important;font-size:11px!important;' +
      'letter-spacing:.03em!important;text-transform:uppercase!important;color:#9a9aa2!important;' +
      '}' +
      '#nijatva-allm-panel input,#nijatva-allm-panel textarea{' +
      'width:100%!important;margin:0 0 10px!important;padding:7px 9px!important;' +
      'background:#121214!important;color:#f1f1f3!important;' +
      'border:1px solid rgba(255,255,255,.12)!important;border-radius:7px!important;' +
      'font:13px/1.4 inherit!important;' +
      '}' +
      '#nijatva-allm-panel textarea{resize:vertical!important;min-height:58px!important}' +
      '#nijatva-allm-panel .allm-go{' +
      'display:block!important;width:100%!important;margin:2px 0 8px!important;' +
      'padding:8px 10px!important;border:0!important;border-radius:7px!important;' +
      'background:#4b6cf6!important;color:#fff!important;font:600 13px/1.4 inherit!important;' +
      'cursor:pointer!important;' +
      '}' +
      '#nijatva-allm-panel .allm-go[disabled]{opacity:.55!important;cursor:default!important}' +
      '#nijatva-allm-panel .allm-link{' +
      'background:transparent!important;border:0!important;color:#8fa6ff!important;' +
      'font:12px/1.4 inherit!important;cursor:pointer!important;padding:0!important;' +
      'text-decoration:underline!important;' +
      '}' +
      '#nijatva-allm-panel .allm-note{' +
      'color:#9a9aa2!important;font-size:11.5px!important;margin:0 0 8px!important;' +
      '}' +
      '#nijatva-allm-panel .allm-answer{' +
      'white-space:pre-wrap!important;word-break:break-word!important;' +
      'background:#121214!important;border-radius:8px!important;padding:9px 10px!important;' +
      'margin:2px 0 8px!important;max-height:34vh!important;overflow-y:auto!important;' +
      '}' +
      '#nijatva-allm-panel .allm-err{color:#ff9b9b!important;font-size:12px!important;margin:0 0 8px!important}' +
      '#nijatva-allm-panel .allm-src{font-size:11.5px!important;color:#9a9aa2!important;margin:0 0 4px!important}' +
      '#nijatva-allm-panel .allm-src a{color:#8fa6ff!important;text-decoration:none!important}' +
      '#nijatva-allm-panel .allm-row{display:flex!important;gap:8px!important;align-items:center!important;' +
      'justify-content:space-between!important;margin:0 0 6px!important}' +
      '#nijatva-allm-panel .allm-ctx{font-size:11.5px!important;color:#9a9aa2!important}' +
      '#nijatva-allm-panel .allm-dots{font-size:12px!important;color:#9a9aa2!important}';

    /* ---------- storage ---------- */

    function hasGM() {
      try {
        return typeof window.GM_getValue === 'function' &&
               typeof window.GM_setValue === 'function';
      } catch (e) {
        return false;
      }
    }

    function get(k, d) {
      try {
        if (!hasGM()) return d;
        var v = window.GM_getValue(k, d);
        return v === null || v === undefined || v === '' ? d : String(v);
      } catch (e) {
        return d;
      }
    }

    function set(k, v) {
      try {
        if (hasGM()) window.GM_setValue(k, v);
      } catch (e) {}
    }

    function config() {
      return {
        srv: get('server', ''),
        key: get('apikey', ''),
        slug: get('workspace', '')
      };
    }

    function configured(c) {
      return !!(c.srv && c.key && c.slug);
    }

    function baseUrl(raw) {
      try {
        var s = String(raw || '').trim().replace(/\/+$/, '');
        if (!s) return '';
        if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
        if (!/^https?:\/\//i.test(s)) return '';
        return s;
      } catch (e) {
        return '';
      }
    }

    /* ---------- context from the page ---------- */

    function pageText() {
      try {
        var t = '';
        try {
          var main = document.querySelector('article,main,[role="main"]');
          if (main && (main.innerText || '').length > 400) t = main.innerText;
        } catch (e) {}
        if (!t) t = (document.body && document.body.innerText) || '';
        t = t.replace(/[ \t\u00a0]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
        return t;
      } catch (e) {
        return '';
      }
    }

    function selectionText() {
      try {
        var s = window.getSelection ? String(window.getSelection()) : '';
        return s.replace(/[ \t\u00a0]+/g, ' ').trim();
      } catch (e) {
        return '';
      }
    }

    function buildMessage(question) {
      try {
        var sel = selectionText();
        var ctx = sel ? sel.slice(0, MAX_SEL) : pageText().slice(0, MAX_PAGE);
        var title = document.title || '';
        var url = window.location.href;
        var head = 'Answer the question using the ' +
          (sel ? 'selected text' : 'page') + ' below as the main source.\n\n' +
          'Title: ' + title + '\nURL: ' + url + '\n\n--- ' +
          (sel ? 'SELECTION' : 'PAGE TEXT') + ' ---\n' + ctx + '\n--- END ---\n\n' +
          'Question: ' + question;
        return head;
      } catch (e) {
        return question;
      }
    }

    /* ---------- DOM ---------- */

    function injectCss() {
      try {
        if (document.getElementById('nijatva-allm-style')) return;
        var s = document.createElement('style');
        s.id = 'nijatva-allm-style';
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

    function ensurePanel() {
      try {
        if (panel && document.documentElement.contains(panel)) return panel;

        panel = el('div');
        panel.id = 'nijatva-allm-panel';

        var head = el('div', 'allm-head');
        head.appendChild(el('span', null, 'Ask AnythingLLM'));
        var x = el('button', 'allm-x', '\u00d7');
        x.type = 'button';
        x.setAttribute('aria-label', 'Close');
        x.addEventListener('click', closePanel, false);
        head.appendChild(x);
        panel.appendChild(head);

        body = el('div', 'allm-body');
        panel.appendChild(body);

        document.documentElement.appendChild(panel);
        return panel;
      } catch (e) {
        return null;
      }
    }

    function ensurePill() {
      try {
        if (pill && document.documentElement.contains(pill)) return pill;
        pill = el('button', null, 'Ask');
        pill.id = 'nijatva-allm-pill';
        pill.type = 'button';
        pill.title = 'Ask your AnythingLLM about this page';
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

    function render() {
      try {
        if (!body) return;
        body.textContent = '';
        var c = config();
        if (!configured(c)) renderSetup();
        else renderAsk();
      } catch (e) {}
    }

    function renderSetup() {
      try {
        var c = config();

        body.appendChild(el('p', 'allm-note',
          'Point this at your own AnythingLLM server. The API key is made in ' +
          'Settings \u2192 API Keys on that server.'));

        body.appendChild(el('label', null, 'Server URL'));
        var srv = el('input');
        srv.type = 'url';
        srv.placeholder = 'http://192.168.1.10:3001';
        srv.value = c.srv || '';
        body.appendChild(srv);

        body.appendChild(el('label', null, 'API key'));
        var key = el('input');
        key.type = 'password';
        key.placeholder = 'paste the key';
        key.value = c.key || '';
        body.appendChild(key);

        body.appendChild(el('label', null, 'Workspace slug'));
        var slug = el('input');
        slug.type = 'text';
        slug.placeholder = 'my-documents';
        slug.value = c.slug || '';
        body.appendChild(slug);

        var err = el('p', 'allm-err');
        body.appendChild(err);

        var save = el('button', 'allm-go', 'Save');
        save.type = 'button';
        save.addEventListener('click', function () {
          try {
            var b = baseUrl(srv.value);
            if (!b) {
              err.textContent = 'That server URL does not look right.';
              return;
            }
            if (!String(key.value).trim() || !String(slug.value).trim()) {
              err.textContent = 'API key and workspace slug are both needed.';
              return;
            }
            set('server', b);
            set('apikey', String(key.value).trim());
            set('workspace', String(slug.value).trim());
            render();
          } catch (e) {}
        }, false);
        body.appendChild(save);

        if (configured(config())) {
          var back = el('button', 'allm-link', 'Cancel');
          back.type = 'button';
          back.addEventListener('click', render, false);
          body.appendChild(back);
        }
      } catch (e) {}
    }

    function renderAsk() {
      try {
        var c = config();
        var sel = selectionText();

        var top = el('div', 'allm-row');
        top.appendChild(el('span', 'allm-ctx',
          sel ? 'Context: selection (' + sel.length + ' chars)'
              : 'Context: whole page'));
        var settings = el('button', 'allm-link', 'Settings');
        settings.type = 'button';
        settings.addEventListener('click', renderSetup, false);
        top.appendChild(settings);
        body.appendChild(top);

        var q = el('textarea');
        q.placeholder = 'What does this say about\u2026';
        q.rows = 3;
        body.appendChild(q);

        var go = el('button', 'allm-go', 'Ask');
        go.type = 'button';
        body.appendChild(go);

        var out = el('div');
        body.appendChild(out);

        go.addEventListener('click', function () {
          try {
            var question = String(q.value || '').trim();
            if (!question) {
              out.textContent = '';
              out.appendChild(el('p', 'allm-err', 'Type a question first.'));
              return;
            }
            ask(c, buildMessage(question), out, go);
          } catch (e) {}
        }, false);

        q.addEventListener('keydown', function (ev) {
          try {
            if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
              ev.preventDefault();
              go.click();
            }
          } catch (e) {}
        }, false);
      } catch (e) {}
    }

    /* ---------- the request ---------- */

    function ask(c, message, out, go) {
      try {
        if (busy) return;
        if (typeof window.GM_xmlhttpRequest !== 'function') {
          out.textContent = '';
          out.appendChild(el('p', 'allm-err',
            'This browser did not give the script GM_xmlhttpRequest, so it cannot ' +
            'reach the server.'));
          return;
        }

        busy = true;
        go.disabled = true;
        out.textContent = '';
        out.appendChild(el('p', 'allm-dots', 'Asking\u2026'));

        var url = baseUrl(c.srv) + '/api/v1/workspace/' +
          encodeURIComponent(c.slug) + '/chat';

        var done = function () {
          busy = false;
          try {
            go.disabled = false;
          } catch (e) {}
        };

        var showError = function (text) {
          out.textContent = '';
          out.appendChild(el('p', 'allm-err', text));
        };

        var parse = function (raw) {
          try {
            return JSON.parse(raw);
          } catch (e) {
            return null;
          }
        };

        window.GM_xmlhttpRequest({
          method: 'POST',
          url: url,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + c.key
          },
          data: JSON.stringify({message: message, mode: 'chat'}),
          onload: function (r) {
            try {
              done();
              var j = parse(r && r.responseText);
              if (!j) {
                showError('The server answered, but not with JSON. Check that ' +
                  'the URL points at AnythingLLM and not a proxy page.');
                return;
              }
              if (j.error) {
                showError(String(j.error));
                return;
              }
              var text = j.textResponse || j.text || '';
              out.textContent = '';
              if (!text) {
                showError('The server sent an empty answer.');
                return;
              }
              out.appendChild(el('div', 'allm-answer', text));
              renderSources(out, j.sources);
            } catch (e) {
              done();
            }
          },
          onerror: function (r) {
            try {
              done();
              var status = r && r.status;
              if (status === 403) {
                showError('The API key was rejected (403). Make sure it is a ' +
                  'key from this server and that the workspace slug is right.');
                return;
              }
              if (status === 404) {
                showError('No workspace called "' + c.slug + '" on that server (404).');
                return;
              }
              if (status) {
                var j = parse(r && r.responseText);
                showError(j && j.error ? String(j.error)
                  : 'The server answered with HTTP ' + status + '.');
                return;
              }
              showError('Could not reach ' + baseUrl(c.srv) + '. Check the ' +
                'address, and that the phone can see the server.');
            } catch (e) {
              done();
            }
          }
        });
      } catch (e) {
        busy = false;
        try {
          go.disabled = false;
        } catch (x) {}
      }
    }

    function renderSources(out, sources) {
      try {
        if (!sources || !sources.length) return;
        var seen = {};
        var count = 0;
        for (var i = 0; i < sources.length && count < 6; i++) {
          var s = sources[i] || {};
          var label = s.title || s.url || '';
          if (!label || seen[label]) continue;
          seen[label] = 1;
          count++;
          var p = el('p', 'allm-src', '\u2022 ');
          if (s.url) {
            var a = el('a', null, label);
            a.href = s.url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            p.appendChild(a);
          } else {
            p.appendChild(document.createTextNode(label));
          }
          out.appendChild(p);
        }
      } catch (e) {}
    }

    /* ---------- start ---------- */

    function start() {
      try {
        injectCss();
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

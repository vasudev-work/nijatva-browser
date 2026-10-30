# Writing an extension for Nijatva / Aekant

An "extension" here is a **userscript**: JavaScript injected into pages whose URL
matches a pattern. It is not a Chrome extension - Manifest V2/V3 needs a Chromium
engine with an extension API, and Android WebView has none.

Two files per extension, both in `extensions/` in the repo:

    extensions/
      index.json          <- the catalogue
      my-script.js        <- the code

---

## 1. The prompt

Copy this, fill the three blanks, and hand it to any assistant.

```
Write a Nijatva userscript.

SITE:      <e.g. youtube.com, or * for every site>
GOAL:      <one sentence: what should change on the page>
PATTERN:   <e.g. *youtube.com*   or   *github.com*,*gitlab.com*   or   *>

Rules it must follow:
1. Wrap everything in an IIFE with a guard so it cannot run twice:
      (function(){ if (window.__nijatvaXxx) return; window.__nijatvaXxx = 1; ... })();
2. try/catch around everything. A broken script must never break the page.
3. Inject CSS through a <style id="nijatva-xxx"> element, not inline styles on
   elements, so the page's own CSS cannot fight it.
4. Re-apply on DOMContentLoaded and on DOM changes (MutationObserver). No
   setInterval faster than 3 seconds.
5. Never hide an element that has visible text, an image, a link, a video or an
   input inside it. Hide only what is genuinely empty or matches an exact
   selector.
6. Do not fetch anything unless asked. If you do, use GM_xmlhttpRequest, not fetch.
7. Plain ES5 JavaScript. No libraries, no build step, no import/export.

Output: only the .js file, then the matching index.json entry.
```

---

## 2. The pattern field

`pattern` decides which pages get the script. `*` is a wildcard, commas separate
alternatives, and the match is against the **whole URL**.

| Pattern | Runs on |
|---|---|
| `*` | every page (use sparingly - it runs everywhere) |
| `*youtube.com*` | youtube.com and all its subdomains and paths |
| `*github.com*,*gitlab.com*` | either site |
| `*youtube.com/watch*` | only watch pages |
| `https://news.ycombinator.com/*` | one host, any path |

Rule of thumb: **the narrowest pattern that still works.** A `*` script is loaded
into every page the user opens; if it is slow, the whole browser feels slow.

---

## 3. The index entry

```json
{
  "id": "my-script",
  "name": "My script",
  "desc": "One line, shown under the name",
  "pattern": "*example.com*",
  "file": "my-script.js",
  "version": "1.0"
}
```

- `id` - lowercase, hyphens, unique. The file should be named after it.
- `name` - what the user sees in the list.
- `desc` - one line. Keep it under ~60 characters so it does not wrap.
- `file` - the `.js` in the same folder.
- `version` - bump it when the script changes; the app uses it to tell versions apart.

Add the entry to the `extensions` array in `index.json` and push. The browser
reads `index.json` from the Extension source URL, which is by default:

    https://raw.githubusercontent.com/vasudev-work/nijatva-browser/main/extensions/

The repository must be **public** - a private repo returns 404 to the app.

---

## 4. The skeleton

```js
/*
 * Nijatva extension: <one line on what it does>.
 *
 * <Why it exists, and what it deliberately does not do.>
 */
(function () {
  try {
    if (window.__nijatvaMyScript) return;   // never run twice
    window.__nijatvaMyScript = 1;

    var CSS = 'selector{display:none!important}';

    function apply() {
      try {
        if (!document.body) return;
        var s = document.getElementById('nijatva-my-script');
        if (!s) {
          s = document.createElement('style');
          s.id = 'nijatva-my-script';
          s.textContent = CSS;
          document.documentElement.appendChild(s);
        }
      } catch (e) { }
    }

    apply();
    document.addEventListener('DOMContentLoaded', apply);
    try {
      new MutationObserver(apply).observe(document.documentElement, {
        childList: true, subtree: true
      });
    } catch (e) { }
  } catch (e) { }
})();
```

For a script that has to act on the page's own elements (not just CSS), replace
`apply()` with a sweep that queries the page and acts, and throttle it:

```js
var timer = null;
function soon() {
  if (timer) return;
  timer = setTimeout(function () { timer = null; sweep(); }, 1200);
}
```

---

## 5. What the script can use

Plain DOM, and these helpers when the metadata block asks for them:

| Helper | Does |
|---|---|
| `GM_setValue(key, value)` | store a value for this extension |
| `GM_getValue(key, default)` | read it back |
| `GM_deleteValue(key)` / `GM_listValues()` | remove / list keys |
| `GM_log(...)` | write to the app's log |
| `GM_addStyle(css)` | inject CSS |
| `GM_xmlhttpRequest({...})` | make a request outside the page's origin |
| `GM_info` | name and version of the running script |

To get them, the script carries a Tampermonkey-style header, which the app parses
to fill in the name, description and pattern automatically:

```js
// ==UserScript==
// @name        My script
// @description One line
// @match       *example.com*
// @run-at      document-end
// @grant       GM_setValue
// ==/UserScript==
```

`@run-at document-start` runs before the page builds itself - use it only when
the script must see the page early; otherwise `document-end`.

**Not available:** `chrome.*` (any of it), extension service workers, blocking
web requests. Network blocking is the browser's own job, done natively with the
bundled filter lists.

---

## 6. The five ways a script breaks a page

Learned the hard way in this project's reader apps:

1. **Running twice** - two style blocks, two observers, doubled behaviour. Always guard.
2. **Hiding too much** - a selector like `[class*="ad"]` also matches
   `[class*="adaptive"]` and `[class*="loading"]`. Hide only when the element is
   empty, or match an exact id/class.
3. **Fighting the page's CSS** - inline styles get overwritten. Inject a `<style>`
   with `!important` and let the cascade do it.
4. **A tight loop** - `setInterval(..., 100)` on every page drains the battery and
   makes scrolling stutter. 3 seconds minimum, or react to mutations instead.
5. **Throwing** - one uncaught error can stop the rest of the script. Every entry
   point gets its own try/catch.

---

## 7. Testing before publishing

1. Settings -> Extensions -> **Add manually** - paste the script, set the pattern.
2. Open the site, reload the page.
3. Check the thing you changed, then check something you did **not** intend to
   change - text, images, buttons, the login form.
4. Only then put the file in `extensions/` and add the index entry.

A script that works but hides one real element is worse than no script at all.

---

## 8. A worked example

`cosmetic-cleanup.js` in this repo is the model to copy:

- pattern `*`, because blank ad boxes can appear anywhere
- it matches known ad containers, then removes one **only if it has no text, no
  image, no link, no video and still takes up real space**
- CSS injection for the simple cases, a throttled sweep for the rest
- a MutationObserver so late-loading boxes are caught too
- every entry point in its own try/catch

That combination - narrow behaviour, wide pattern, conservative hiding - is what
makes a script safe to ship to everyone.

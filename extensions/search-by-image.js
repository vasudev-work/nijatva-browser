/*
 * Nijatva extension: reverse image search on any page.
 *
 * Hover a picture, tap the magnifier that appears in its corner, pick an engine.
 * Alt+click a picture to go straight to Google Lens. On touch screens, press and
 * hold a picture for the engine menu.
 *
 * The URL templates below are taken from dessant/search-by-image (GPL-3.0) and
 * cover only the engines that accept a public image URL. Engines that need a
 * file upload (SauceNAO, Baidu, Yandex-by-file, Getty, stock sites) cannot work
 * from a userscript, because a page script cannot post a local file to another
 * origin.
 *
 * Deliberately narrow: it never hides, moves or restyles anything on the page.
 * It only adds one button and one menu of its own, and both live outside the
 * page's own layout. Nothing runs on scroll, and the only timer is the 650 ms
 * long-press on touch devices.
 *
 * Pattern: *  (a picture can be anywhere, so the script must be everywhere;
 *              it is inert until an image is hovered or pressed)
 */
(function () {
  try {
    if (window.__nijatvaSearchByImage) return; // never run twice
    window.__nijatvaSearchByImage = 1;

    var ENGINES = [
      {
        id: 'googleLens',
        name: 'Google Lens',
        url: 'https://lens.google.com/upload?url={imgUrl}'
      },
      {
        id: 'googleImages',
        name: 'Google Images',
        url:
          'https://www.google.com/searchbyimage?sbisrc=cr_1_5_2&image_url={imgUrl}'
      },
      {
        id: 'bing',
        name: 'Bing',
        url:
          'https://www.bing.com/images/search?q=imgurl:{imgUrl}&view=detailv2' +
          '&iss=sbi&FORM=IRSBIQ'
      },
      {
        id: 'yandex',
        name: 'Yandex',
        url: 'https://yandex.com/images/search?url={imgUrl}&rpt=imageview'
      },
      {
        id: 'tineye',
        name: 'TinEye',
        url: 'https://www.tineye.com/search/?&url={imgUrl}'
      },
      {
        id: 'lenso',
        name: 'Lenso.ai',
        url: 'https://lenso.ai/en/search-by-url?url={imgUrl}&utm_source=sbi'
      },
      {
        id: 'iqdb',
        name: 'IQDB (anime)',
        url: 'https://iqdb.org/?url={imgUrl}'
      },
      {
        id: 'ascii2d',
        name: 'ascii2d (anime)',
        url: 'https://ascii2d.net/search/url/{imgUrl}'
      },
      {
        id: 'sogou',
        name: 'Sogou',
        url: 'https://pic.sogou.com/ris?query={imgUrl}&flag=1&drag=0'
      }
    ];

    var MIN_W = 120;
    var MIN_H = 90;

    var btn = null;
    var menu = null;
    var hoverImg = null;
    var hideTimer = null;
    var menuOpenedAt = 0;

    /* ---------- CSS ---------- */

    var CSS =
      '#nijatva-sbi-btn,#nijatva-sbi-menu{' +
      'position:fixed!important;z-index:2147483647!important;' +
      'box-sizing:border-box!important;margin:0!important;padding:0!important;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;' +
      '}' +
      '#nijatva-sbi-btn{' +
      'align-items:center!important;justify-content:center!important;' +
      'width:30px!important;height:30px!important;border:0!important;border-radius:8px!important;' +
      'background:rgba(20,20,22,.82)!important;color:#fff!important;cursor:pointer!important;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.35)!important;opacity:.85!important;' +
      'transition:opacity .12s ease,transform .12s ease!important;' +
      '}' +
      '#nijatva-sbi-btn:hover{' +
      'opacity:1!important;transform:scale(1.06)!important;background:rgba(20,20,22,.95)!important;' +
      '}' +
      '#nijatva-sbi-btn svg{width:16px!important;height:16px!important;display:block!important}' +
      '#nijatva-sbi-menu{' +
      'min-width:184px!important;max-width:240px!important;padding:6px!important;' +
      'border-radius:10px!important;background:#1c1c1f!important;color:#f2f2f2!important;' +
      'box-shadow:0 8px 28px rgba(0,0,0,.45)!important;' +
      'border:1px solid rgba(255,255,255,.09)!important;font-size:13px!important;' +
      'line-height:1.35!important;' +
      '}' +
      '#nijatva-sbi-menu .nijatva-sbi-head{' +
      'padding:4px 8px 6px!important;font-size:11px!important;letter-spacing:.04em!important;' +
      'text-transform:uppercase!important;color:#9a9aa2!important;' +
      '}' +
      '#nijatva-sbi-menu button{' +
      'display:block!important;width:100%!important;text-align:left!important;' +
      'padding:7px 9px!important;border:0!important;border-radius:7px!important;' +
      'background:transparent!important;color:#f2f2f2!important;font:inherit!important;' +
      'cursor:pointer!important;white-space:nowrap!important;' +
      'overflow:hidden!important;text-overflow:ellipsis!important;' +
      '}' +
      '#nijatva-sbi-menu button:hover,' +
      '#nijatva-sbi-menu button:focus{' +
      'background:rgba(255,255,255,.10)!important;outline:none!important;' +
      '}';

    var SVG =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.2" stroke-linecap="round" aria-hidden="true">' +
      '<circle cx="10.5" cy="10.5" r="6.5"></circle>' +
      '<line x1="15.4" y1="15.4" x2="21" y2="21"></line></svg>';

    function injectCss() {
      try {
        if (document.getElementById('nijatva-search-by-image')) return;
        var s = document.createElement('style');
        s.id = 'nijatva-search-by-image';
        s.textContent = CSS;
        (document.head || document.documentElement).appendChild(s);
      } catch (e) {}
    }

    /* ---------- image URL ---------- */

    function absolute(u) {
      try {
        if (!u) return '';
        u = String(u).trim();
        if (!u) return '';
        if (/^data:/i.test(u) || /^blob:/i.test(u)) return '';
        if (u.indexOf('//') === 0) return window.location.protocol + u;
        if (!/^https?:/i.test(u)) {
          if (!/^\/|^\.|^[a-z0-9]/i.test(u)) return '';
          u = new URL(u, window.location.href).href;
        }
        if (!/^https?:\/\//i.test(u)) return '';
        return u;
      } catch (e) {
        return '';
      }
    }

    function imgUrlFor(img) {
      try {
        var u = absolute(img.currentSrc) || absolute(img.src);
        if (u) return u;
        var attrs = [
          'data-src',
          'data-original',
          'data-lazy-src',
          'data-full',
          'data-large',
          'data-image'
        ];
        for (var i = 0; i < attrs.length; i++) {
          u = absolute(img.getAttribute(attrs[i]));
          if (u) return u;
        }
        return '';
      } catch (e) {
        return '';
      }
    }

    function usable(img) {
      try {
        if (!img || img.tagName !== 'IMG') return false;
        if (img.closest('#nijatva-sbi-btn,#nijatva-sbi-menu')) return false;
        var r = img.getBoundingClientRect();
        if (r.width < MIN_W || r.height < MIN_H) return false;
        var vw = window.innerWidth || 0;
        var vh = window.innerHeight || 0;
        if (r.bottom < 0 || r.right < 0 || r.top > vh || r.left > vw) return false;
        return !!imgUrlFor(img);
      } catch (e) {
        return false;
      }
    }

    /* ---------- the button ---------- */

    function ensureBtn() {
      try {
        if (btn && document.documentElement.contains(btn)) return btn;
        btn = document.createElement('button');
        btn.id = 'nijatva-sbi-btn';
        btn.type = 'button';
        btn.title = 'Search this image';
        btn.setAttribute('aria-label', 'Search this image');
        btn.innerHTML = SVG;
        btn.addEventListener('mouseenter', cancelHide, false);
        btn.addEventListener('mouseleave', scheduleHide, false);
        btn.addEventListener(
          'click',
          function (ev) {
            try {
              ev.preventDefault();
              ev.stopPropagation();
              if (!hoverImg) return;
              var r = btn.getBoundingClientRect();
              openMenu(hoverImg, r.left - 150, r.bottom + 6);
            } catch (e) {}
          },
          false
        );
        document.documentElement.appendChild(btn);
        return btn;
      } catch (e) {
        return null;
      }
    }

    function placeBtn(img) {
      try {
        var r = img.getBoundingClientRect();
        var vw = window.innerWidth || 0;
        var left = Math.min(r.right - 38, vw - 38);
        var top = Math.max(r.top + 6, 6);
        if (left < 4) left = 4;
        btn.style.left = Math.round(left) + 'px';
        btn.style.top = Math.round(top) + 'px';
      } catch (e) {}
    }

    function showButton(img) {
      try {
        cancelHide();
        if (!ensureBtn()) return;
        placeBtn(img);
        btn.style.setProperty('display', 'flex', 'important');
      } catch (e) {}
    }

    function hideButton() {
      try {
        if (btn) btn.style.setProperty('display', 'none', 'important');
      } catch (e) {}
    }

    function scheduleHide() {
      try {
        cancelHide();
        hideTimer = setTimeout(function () {
          hideTimer = null;
          if (menu && menu.style.display === 'block') return;
          hoverImg = null;
          hideButton();
        }, 280);
      } catch (e) {}
    }

    function cancelHide() {
      try {
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
      } catch (e) {}
    }

    /* ---------- the menu ---------- */

    function buildMenu() {
      try {
        if (menu && document.documentElement.contains(menu)) return menu;
        menu = document.createElement('div');
        menu.id = 'nijatva-sbi-menu';
        menu.style.display = 'none';

        var head = document.createElement('div');
        head.className = 'nijatva-sbi-head';
        head.textContent = 'Search by image';
        menu.appendChild(head);

        for (var i = 0; i < ENGINES.length; i++) {
          (function (engine) {
            var b = document.createElement('button');
            b.type = 'button';
            b.textContent = engine.name;
            b.addEventListener(
              'click',
              function (ev) {
                try {
                  ev.preventDefault();
                  ev.stopPropagation();
                  var img = hoverImg;
                  closeMenu();
                  if (img) runSearch(engine, img);
                } catch (e) {}
              },
              false
            );
            menu.appendChild(b);
          })(ENGINES[i]);
        }

        document.documentElement.appendChild(menu);
        return menu;
      } catch (e) {
        return null;
      }
    }

    function openMenu(img, x, y) {
      try {
        if (!img || !imgUrlFor(img)) return;
        hoverImg = img;
        if (!buildMenu()) return;

        var vw = window.innerWidth || 0;
        var vh = window.innerHeight || 0;
        var w = 200;
        var h = 44 + ENGINES.length * 31;
        var left = Math.min(Math.max(6, x), Math.max(6, vw - w - 6));
        var top = Math.min(Math.max(6, y), Math.max(6, vh - h - 6));

        menu.style.left = Math.round(left) + 'px';
        menu.style.top = Math.round(top) + 'px';
        menu.style.display = 'block';
        menuOpenedAt = Date.now();
      } catch (e) {}
    }

    function closeMenu() {
      try {
        if (menu) menu.style.display = 'none';
        cancelHide();
        hoverImg = null;
        hideButton();
      } catch (e) {}
    }

    function menuOpen() {
      try {
        return !!(menu && menu.style.display === 'block');
      } catch (e) {
        return false;
      }
    }

    /* ---------- search ---------- */

    function runSearch(engine, img) {
      try {
        var u = imgUrlFor(img);
        if (!u) return;
        var target = engine.url.replace('{imgUrl}', encodeURIComponent(u));
        var w = window.open(target, '_blank', 'noopener');
        if (w) {
          try {
            w.opener = null;
          } catch (e) {}
        }
      } catch (e) {}
    }

    /* ---------- events ---------- */

    function onOver(ev) {
      try {
        var t = ev.target;
        if (!t || t.nodeType !== 1) return;
        if (t.id === 'nijatva-sbi-btn' || (menu && menu.contains(t))) {
          cancelHide();
          return;
        }
        if (t.tagName !== 'IMG') {
          if (menuOpen()) return;
          if (btn && btn.style.display === 'flex') scheduleHide();
          return;
        }
        if (!usable(t)) {
          if (btn && btn.style.display === 'flex') scheduleHide();
          return;
        }
        hoverImg = t;
        showButton(t);
      } catch (e) {}
    }

    function onClick(ev) {
      try {
        if (menuOpen()) {
          var t = ev.target;
          if (menu && menu.contains(t)) return;
          if (btn && btn.contains(t)) return;
          if (Date.now() - menuOpenedAt > 250) closeMenu();
        }
        // Alt+click: straight to Google Lens.
        var t2 = ev.target;
        if (
          ev.altKey &&
          t2 &&
          t2.tagName === 'IMG' &&
          usable(t2)
        ) {
          ev.preventDefault();
          ev.stopPropagation();
          runSearch(ENGINES[0], t2);
        }
      } catch (e) {}
    }

    function onKey(ev) {
      try {
        if (ev.key === 'Escape' || ev.keyCode === 27) {
          if (menuOpen()) closeMenu();
        }
      } catch (e) {}
    }

    function onScroll() {
      try {
        if (menuOpen()) closeMenu();
        else if (btn && btn.style.display === 'flex') {
          hoverImg = null;
          hideButton();
        }
      } catch (e) {}
    }

    /* ---------- touch: press and hold ---------- */

    var pressTimer = null;
    var pressFired = false;
    var pressX = 0;
    var pressY = 0;

    function clearPress() {
      try {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      } catch (e) {}
    }

    function onTouchStart(ev) {
      try {
        clearPress();
        pressFired = false;
        var t = ev.target;
        if (!t || t.nodeType !== 1 || t.tagName !== 'IMG') return;
        if (!usable(t)) return;
        var touch = ev.touches && ev.touches[0];
        if (!touch) return;
        pressX = touch.clientX;
        pressY = touch.clientY;
        var img = t;
        pressTimer = setTimeout(function () {
          pressTimer = null;
          pressFired = true;
          openMenu(img, pressX + 8, pressY + 8);
        }, 650);
      } catch (e) {}
    }

    function onTouchMove(ev) {
      try {
        if (!pressTimer) return;
        var touch = ev.touches && ev.touches[0];
        if (!touch) return;
        if (
          Math.abs(touch.clientX - pressX) > 12 ||
          Math.abs(touch.clientY - pressY) > 12
        ) {
          clearPress();
        }
      } catch (e) {}
    }

    function onContextMenu(ev) {
      try {
        if (pressFired) {
          pressFired = false;
          ev.preventDefault();
          ev.stopPropagation();
        }
      } catch (e) {}
    }

    /* ---------- start ---------- */

    function start() {
      try {
        injectCss();
        document.addEventListener('mouseover', onOver, true);
        document.addEventListener('click', onClick, true);
        document.addEventListener('keydown', onKey, true);
        document.addEventListener('scroll', onScroll, true);
        document.addEventListener('touchstart', onTouchStart, true);
        document.addEventListener('touchmove', onTouchMove, true);
        document.addEventListener('touchend', clearPress, true);
        document.addEventListener('touchcancel', clearPress, true);
        document.addEventListener('contextmenu', onContextMenu, true);
        window.addEventListener('resize', onScroll, false);
      } catch (e) {}
    }

    start();
  } catch (e) {}
})();

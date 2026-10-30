/*
 * Nijatva extension: see an image full size without leaving the page.
 *
 * Hover a thumbnail for a moment and the picture opens in place, fitted to the
 * window. Move away, click, scroll or press Escape and it is gone.
 *
 * Narrow by design. It previews an image only when the picture on screen is
 * meaningfully smaller than the window, or when it is a link to a bigger image
 * file - so it does not pop up over a photo that already fills the page, and it
 * never touches the page's own elements. The overlay is pointer-events:none, so
 * the page keeps its hover state; a click while it is open is swallowed (the
 * preview closes instead of the link underneath firing), which is the one
 * interception this script makes.
 *
 * Pattern: *  (a thumbnail can be anywhere; it is inert until you hover)
 */
(function () {
  try {
    if (window.__nijatvaHoverPreview) return; // never run twice
    window.__nijatvaHoverPreview = 1;

    var DELAY = 420; // ms of rest before the preview opens
    var MIN_SIDE = 200; // px: smaller than this is an icon, not a picture
    var MIN_GAIN = 1.35; // how much bigger the preview must be to be worth it
    var IMG_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|svg)([?#]|$)/i;

    var box = null;
    var pic = null;
    var timer = null;
    var hovered = null;
    var shown = false;

    var CSS =
      '#nijatva-hover-preview{' +
      'position:fixed!important;top:0!important;left:0!important;' +
      'right:0!important;bottom:0!important;z-index:2147483646!important;' +
      'display:none;align-items:center!important;justify-content:center!important;' +
      'background:rgba(10,10,12,.86)!important;padding:2vh 2vw!important;' +
      'box-sizing:border-box!important;pointer-events:none!important;' +
      'margin:0!important;border:0!important;' +
      '}' +
      '#nijatva-hover-preview img{' +
      'max-width:96vw!important;max-height:96vh!important;' +
      'width:auto!important;height:auto!important;' +
      'object-fit:contain!important;margin:0!important;padding:0!important;' +
      'border:0!important;border-radius:4px!important;background:#111!important;' +
      'box-shadow:0 10px 44px rgba(0,0,0,.55)!important;' +
      '}' +
      '#nijatva-hover-preview .nijatva-hover-hint{' +
      'position:absolute!important;bottom:10px!important;left:0!important;' +
      'right:0!important;text-align:center!important;color:rgba(255,255,255,.55)!important;' +
      'font:12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;' +
      '}';

    function injectCss() {
      try {
        if (document.getElementById('nijatva-hover-preview-style')) return;
        var s = document.createElement('style');
        s.id = 'nijatva-hover-preview-style';
        s.textContent = CSS;
        (document.head || document.documentElement).appendChild(s);
      } catch (e) {}
    }

    function ensureBox() {
      try {
        if (box && document.documentElement.contains(box)) return box;
        box = document.createElement('div');
        box.id = 'nijatva-hover-preview';
        box.setAttribute('aria-hidden', 'true');

        pic = document.createElement('img');
        pic.alt = '';
        box.appendChild(pic);

        var hint = document.createElement('div');
        hint.className = 'nijatva-hover-hint';
        hint.textContent = 'Esc or click to close';
        box.appendChild(hint);

        document.documentElement.appendChild(box);
        return box;
      } catch (e) {
        return null;
      }
    }

    function absolute(u) {
      try {
        if (!u) return '';
        u = String(u).trim();
        if (!u) return '';
        if (/^data:image\//i.test(u)) return u;
        if (/^(blob|javascript|mailto):/i.test(u)) return '';
        if (u.indexOf('//') === 0) return window.location.protocol + u;
        if (!/^https?:/i.test(u)) u = new URL(u, window.location.href).href;
        if (!/^https?:/i.test(u)) return '';
        return u;
      } catch (e) {
        return '';
      }
    }

    function imgSrc(img) {
      try {
        return absolute(img.currentSrc) || absolute(img.src) || '';
      } catch (e) {
        return '';
      }
    }

    // What, if anything, should be previewed for this element?
    function target(el) {
      try {
        if (!el || el.nodeType !== 1) return null;
        if (el.id === 'nijatva-hover-preview' || (box && box.contains(el))) {
          return null;
        }

        var vw = window.innerWidth || 0;
        var vh = window.innerHeight || 0;

        if (el.tagName === 'IMG') {
          var r = el.getBoundingClientRect();
          if (r.width < MIN_SIDE && r.height < MIN_SIDE) {
            // a small image can still be worth previewing if it links to the
            // original file
            var link = el.closest ? el.closest('a') : null;
            if (!link) return null;
            var href = absolute(link.getAttribute('href'));
            if (!href || !IMG_EXT.test(href)) return null;
            return {url: href, rect: r};
          }

          // already filling most of the window - a preview adds nothing
          if (r.width > vw * 0.7 && r.height > vh * 0.7) return null;

          var src = imgSrc(el);
          var best = src;

          var a = el.closest ? el.closest('a') : null;
          if (a) {
            var h = absolute(a.getAttribute('href'));
            if (h && IMG_EXT.test(h) && h !== src) best = h;
          }
          if (!best) return null;

          var gain = (vw * 0.96) / Math.max(r.width, 1);
          if (best === src && gain < MIN_GAIN) return null;

          return {url: best, rect: r};
        }

        if (el.tagName === 'A') {
          var href2 = absolute(el.getAttribute('href'));
          if (!href2 || !IMG_EXT.test(href2)) return null;
          var r2 = el.getBoundingClientRect();
          if (r2.width < 40 && r2.height < 40) return null;
          return {url: href2, rect: r2};
        }

        return null;
      } catch (e) {
        return null;
      }
    }

    function clearTimer() {
      try {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      } catch (e) {}
    }

    function show(url) {
      try {
        if (!ensureBox()) return;
        pic.src = url;
        box.style.setProperty('display', 'flex', 'important');
        shown = true;
      } catch (e) {}
    }

    function hide() {
      try {
        clearTimer();
        hovered = null;
        if (!shown) return;
        shown = false;
        if (box) box.style.setProperty('display', 'none', 'important');
        if (pic) pic.removeAttribute('src');
      } catch (e) {}
    }

    function onOver(ev) {
      try {
        if (shown) return;
        var t = target(ev.target);
        if (!t) return;
        if (hovered === ev.target) return;
        hovered = ev.target;
        clearTimer();
        timer = setTimeout(function () {
          timer = null;
          show(t.url);
        }, DELAY);
      } catch (e) {}
    }

    function onOut(ev) {
      try {
        if (shown) return; // closing is handled by onMove
        if (ev.target === hovered) {
          clearTimer();
          hovered = null;
        }
      } catch (e) {}
    }

    function onMove(ev) {
      try {
        if (!shown || !hovered) return;
        var r = hovered.getBoundingClientRect();
        var pad = 28;
        if (
          ev.clientX < r.left - pad ||
          ev.clientX > r.right + pad ||
          ev.clientY < r.top - pad ||
          ev.clientY > r.bottom + pad
        ) {
          hide();
        }
      } catch (e) {}
    }

    // A click while the preview is open closes it and goes no further, so the
    // link or button underneath never fires by accident.
    function onClick(ev) {
      try {
        if (!shown) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        hide();
      } catch (e) {}
    }

    function onKey(ev) {
      try {
        if (ev.key === 'Escape' || ev.keyCode === 27) hide();
      } catch (e) {}
    }

    function start() {
      try {
        injectCss();
        document.addEventListener('mouseover', onOver, true);
        document.addEventListener('mouseout', onOut, true);
        document.addEventListener('mousemove', onMove, true);
        document.addEventListener('click', onClick, true);
        document.addEventListener('keydown', onKey, true);
        document.addEventListener('scroll', hide, true);
        window.addEventListener('resize', hide, false);
      } catch (e) {}
    }

    start();
  } catch (e) {}
})();

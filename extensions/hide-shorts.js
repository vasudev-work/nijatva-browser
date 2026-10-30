/*
 * Nijatva extension: hide the Shorts shelves on YouTube.
 *
 * Phone YouTube is not the same page as desktop YouTube: it builds ytm-*
 * elements where the desktop builds ytd-*, and it often puts Shorts in an
 * ordinary shelf with a "Shorts" heading. So this covers both sets of element
 * names, and then sweeps for any shelf whose heading says Shorts.
 */
(function () {
  try {
    if (window.__nijatvaShorts) return;
    window.__nijatvaShorts = 1;

    var CSS = [
      'ytd-reel-shelf-renderer',            // desktop shelf
      'ytd-rich-shelf-renderer[is-shorts]', // desktop home shelf
      'ytd-reel-item-renderer',
      'ytm-reel-shelf-renderer',            // phone shelf
      'ytm-reel-item-renderer',
      'ytm-shorts-lockup-view-model',
      'ytm-shorts-lockup-view-model-v2'
    ].join(',') + '{display:none!important}';

    function style() {
      try {
        if (!document.documentElement) return;
        var s = document.getElementById('nijatva-shorts');
        if (!s) {
          s = document.createElement('style');
          s.id = 'nijatva-shorts';
          s.textContent = CSS;
          document.documentElement.appendChild(s);
        }
      } catch (e) { }
    }

    // one sweep at a time: YouTube mutates constantly and this walks the tree
    var busy = false;
    function sweep() {
      if (busy) return;
      busy = true;
      try {
        var heads = document.querySelectorAll(
          'h2,h3,ytm-shelf-renderer,ytd-rich-section-renderer');
        for (var i = 0; i < heads.length; i++) {
          var text = (heads[i].textContent || '').trim();
          if (text !== 'Shorts' && text.indexOf('Shorts') !== 0) continue;
          var el = heads[i];
          for (var k = 0; k < 7 && el && el.parentElement; k++) {
            el = el.parentElement;
            if (/shelf|reel|section/i.test(el.tagName || '')) {
              el.style.setProperty('display', 'none', 'important');
              break;
            }
          }
        }
      } catch (e) { }
      busy = false;
    }

    style();
    sweep();
    document.addEventListener('DOMContentLoaded', function () { style(); sweep(); });
    try {
      new MutationObserver(sweep).observe(document.documentElement,
        { childList: true, subtree: true });
    } catch (e) { }
    setInterval(sweep, 2500);
  } catch (e) { }
})();

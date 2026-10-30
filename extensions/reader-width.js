/*
 * Nijatva extension: keep article text at a readable width.
 *
 * Full-bleed paragraphs on a wide screen are hard to read - the eye loses the
 * line. This narrows the article column and centres it. Only pages that have an
 * article or a main element are touched.
 */
(function () {
  try {
    if (window.__nijatvaReaderWidth) return;
    window.__nijatvaReaderWidth = 1;
    var CSS = 'article,main{max-width:68ch!important;margin-left:auto!important;margin-right:auto!important}';
    function apply() {
      try {
        if (!document.body) return;
        if (!document.querySelector('article,main')) return;
        var s = document.getElementById('nijatva-reader-width');
        if (!s) {
          s = document.createElement('style');
          s.id = 'nijatva-reader-width';
          s.textContent = CSS;
          document.documentElement.appendChild(s);
        }
      } catch (e) { }
    }
    apply();
    document.addEventListener('DOMContentLoaded', apply);
    try { new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: false }); } catch (e) { }
  } catch (e) { }
})();

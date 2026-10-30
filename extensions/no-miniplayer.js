/* Nijatva extension: stop YouTube's mini player following you down the page. */
(function () {
  try {
    if (window.__nijatvaNoMini) return;
    window.__nijatvaNoMini = 1;
    var CSS = 'ytd-miniplayer,.ytp-miniplayer{display:none!important}';
    function apply() {
      try {
        var s = document.getElementById('nijatva-no-mini');
        if (!s) {
          s = document.createElement('style');
          s.id = 'nijatva-no-mini';
          s.textContent = CSS;
          document.documentElement.appendChild(s);
        }
      } catch (e) { }
    }
    apply();
    document.addEventListener('DOMContentLoaded', apply);
    setInterval(apply, 3000);
  } catch (e) { }
})();

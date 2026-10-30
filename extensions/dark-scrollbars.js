/* Nijatva extension: dark scrollbars, so light pages stop showing a bright bar. */
(function () {
  try {
    if (window.__nijatvaScrollbars) return;
    window.__nijatvaScrollbars = 1;
    var CSS = 'html{scrollbar-color:#4a4f55 #1c1d1f!important}';
    var s = document.getElementById('nijatva-scrollbars');
    if (!s) {
      s = document.createElement('style');
      s.id = 'nijatva-scrollbars';
      s.textContent = CSS;
      document.documentElement.appendChild(s);
    }
  } catch (e) { }
})();

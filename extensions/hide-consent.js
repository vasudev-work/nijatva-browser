/*
 * Nijatva extension: hide the cookie banner after it has been dealt with.
 *
 * Only known consent containers are matched, and only when they sit on top of
 * the page as a fixed overlay - so a site that uses the same class name for real
 * content is left alone.
 */
(function () {
  try {
    if (window.__nijatvaHideConsent) return;
    window.__nijatvaHideConsent = 1;
    var SEL = ['#onetrust-banner-sdk', '#onetrust-consent-sdk', '.cc-window', '#cookie-banner',
               '.cookie-consent', '#cookieConsent', '.qc-cmp2-container', '#gdpr-banner',
               '[id*="consent-banner"]', '[class*="cookie-notice"]'].join(',');
    function sweep() {
      try {
        var list = document.querySelectorAll(SEL);
        for (var i = 0; i < list.length; i++) {
          var el = list[i];
          var pos = getComputedStyle(el).position;
          if (pos === 'fixed' || pos === 'sticky') el.style.setProperty('display', 'none', 'important');
        }
      } catch (e) { }
    }
    sweep();
    document.addEventListener('DOMContentLoaded', sweep);
    setInterval(sweep, 3000);
  } catch (e) { }
})();

/*
 * Nijatva extension: hide the recommendation column and comments on YouTube.
 *
 * A watch page exists to play one video. Everything to the right of it, and the
 * comment thread under it, is there to keep you there. This removes both, and
 * leaves the player, the title, the channel row, the description and the
 * playlist panel alone - those are part of watching.
 *
 * Deliberately CSS-only and selector-exact: no sweeping, no "hide anything that
 * looks like a card", so a YouTube layout change makes the script do nothing
 * rather than hide something real.
 *
 * Pattern: *youtube.com*  (never needs to run anywhere else)
 */
(function () {
  try {
    if (window.__nijatvaUnhookYouTube) return; // never run twice
    window.__nijatvaUnhookYouTube = 1;

    var CSS =
      // right-hand "Up next" column (desktop) - #related, not #secondary,
      // because #secondary also holds the live chat panel
      '#related,' +
      'ytd-watch-next-secondary-results-renderer,' +
      // the comments section
      '#comments,' +
      'ytd-comments#comments,' +
      // mobile web
      'ytm-watch #related,' +
      'ytm-comments-entry-point-header-renderer' +
      '{display:none!important}';

    function apply() {
      try {
        if (!document.body) return;
        var s = document.getElementById('nijatva-unhook-youtube');
        if (!s) {
          s = document.createElement('style');
          s.id = 'nijatva-unhook-youtube';
          s.textContent = CSS;
          document.documentElement.appendChild(s);
        }
      } catch (e) {}
    }

    apply();
    document.addEventListener('DOMContentLoaded', apply);

    // YouTube is a single-page app: the watch page can be replaced without a
    // reload, so put the style block back if the page throws it away.
    try {
      new MutationObserver(function () {
        try {
          if (!document.getElementById('nijatva-unhook-youtube')) apply();
        } catch (e) {}
      }).observe(document.documentElement, {childList: true, subtree: false});
    } catch (e) {}
  } catch (e) {}
})();

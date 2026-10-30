/*
 * Nijatva extension: bring back right-click, text selection and copy.
 *
 * Some sites block the context menu, kill text selection, or answer every copy
 * with "please subscribe". They do it with event handlers, and a handler is all
 * it is - the browser's own behaviour is still there underneath.
 *
 * So this script does not fake anything: it stops the page's handlers from
 * seeing the event (capture phase on document) and leaves the browser's default
 * action alone. Right-click opens the real menu, selection works, Ctrl+C copies.
 * Nothing is prevented, so nothing on the page can be "un-broken" by us.
 *
 * The CSS is the other half: sites that set user-select:none on a wrapper keep
 * text unselectable no matter what the handlers do.
 *
 * Pattern: *  (any site can decide to block copying, so this must run
 *              everywhere; it costs one style block and five listeners)
 */
(function () {
  try {
    if (window.__nijatvaRightClick) return; // never run twice
    window.__nijatvaRightClick = 1;

    var CSS =
      'html,body,body *{' +
      '-webkit-user-select:text!important;' +
      '-moz-user-select:text!important;' +
      'user-select:text!important;' +
      '-webkit-touch-callout:default!important;' +
      '}';

    // Events a site uses to block copying. We never preventDefault, we only
    // keep the page's listeners from running.
    // Deliberately not 'mousedown': plenty of real widgets (sliders, canvas
    // apps, custom dropdowns) depend on it, and silencing it would break them
    // on every page. A site that blocks right-click from onmousedown is rare;
    // oncontextmenu is the common case and is covered.
    var BLOCKED = ['contextmenu', 'selectstart', 'copy', 'cut'];

    var sweepTimer = null;

    function injectCss() {
      try {
        if (document.getElementById('nijatva-right-click')) return;
        var s = document.createElement('style');
        s.id = 'nijatva-right-click';
        s.textContent = CSS;
        (document.head || document.documentElement).appendChild(s);
      } catch (e) {}
    }

    function stop(ev) {
      try {
        // stopImmediatePropagation, not preventDefault: the page's handler is
        // silenced, the browser still shows the menu / copies / selects.
        ev.stopImmediatePropagation();
      } catch (e) {}
    }

    // Sites also use HTML attributes: unselectable="on", and inline
    // oncontextmenu="return false". The listener above already beats the inline
    // handler; the attribute needs removing.
    function sweep() {
      try {
        var els = document.querySelectorAll('[unselectable]');
        for (var i = 0; i < els.length; i++) {
          els[i].removeAttribute('unselectable');
        }
      } catch (e) {}
    }

    function soon() {
      try {
        if (sweepTimer) return;
        sweepTimer = setTimeout(function () {
          sweepTimer = null;
          sweep();
        }, 600);
      } catch (e) {}
    }

    function bind() {
      try {
        for (var i = 0; i < BLOCKED.length; i++) {
          document.addEventListener(BLOCKED[i], stop, true);
        }
      } catch (e) {}
    }

    function start() {
      try {
        injectCss();
        bind();
        sweep();
        document.addEventListener('DOMContentLoaded', function () {
          injectCss();
          sweep();
        });
        try {
          new MutationObserver(soon).observe(document.documentElement, {
            childList: true,
            subtree: true
          });
        } catch (e) {}
      } catch (e) {}
    }

    start();
  } catch (e) {}
})();

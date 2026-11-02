/*
 * Chrome mask
 * -----------
 * Some sites refuse to serve anything that looks like a WebView. The user agent
 * already goes out without the "wv" marker, but a page can also read the browser
 * identity from JavaScript - navigator.vendor, the global chrome object, and the
 * Client Hints in navigator.userAgentData. This fills those in so the checks pass.
 *
 * What this cannot do: the sec-ch-ua request HEADERS. Those are written by the
 * network stack before any page script runs, and a page script has no way to add
 * a request header. Sites that check only the headers will still see a WebView.
 */
(function () {
  'use strict';
  if (window.__nijatvaChromeMask) return;
  window.__nijatvaChromeMask = 1;

  var ua = (navigator && navigator.userAgent) || '';
  // what the native side already sends, minus the leftovers a WebView leaves
  var clean = ua
    .replace(/;\s*wv/g, '')
    .replace(/\swv/g, '')
    .replace(/Version\/[\d.]+ /g, '');

  function set(obj, prop, value) {
    try {
      Object.defineProperty(obj, prop, { get: function () { return value; }, configurable: true });
    } catch (e) { }
  }

  set(navigator, 'userAgent', clean);
  set(navigator, 'vendor', 'Google Inc.');
  set(navigator, 'vendorSub', '');
  set(navigator, 'productSub', '20030107');

  if (!window.chrome) {
    window.chrome = {
      app: { isInstalled: false, InstallState: {}, RunningState: {} },
      runtime: {},
      csi: function () { },
      loadTimes: function () { }
    };
  }

  var major = (clean.match(/Chrome\/(\d+)/) || [])[1] || '120';
  var mobile = /Mobile/.test(clean);

  try {
    Object.defineProperty(navigator, 'userAgentData', {
      configurable: true,
      get: function () {
        return {
          brands: [
            { brand: 'Chromium', version: major },
            { brand: 'Google Chrome', version: major },
            { brand: 'Not=A?Brand', version: '99' }
          ],
          mobile: mobile,
          platform: 'Android',
          getHighEntropyValues: function () {
            return Promise.resolve({
              architecture: '', bitness: '', model: '', platform: 'Android',
              platformVersion: '14.0.0', uaFullVersion: major + '.0.0.0',
              fullVersionList: [{ brand: 'Chromium', version: major + '.0.0.0' }],
              wow64: false
            });
          },
          toJSON: function () {
            return { brands: this.brands, mobile: this.mobile, platform: this.platform };
          }
        };
      }
    });
  } catch (e) { }
})();

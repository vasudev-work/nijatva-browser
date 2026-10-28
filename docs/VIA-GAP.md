# Nijatva vs Via Browser — what is left to add

The three screenshots that came in are Via Browser's settings, read off screen by
screen. Lined up against Nijatva's own source, this is what the comparison
actually says: where Nijatva is already ahead, what Via has that Nijatva does
not, and which of those are worth building.

---

## Where Nijatva is already ahead of Via

| Area | Nijatva | Via |
|---|---|---|
| Ad filtering | ~133,000 network rules + ~25,000 cosmetic rules (EasyList, EasyPrivacy, uBlock, AdGuard, StevenBlack, 1Hosts), per-site allowlist, counters | one built-in list plus subscriptions |
| Element blocking | tap-to-block picker, selectors stored per host | "mark as ad" |
| Userscripts | full manager, `@match`/`@run-at` parsing, and a **GM_ bridge** (`GM_setValue`, `GM_xmlhttpRequest`, …) | plain userscript manager |
| Containers | named, colour-coded, per-container tabs and **per-container user agent** | none |
| Downloads | four-part parallel downloader with pause and resume | system download manager |
| Media | sniffer, background playback service, keep-alive | resource sniffer only |
| Fingerprinting | canvas, WebGL, audio, hardwareConcurrency noise + WebRTC block | WebRTC block only |
| Reading | reader mode, read-aloud with a sleep timer, AI summary | reader mode |
| Languages | 22 | 13+ |
| Theming | 4 themes, AMOLED layer, Material You, screen filter | night mode |

So the honest summary is: **Nijatva is ahead on privacy and power features, and
behind on the small everyday conveniences.**

---

## What Via has that Nijatva does not

### Added in this build

| Feature | What it does |
|---|---|
| **Set as default browser** | An `http`/`https` `VIEW` filter plus `WEB_SEARCH`, and the app now opens a link handed over by another app instead of ignoring it. Before this, Nijatva could not be chosen as the default browser at all. |
| **Undo after closing a tab** | A short "Tab closed — Undo" bar; Undo reopens it. Toggle in Toolbar settings. |
| **Title instead of URL** | The address bar can show the page title rather than the address. Toggle in Toolbar settings. |

### Worth doing next, in this order

| # | Feature | Effort | Why it is worth it |
|---|---|---|---|
| 1 | **Customisable menu and context menu** | medium | Via's single best idea: every user wants a different five items. Nijatva's overflow menu is fixed. Needs a stored list of enabled items plus a reorder screen. |
| 2 | **Filter subscriptions** | medium | Paste an Adblock-style list URL, Nijatva fetches it, merges it into the engine and refreshes it on a schedule. Turns the fixed rule set into a living one. |
| 3 | **Search suggestions from your own data** | medium | Suggestions today come from the search engine. Via also offers favourites, bookmarks, open tabs and history — which is what people actually type. |
| 4 | **Video gestures** | medium | Drag to seek, drag the left edge for brightness, the right edge for volume, in fullscreen. Fiddly but it is the feature people notice most in a phone browser. |
| 5 | **Custom fonts** | small | Let the user add a TTF and apply it to pages via injected `@font-face`. Via has exactly this. |
| 6 | **Auto-hide toolbars** | small | Hide the bar while scrolling down, bring it back on scroll up. |
| 7 | **Go back without reloading** | small | Restore the previous page from cache instead of re-requesting it. |
| 8 | **External video player** | small | Share a sniffed media URL to another app. Half of it exists already in the media sheet. |
| 9 | **Custom reader CSS** | small | A text box of CSS applied inside reader mode. |
| 10 | **Update all scripts** | small | One button in Extensions that re-fetches every script from its source. |

### Deliberately not doing

| Feature | Why not |
|---|---|
| **Cloud sync** | Nijatva's whole claim is that nothing leaves the device. Local export/import already covers moving to a new phone. |
| **Do Not Track header** | WebView has no API to add request headers. Sending the header would mean proxying every request ourselves, which is worse than not sending it. |
| **Password CSV import/export** | There is nothing to export. Nijatva deliberately keeps no password store — it leans on Android's autofill, which already holds the credentials. Adding a second store would be a security downgrade. |
| **"Disable safe browsing"** | It exists, as the inverse: Safe Browsing is a switch you can turn on. |
| **Disable Custom Tabs / predictive back** | Both are manifest-level behaviours, not per-user settings worth a screen. |
| **Sync, Telegram, "join the group"** | Nijatva has no account, no group and no telemetry to talk about. |

---

## The one thing worth saying plainly

Via's feature list is long because Via has been shipping for years and says yes to
almost everything. Nijatva's advantage is not a longer list — it is that the list
it has is deeper: the filter engine, the userscript bridge and the container model
are each bigger than their Via counterparts.

The next three items above (customisable menus, filter subscriptions, suggestions
from your own data) would close the gap that users actually feel day to day.

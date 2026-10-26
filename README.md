# Nijatva Browser

A privacy-first Android browser built on the system WebView.

**Containers** · **Tracker and ad blocking** · **Reader mode** · **Native text-to-speech**

No Google Play Services. No account. No telemetry. History, bookmarks, passwords, containers and filters live in your device's own storage.

Part of the Nijatva suite by **DEVIRA**. The repository currently lives under the
`vasudev-work` account and moves to the `nijatva` organisation once that is created.

---

## The four headline features

### Containers

Named, colour-coded groups of tabs that you switch between instead of juggling a single pile. Each container keeps its own tab set and can carry its own user agent, so a work container can default to desktop mode while a shopping container stays mobile. Create, rename, recolour and delete them from the container sheet.

- `Container.kt` — the model: id, name, colour, optional user agent
- `ContainerStore.kt` — containers and per-container tab state in local storage
- `MainActivity` — container switcher, colour-coded tab strip, per-container UA picker

**Not done yet:** cookie and storage isolation between containers. All containers currently share one `CookieManager`, so a site logged in inside one container is also logged in inside another. Real isolation needs a separate cookie store and WebView data directory per container — it is the first item on the roadmap, and until it lands, treat containers as tab groups rather than as privacy boundaries. Saying so is more useful than implying a guarantee the code does not yet make.

### Tracker and ad blocking

Filtering happens on the device, from lists shipped inside the APK. No request goes to a filtering service and no third party sees what you browse.

- `AdFilterEngine.kt` — network and cosmetic rule engine, host and substring matching, per-site allow list, blocked counters
- `assets/easylist_net.txt.gz`, `assets/easylist_cosmetic.txt.gz` — EasyList network and cosmetic rules, loaded from the APK
- `assets/trackers.txt`, `assets/ads.txt` — tracker and ad host lists
- `ElementBlocks.kt` — element picker and per-site element overrides
- `ShieldsActivity.kt` — per-site shield state, counts and allow list
- `UrlCleaner.kt` — strips tracking parameters from a link before it loads
- `PrivacyActivity.kt` — third-party cookie and storage controls

### Reader mode

One tap extracts the article and rewrites the page into a clean reading surface: the best candidate container is picked by scoring text length against link density, then navigation, asides, footers, forms, iframes and buttons are stripped out.

- Injected from `MainActivity` (`READER_JS`), settings in `ReadingActivity.kt`
- Own typography — serif body, 760px column, 1.75 line height
- Light, sepia and dark themes; A− / A+ font size from 13 to 28px
- Optional **bionic text**, which bolds the leading 40% of every word
- Optional **vertical writing mode** for CJK text
- `ReadingListActivity.kt` — saved articles, stored locally
- `UserStyleStore.kt`, `UserStylesActivity.kt` — your own CSS, per site

Because the page is rewritten in place, reader mode is a one-way trip: *Close* reloads the original. There is no Shadow-DOM overlay yet, so a site that breaks under reader mode is fixed by reloading, not by toggling back.

### Native text-to-speech

Reads the page aloud through Android's own TTS engine. No cloud voice, no audio leaving the device.

- `TtsReader.kt` — sentence-by-sentence queue with a progress callback the UI uses to highlight the current sentence
- Speech rate and pitch controls, persisted per install
- Pronunciation dictionary you can edit yourself
- Sleep timer that fades out rather than cutting off
- Pauses on unplugging headphones and on low battery; optionally keeps the screen on
- Lists installed TTS engines in diagnostics, and says so plainly when a device has none instead of failing silently

## Everything else it already does

Tab management and tab groups, bookmarks, history with its own retention settings, downloads through a foreground service, find in page, desktop mode, per-site permissions, autofill, saved passwords behind biometrics, site profiles (trusted / standard / restricted), URL filters, a readable network log, local backup and restore to JSON, homepage and new-tab-page configuration, search engine selection, extensions, and six themes including AMOLED.

## Build

Requires JDK 17 and Android SDK 35.

```bash
git clone https://github.com/vasudev-work/nijatva-browser.git
cd nijatva-browser
./gradlew assembleDebug
```

The APK lands in `app/build/outputs/apk/debug/`. If `gradlew` is missing from your checkout, run `gradle wrapper` once or open the folder in Android Studio, which generates it.

Release builds need a signing key. Keep it out of the repository — a local `keystore.properties`, or CI secrets. Never commit a `.jks`.

## Dependencies

```
androidx.core:core-ktx
androidx.appcompat:appcompat
androidx.activity:activity-ktx
androidx.webkit:webkit
com.google.android.material:material
```

That is the entire list. No `com.google.android.gms`, no Firebase, no Play Services, no analytics SDK, no ad SDK. The CI workflow fails the build if any of those appear on the release classpath.

## Permissions and why

| Permission | Why |
|---|---|
| `INTERNET`, `ACCESS_NETWORK_STATE` | Loading web pages |
| `USE_BIOMETRIC`, `USE_FINGERPRINT` | Unlocking saved passwords |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `WAKE_LOCK` | Audio and video that keeps playing when you leave the app |
| `POST_NOTIFICATIONS` | Playback controls and download progress |

No storage permission, no contacts, no location, no camera, no microphone. Downloads go through the system `DownloadManager` and the Storage Access Framework.

## Running on a de-Googled phone or BharOS

The app targets AOSP APIs only, so it runs on Android, on GrapheneOS-style ROMs and on BharOS, none of which ship Google Play Services. Two things to know:

- **A WebView provider must exist.** AOSP builds ship one (GrapheneOS uses Vanadium). On a ROM with no WebView provider at all the browser cannot render — that is a platform gap, not an app bug.
- **Downloads** use the system `DownloadManager`. It is part of AOSP so it works, but the system UI looks different from a Google build.

## Layout

```
app/src/main/
  java/in/nijatva/browser/             browser source, 61 Kotlin files
  java/in/nijatva/browser/appstore/    settings UI scaffolding
  assets/                              filter lists, new tab page, QR generator
  res/                                 themes, strings, icons, layouts
docs/                                  feature list, integration notes, roadmap, UI audit
```

## Status

The source is complete and builds as an APK, but it has not been through a release cycle under the Nijatva name, and the container isolation gap above is real. `docs/FEATURE-LIST.md` has the full inventory, `docs/ROADMAP.md` has what comes next.

## Licence

Published for reading and for the Nijatva suite. A formal licence file will be added before the first public release — until then, all rights reserved.

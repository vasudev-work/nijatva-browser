import javafx.application.Application
import javafx.application.Platform
import javafx.concurrent.Worker
import javafx.geometry.Insets
import javafx.geometry.Pos
import javafx.scene.Scene
import javafx.scene.control.*
import javafx.scene.layout.*
import javafx.scene.web.WebEngine
import javafx.scene.web.WebView
import javafx.stage.Stage

/**
 * Nijatva for the desktop.
 *
 * The Android build runs on WebView; this one runs on JavaFX's WebKit engine, so
 * chrome.* extensions do not work here either. What does work is what works
 * there: userscripts from the same store, checked against the same sha256, plus
 * tabs, bookmarks and history kept in plain files.
 */
class Browser : Application() {

    private val tabs = TabPane()
    private val url = TextField()
    private val status = Label("")
    private var adBlock = false

    /** Common ad containers, hidden by a stylesheet rather than by blocking. */
    private val cosmetic = """
(function(){
  if (window.__nijatvaAds) return; window.__nijatvaAds = 1;
  var css = [
    'ins.adsbygoogle','iframe[src*="doubleclick"]','div[id^="google_ads"]','div[class*="ad-slot"]',
    'div[class*="advert"]','div[aria-label="Advertisement"]','[id^="taboola"]','[class*="sponsored"]'
  ].join(',') + '{display:none !important}';
  var s = document.createElement('style'); s.textContent = css;
  document.documentElement.appendChild(s);
})();
""".trimIndent()

    private fun engine(): WebEngine? = (tabs.selectionModel.selectedItem?.content as? WebView)?.engine

    override fun start(stage: Stage) {
        tabs.tabClosingPolicy = TabPane.TabClosingPolicy.ALL_TABS
        val first = newTab("https://vasudev-work.github.io/nijatva-web-store/")
        tabs.tabs.add(first)
        tabs.selectionModel.select(first)

        val back = tool("\u2190") { engine()?.executeScript("history.back()") }
        val forward = tool("\u2192") { engine()?.executeScript("history.forward()") }
        val reload = tool("\u21bb") { engine()?.reload() }
        val plus = tool("+") { tabs.tabs.add(newTab("about:blank")); tabs.selectionModel.selectLast() }
        val scripts = tool("\u2699") { scriptsDialog() }.apply { tooltip = Tooltip("Scripts") }
        val block = tool("\u2298") { adBlock = !adBlock; paint(); engine()?.reload() }
            .apply { tooltip = Tooltip("Hide ad boxes") }
        val menu = MenuButton("\u22ee").apply {
            style = "-fx-background-color: #35363a; -fx-text-fill: #e8eaed; -fx-background-radius: 8;"
            items.addAll(
                MenuItem("Bookmark this page").apply { setOnAction { bookmarkHere() } },
                MenuItem("Bookmarks…").apply { setOnAction { bookmarksDialog() } },
                MenuItem("History…").apply { setOnAction { historyDialog() } },
                SeparatorMenuItem(),
                MenuItem("Clear history").apply { setOnAction { Store.clearHistory() } }
            )
        }

        url.setOnAction { go(url.text) }
        HBox.setHgrow(url, Priority.ALWAYS)
        url.style = "-fx-background-color: #35363a; -fx-text-fill: #e8eaed; -fx-background-radius: 18; -fx-padding: 8 16;"

        val bar = HBox(8.0, back, forward, reload, url, block, scripts, menu, plus)
        bar.alignment = Pos.CENTER_LEFT
        bar.padding = Insets(8.0)
        bar.style = "-fx-background-color: #202124;"

        status.style = "-fx-text-fill: #9aa0a6; -fx-padding: 4 12; -fx-background-color: #202124;"

        val root = BorderPane()
        root.top = bar
        root.center = tabs
        root.bottom = status
        stage.scene = Scene(root, 1280.0, 840.0)
        stage.show()
        paint()
    }

    private fun tool(label: String, onTap: () -> Unit): Button {
        val b = Button(label)
        b.style = "-fx-background-color: #35363a; -fx-text-fill: #e8eaed; -fx-background-radius: 8; -fx-min-width: 40; -fx-min-height: 36;"
        b.setOnAction { onTap() }
        return b
    }

    private fun paint() {
        // a small dot on the block button says whether it is on
        status.text = (if (adBlock) "Hiding ad boxes · " else "") +
            (engine()?.let { e -> Scripts.load().count { it.enabled && Scripts.matches(it.pattern, e.location ?: "") } }
                ?.let { if (it == 0) "No scripts on this page" else "$it script" + (if (it == 1) "" else "s") + " on this page" }
                ?: "")
    }

    private fun newTab(start: String): Tab {
        val view = WebView()
        val e = view.engine
        e.userAgent = e.userAgent.replace("; wv", "")
        val tab = Tab("New tab", view)
        tab.userData = view

        e.locationProperty().addListener { _, _, loc ->
            if (tabs.selectionModel.selectedItem === tab && !loc.isNullOrBlank()) Platform.runLater { url.text = loc }
        }
        e.titleProperty().addListener { _, _, t ->
            if (!t.isNullOrBlank()) tab.text = if (t.length > 22) t.take(22) + "…" else t
        }
        e.loadWorker.stateProperty().addListener { _, _, s ->
            if (s == Worker.State.SUCCEEDED) {
                val loc = e.location ?: return@addListener
                Store.record(e.title ?: "", loc)
                if (adBlock) runCatching { e.executeScript(cosmetic) }
                for (sc in Scripts.load()) {
                    if (sc.enabled && Scripts.matches(sc.pattern, loc)) {
                        runCatching { e.executeScript(sc.code) }
                    }
                }
                if (tabs.selectionModel.selectedItem === tab) paint()
            }
        }
        if (start != "about:blank") e.load(start)
        return tab
    }

    private fun go(input: String?) {
        val u = (input ?: "").trim()
        if (u.isEmpty()) return
        engine()?.load(
            when {
                u.startsWith("http://") || u.startsWith("https://") || u.startsWith("file:") -> u
                u.contains(' ') || !u.contains('.') ->
                    "https://duckduckgo.com/?q=" + java.net.URLEncoder.encode(u, "UTF-8")
                else -> "https://$u"
            }
        )
    }

    // -------------------------------------------------------------- bookmarks
    private fun bookmarkHere() {
        val e = engine() ?: return
        val loc = e.location ?: return
        Store.addBookmark(e.title ?: loc, loc)
        Alert(Alert.AlertType.INFORMATION, "Saved: " + (e.title ?: loc)).show()
    }

    private fun bookmarksDialog() {
        val list = listBox()
        val rows = Store.bookmarks()
        if (rows.isEmpty()) list.children.add(hint("No bookmarks yet. Use the menu to save this page."))
        for ((title, link) in rows) {
            list.children.add(row(title, link, "Open", { engine()?.load(link) }, "Remove", { Store.removeBookmark(link) }))
        }
        sheet("Bookmarks", list)
    }

    // ---------------------------------------------------------------- history
    private fun historyDialog() {
        val list = listBox()
        val rows = Store.history()
        if (rows.isEmpty()) list.children.add(hint("Nothing here yet."))
        var day = ""
        for ((title, link, ts) in rows) {
            val d = Store.dayOf(ts)
            if (d != day) {
                day = d
                list.children.add(Label(d).apply {
                    style = "-fx-text-fill: #9aa0a6; -fx-padding: 10 0 2 2; -fx-font-weight: bold;"
                })
            }
            list.children.add(row(title, Store.timeOf(ts) + "  ·  " + link, "Open", { engine()?.load(link) }, null, {}))
        }
        sheet("History", list)
    }

    // ---------------------------------------------------------------- scripts
    private fun scriptsDialog() {
        val list = listBox()
        fun paint() {
            list.children.clear()
            val have = Scripts.load()
            if (have.isNotEmpty()) {
                list.children.add(hint("Installed"))
                for (s in have) {
                    list.children.add(row(s.name, s.pattern, "Remove", { Scripts.remove(s.id); paint() }, null, {}))
                }
            }
            list.children.add(hint("From the store"))
            val loading = hint("Loading the catalogue…")
            list.children.add(loading)
            Thread {
                val cat = Scripts.catalogue()
                Platform.runLater {
                    list.children.remove(loading)
                    if (cat.isEmpty()) {
                        list.children.add(hint("Could not reach the store"))
                    } else {
                        val ids = Scripts.load().map { it.id }.toHashSet()
                        for (e in cat) {
                            if (ids.contains(e.id)) continue
                            list.children.add(row(
                                e.name + if (e.version.isBlank()) "" else "  " + e.version,
                                (if (e.category.isBlank()) e.pattern else e.category + " · " + e.pattern),
                                "Install", {
                                    val err = Scripts.install(e)
                                    if (err != null) Alert(Alert.AlertType.WARNING, err).show()
                                    paint()
                                }, null, {}))
                        }
                    }
                }
            }.start()
        }
        paint()

        val fromLink = Button("Install from a link…")
        fromLink.style = "-fx-background-color: #35363a; -fx-text-fill: #e8eaed; -fx-background-radius: 14;"
        fromLink.setOnAction {
            val t = TextInputDialog("https://greasyfork.org/scripts/12345.user.js")
            t.title = "Install from a link"
            t.headerText = "The address of a .user.js file"
            t.showAndWait().ifPresent { link ->
                val err = Scripts.installFromUrl(link.trim())
                if (err != null) Alert(Alert.AlertType.WARNING, err).show()
                paint()
            }
        }

        val dlg = Dialog<Unit>()
        dlg.title = "Scripts"
        dlg.dialogPane.content = VBox(10.0, scroll(list), fromLink)
        dlg.dialogPane.buttonTypes.add(ButtonType.CLOSE)
        dlg.showAndWait()
        engine()?.reload()
    }

    // ------------------------------------------------------------------ bits
    private fun listBox() = VBox(6.0).apply { padding = Insets(4.0) }

    private fun scroll(list: VBox): ScrollPane = ScrollPane(list).apply {
        isFitToWidth = true
        prefHeight = 420.0
        style = "-fx-background: #202124; -fx-background-color: #202124;"
    }

    private fun hint(text: String) = Label(text).apply {
        style = "-fx-text-fill: #9aa0a6; -fx-font-size: 11.5; -fx-padding: 6 0 0 2;"
    }

    private fun row(name: String, sub: String, action: String, onTap: () -> Unit,
                    action2: String?, onTap2: () -> Unit): HBox {
        val line = HBox(10.0)
        line.alignment = Pos.CENTER_LEFT
        line.style = "-fx-background-color: #292a2d; -fx-background-radius: 10; -fx-padding: 10;"
        val col = VBox(2.0)
        val n = Label(name); n.style = "-fx-text-fill: #e8eaed; -fx-font-weight: bold;"
        val d = Label(sub); d.style = "-fx-text-fill: #9aa0a6; -fx-font-size: 11.5;"
        d.isWrapText = true
        col.children.addAll(n, d)
        HBox.setHgrow(col, Priority.ALWAYS)
        val b1 = Button(action).apply {
            style = "-fx-background-color: #1a73e8; -fx-text-fill: white; -fx-background-radius: 14;"
            setOnAction { onTap() }
        }
        line.children.addAll(col, b1)
        if (action2 != null) {
            val b2 = Button(action2).apply {
                style = "-fx-background-color: #35363a; -fx-text-fill: #e8eaed; -fx-background-radius: 14;"
                setOnAction { onTap2() }
            }
            line.children.add(b2)
        }
        return line
    }

    private fun sheet(title: String, list: VBox) {
        val dlg = Dialog<Unit>()
        dlg.title = title
        dlg.dialogPane.content = scroll(list)
        dlg.dialogPane.buttonTypes.add(ButtonType.CLOSE)
        dlg.showAndWait()
    }
}

fun main() = Application.launch(Browser::class.java)

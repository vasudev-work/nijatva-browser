import javafx.application.Application
import javafx.application.Platform
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
 * chrome.* extensions do not work here either. What does work is the same thing
 * that works there: userscripts, fetched from the same store, checked against the
 * same sha256, injected into the page.
 */
class Browser : Application() {

    private val view = WebView()
    private val engine: WebEngine get() = view.engine
    private val url = TextField()
    private val status = Label("")

    override fun start(stage: Stage) {
        engine.userAgent = engine.userAgent.replace("; wv", "")
        engine.locationProperty().addListener { _, _, new ->
            if (!new.isNullOrBlank()) Platform.runLater { url.text = new }
        }
        engine.titleProperty().addListener { _, _, t ->
            stage.title = if (t.isNullOrBlank()) "Nijatva" else "$t - Nijatva"
        }
        engine.loadWorker.stateProperty().addListener { _, _, s ->
            if (s == javafx.concurrent.Worker.State.SUCCEEDED) inject()
        }

        val back = tool("\u2190") { engine.executeScript("history.back()") }
        val forward = tool("\u2192") { engine.executeScript("history.forward()") }
        val reload = tool("\u21bb") { engine.reload() }
        val scripts = tool("\u2699") { scriptsDialog() }
        scripts.tooltip = Tooltip("Scripts")

        url.setOnAction { go(url.text) }
        HBox.setHgrow(url, Priority.ALWAYS)
        url.style = "-fx-background-color: #35363a; -fx-text-fill: #e8eaed; -fx-background-radius: 18; -fx-padding: 8 16;"

        val bar = HBox(8.0, back, forward, reload, url, scripts)
        bar.alignment = Pos.CENTER_LEFT
        bar.padding = Insets(8.0)
        bar.style = "-fx-background-color: #202124;"

        status.style = "-fx-text-fill: #9aa0a6; -fx-padding: 4 12; -fx-background-color: #202124;"

        val root = BorderPane()
        root.top = bar
        root.center = view
        root.bottom = status
        stage.scene = Scene(root, 1280.0, 840.0)
        stage.show()

        engine.load("https://vasudev-work.github.io/nijatva-web-store/")
    }

    private fun tool(label: String, onTap: () -> Unit): Button {
        val b = Button(label)
        b.style = "-fx-background-color: #35363a; -fx-text-fill: #e8eaed; -fx-background-radius: 8; -fx-min-width: 40; -fx-min-height: 36;"
        b.setOnAction { onTap() }
        return b
    }

    private fun go(input: String?) {
        val u = (input ?: "").trim()
        if (u.isEmpty()) return
        engine.load(
            when {
                u.startsWith("http://") || u.startsWith("https://") || u.startsWith("file:") -> u
                u.contains(' ') || !u.contains('.') ->
                    "https://duckduckgo.com/?q=" + java.net.URLEncoder.encode(u, "UTF-8")
                else -> "https://$u"
            }
        )
    }

    /** Every enabled script whose pattern matches this address. */
    private fun inject() {
        val here = engine.location ?: return
        val all = Scripts.load()
        var ran = 0
        for (s in all) {
            if (!s.enabled || !Scripts.matches(s.pattern, here)) continue
            try {
                engine.executeScript(s.code)
                ran++
            } catch (e: Exception) {
                println("script ${s.name} failed: ${e.message}")
            }
        }
        status.text = if (ran == 0) "No scripts on this page"
                      else "$ran script" + (if (ran == 1) "" else "s") + " on this page"
    }

    // ---------------------------------------------------------------- scripts
    private fun scriptsDialog() {
        val dlg = Dialog<Unit>()
        dlg.title = "Scripts"
        dlg.dialogPane.style = "-fx-background-color: #202124;"

        val installed = Scripts.load()
        val list = VBox(6.0)
        val scroller = ScrollPane(list)
        scroller.isFitToWidth = true
        scroller.prefHeight = 420.0
        scroller.style = "-fx-background: #202124; -fx-background-color: #202124;"

        fun row(name: String, sub: String, action: String, onTap: () -> Unit) {
            val line = HBox(10.0)
            line.alignment = Pos.CENTER_LEFT
            line.style = "-fx-background-color: #292a2d; -fx-background-radius: 10; -fx-padding: 10;"
            val col = VBox(2.0)
            val n = Label(name); n.style = "-fx-text-fill: #e8eaed; -fx-font-weight: bold;"
            val d = Label(sub); d.style = "-fx-text-fill: #9aa0a6; -fx-font-size: 11.5;"
            d.isWrapText = true
            col.children.addAll(n, d)
            HBox.setHgrow(col, Priority.ALWAYS)
            val btn = Button(action)
            btn.style = "-fx-background-color: #1a73e8; -fx-text-fill: white; -fx-background-radius: 14;"
            btn.setOnAction { onTap() }
            line.children.addAll(col, btn)
            list.children.add(line)
        }

        fun paint() {
            list.children.clear()
            val have = Scripts.load()
            if (have.isNotEmpty()) {
                list.children.add(Label("Installed").apply { style = "-fx-text-fill: #9aa0a6; -fx-padding: 6 0 0 2;" })
                for (s in have) {
                    row(s.name + if (s.version.isBlank()) "" else "  " + s.version,
                        s.pattern, "Remove") {
                        Scripts.remove(s.id); paint()
                    }
                }
            }
            list.children.add(Label("From the store").apply { style = "-fx-text-fill: #9aa0a6; -fx-padding: 10 0 0 2;" })
            val loading = Label("Loading the catalogue…").apply { style = "-fx-text-fill: #9aa0a6;" }
            list.children.add(loading)

            Thread {
                val cat = Scripts.catalogue()
                Platform.runLater {
                    list.children.remove(loading)
                    if (cat.isEmpty()) {
                        list.children.add(Label("Could not reach the store").apply { style = "-fx-text-fill: #ff8080;" })
                    } else {
                        val ids = Scripts.load().map { it.id }.toHashSet()
                        for (e in cat) {
                            if (ids.contains(e.id)) continue
                            row(e.name + if (e.version.isBlank()) "" else "  " + e.version,
                                (if (e.category.isBlank()) e.pattern else e.category + " · " + e.pattern),
                                "Install") {
                                val err = Scripts.install(e)
                                if (err != null) Alert(Alert.AlertType.WARNING, err).show()
                                paint()
                            }
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

        val box = VBox(10.0, scroller, fromLink)
        dlg.dialogPane.content = box
        dlg.dialogPane.buttonTypes.add(ButtonType.CLOSE)
        dlg.showAndWait()
        engine.reload()
    }
}

fun main() = Application.launch(Browser::class.java)

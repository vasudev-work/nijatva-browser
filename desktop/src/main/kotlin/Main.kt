import javafx.application.Application
import javafx.application.Platform
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
 * The Android build runs on WebView; this one runs on the JavaFX web engine, which
 * is WebKit. It is not Chromium, so chrome.* extensions do not work here either -
 * the same userscripts the phone build runs are what this one runs.
 */
class Browser : Application() {

    private val view = WebView()
    private val engine: WebEngine get() = view.engine
    private val url = TextField()
    private val back = Button("\u2190")
    private val forward = Button("\u2192")
    private val reload = Button("\u21bb")

    override fun start(stage: Stage) {
        engine.userAgent = engine.userAgent.replace("; wv", "")
        engine.locationProperty().addListener { _, _, new ->
            if (new != null && new.isNotBlank()) Platform.runLater { url.text = new }
        }
        engine.titleProperty().addListener { _, _, t ->
            stage.title = if (t.isNullOrBlank()) "Nijatva" else "$t - Nijatva"
        }

        back.setOnAction { engine.executeScript("history.back()") }
        forward.setOnAction { engine.executeScript("history.forward()") }
        reload.setOnAction { engine.reload() }

        url.setOnAction { go(url.text) }
        url.prefWidth = 900.0

        val bar = HBox(8.0, back, forward, reload, url)
        bar.alignment = Pos.CENTER_LEFT
        bar.style = "-fx-padding: 8; -fx-background-color: #202124;"
        for (b in listOf(back, forward, reload)) {
            b.style = "-fx-background-color: #35363a; -fx-text-fill: #e8eaed; -fx-background-radius: 8;"
        }
        url.style = "-fx-background-color: #35363a; -fx-text-fill: #e8eaed; -fx-background-radius: 18; -fx-padding: 8 16;"

        val root = BorderPane()
        root.top = bar
        root.center = view
        stage.scene = Scene(root, 1200.0, 800.0)
        stage.show()

        // the store, because that is the reason this build exists
        engine.load("https://vasudev-work.github.io/nijatva-web-store/")
    }

    private fun go(input: String?) {
        val u = (input ?: "").trim()
        if (u.isEmpty()) return
        engine.load(
            when {
                u.startsWith("http://") || u.startsWith("https://") || u.startsWith("file:") -> u
                u.contains(' ') || !u.contains('.') -> "https://duckduckgo.com/" + java.net.URLEncoder.encode(u, "UTF-8")
                else -> "https://$u"
            }
        )
    }
}

fun main() = Application.launch(Browser::class.java)

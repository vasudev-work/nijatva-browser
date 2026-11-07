import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.reflect.TypeToken
import java.io.File
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.security.MessageDigest

/** One userscript, as this build keeps it. */
data class Script(
    val id: String = "",
    val name: String = "",
    val pattern: String = "*",
    val code: String = "",
    val enabled: Boolean = true,
    val version: String = "",
    val desc: String = ""
)

/** One row of the catalogue, before it is installed. */
data class Entry(
    val id: String = "",
    val name: String = "",
    val desc: String = "",
    val file: String = "",
    val pattern: String = "*",
    val version: String = "",
    val sha256: String = "",
    val category: String = "",
    val featured: Boolean = false
)

data class Catalogue(val schema: Int = 2, val extensions: List<Entry> = emptyList())

/**
 * The scripts this machine has installed, and the catalogue they came from.
 *
 * Kept in a plain file under the user's home, so nothing is hidden: the same
 * store the phone reads, the same sha256 check, the same signed index.
 */
object Scripts {

    const val BASE = "https://vasudev-work.github.io/nijatva-web-store/extensions/"
    private val fallback = "https://raw.githubusercontent.com/vasudev-work/nijatva-web-store/main/extensions/"

    private val gson: Gson = GsonBuilder().setPrettyPrinting().create()
    private val dir = File(System.getProperty("user.home"), ".nijatva")
    private val file = File(dir, "scripts.json")

    private val http: HttpClient = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NORMAL)
        .build()

    fun load(): MutableList<Script> = try {
        if (!file.exists()) mutableListOf()
        else {
            val type = object : TypeToken<MutableList<Script>>() {}.type
            gson.fromJson<MutableList<Script>>(file.readText(), type) ?: mutableListOf()
        }
    } catch (_: Exception) { mutableListOf() }

    fun save(list: List<Script>) {
        try {
            dir.mkdirs()
            file.writeText(gson.toJson(list))
        } catch (_: Exception) { }
    }

    fun get(url: String): String? {
        for (host in listOf(BASE, fallback)) {
            try {
                val req = HttpRequest.newBuilder(URI.create(host + url))
                    .header("User-Agent", "Nijatva desktop")
                    .build()
                val res = http.send(req, HttpResponse.BodyHandlers.ofString())
                if (res.statusCode() == 200) return res.body()
            } catch (_: Exception) { }
        }
        return null
    }

    fun catalogue(): List<Entry> {
        return try {
            val body = get("index.json") ?: return emptyList()
            val c = gson.fromJson(body, Catalogue::class.java)
            c.extensions.sortedBy { it.name.lowercase() }
        } catch (_: Exception) { emptyList() }
    }

    fun install(entry: Entry): String? {
        val code = get(entry.file) ?: return "could not download ${entry.file}"
        if (entry.sha256.isNotBlank()) {
            val got = MessageDigest.getInstance("SHA-256")
                .digest(code.toByteArray(Charsets.UTF_8))
                .joinToString("") { "%02x".format(it) }
            if (got != entry.sha256.lowercase()) return "checksum mismatch - not installed"
        }
        val list = load()
        if (list.any { it.id == entry.id }) return "already installed"
        list.add(Script(entry.id, entry.name, entry.pattern, code, true, entry.version, entry.desc))
        save(list)
        return null
    }

    fun installFromUrl(url: String): String? {
        val code = get(url) ?: return "could not download the script"
        val name = Regex("@name\\s+([^\\n]+)").find(code)?.groupValues?.get(1)?.trim()
            ?: url.substringAfterLast('/')
        val pattern = Regex("@match\\s+([^\\n]+)").find(code)?.groupValues?.get(1)?.trim() ?: "*"
        val id = "web-" + name.lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-')
        val list = load()
        if (list.any { it.id == id }) return "already installed"
        list.add(Script(id, name, pattern, code, true, "", ""))
        save(list)
        return null
    }

    fun remove(id: String) = save(load().filterNot { it.id == id })

    fun setEnabled(id: String, on: Boolean) =
        save(load().map { if (it.id == id) it.copy(enabled = on) else it })

    /** The same wildcard rule the phone build uses: * matches anything. */
    fun matches(pattern: String, url: String): Boolean {
        if (pattern.isBlank() || pattern == "*") return true
        return pattern.split(',').any { part ->
            val p = part.trim()
            if (p.isBlank()) false
            else Regex("^" + Regex.escape(p).replace("\\*", ".*") + "$").matches(url)
        }
    }
}

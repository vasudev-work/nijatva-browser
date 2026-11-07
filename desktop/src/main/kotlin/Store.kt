import java.io.File
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Bookmarks and history, in plain text files under the user's home.
 *
 * No database and no format of our own: one line per entry, the fields separated
 * by a unit separator, so anything can read it and nothing is hidden.
 */
object Store {

    private val dir = File(System.getProperty("user.home"), ".nijatva")
    private val bm = File(dir, "bookmarks.txt")
    private val hist = File(dir, "history.txt")
    private const val SEP = '\u0001'

    private fun read(f: File): List<Triple<String, String, Long>> =
        try {
            if (!f.exists()) emptyList()
            else f.readLines().filter { it.isNotBlank() }.mapNotNull { line ->
                val p = line.split(SEP)
                when (p.size) {
                    2 -> Triple(p[0], p[1], 0L)
                    3 -> Triple(p[0], p[1], p[2].toLongOrNull() ?: 0L)
                    else -> null
                }
            }
        } catch (_: Exception) { emptyList() }

    private fun write(f: File, rows: List<Triple<String, String, Long>>) {
        try {
            dir.mkdirs()
            f.writeText(rows.joinToString("\n") { it.first + SEP + it.second + SEP + it.third })
        } catch (_: Exception) { }
    }

    // ---------------------------------------------------------------- bookmarks
    fun bookmarks(): List<Pair<String, String>> = read(bm).map { it.first to it.second }

    fun addBookmark(title: String, url: String) {
        val now = read(bm)
        if (now.any { it.second == url }) return
        write(bm, now + Triple(if (title.isBlank()) url else title, url, 0L))
    }

    fun removeBookmark(url: String) = write(bm, read(bm).filterNot { it.second == url })

    // ------------------------------------------------------------------ history
    fun history(): List<Triple<String, String, Long>> = read(hist).reversed()

    fun record(title: String, url: String) {
        if (url.isBlank() || url.startsWith("file:") || url.startsWith("about:")) return
        val now = read(hist)
        // the same address twice in a row is noise, not history
        if (now.lastOrNull()?.second == url) return
        write(hist, (now + Triple(if (title.isBlank()) url else title, url, System.currentTimeMillis()))
            .takeLast(5000))
    }

    fun clearHistory() = write(hist, emptyList())

    fun dayOf(ts: Long): String {
        if (ts <= 0L) return "Older"
        val d = java.time.Instant.ofEpochMilli(ts).atZone(java.time.ZoneId.systemDefault()).toLocalDate()
        val today = java.time.LocalDate.now()
        return when (d) {
            today -> "Today - " + d.format(DateTimeFormatter.ofPattern("d MMM yyyy"))
            today.minusDays(1) -> "Yesterday - " + d.format(DateTimeFormatter.ofPattern("d MMM yyyy"))
            else -> d.format(DateTimeFormatter.ofPattern("d MMM yyyy"))
        }
    }

    fun timeOf(ts: Long): String =
        if (ts <= 0L) "" else LocalDateTime.ofInstant(java.time.Instant.ofEpochMilli(ts),
            java.time.ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("HH:mm"))
}

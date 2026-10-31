package `in`.nijatva.browser

import android.graphics.drawable.GradientDrawable
import android.text.Editable
import android.text.TextWatcher
import android.view.ViewGroup
import android.widget.EditText
import android.widget.LinearLayout
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/** History with search, date groups and time-range clearing. */
class HistoryActivity : BaseSettingsActivity() {

    override val titleRes = R.string.s_history

    private var query = ""
    private var added = false

    override fun build(b: SettingsBuilder, content: LinearLayout) {
        addSearch()

        // the reference puts the two things you actually want at the top:
        // a note about where these entries came from, and one way to wipe them
        b.note(getString(R.string.hist_other_apps))
        val top = b.card()
        b.navRow(top, getString(R.string.hist_delete_data), null) {
            try { startActivity(android.content.Intent(this, PrivacyActivity::class.java)) } catch (_: Exception) { }
        }

        val all = parse()
        val filtered = if (query.isBlank()) all
        else all.filter { it.first.contains(query, true) || it.second.contains(query, true) }

        if (filtered.isEmpty()) {
            b.note(getString(R.string.d_empty))
        } else {
            var lastDay = ""
            var card: LinearLayout? = null
            for (item in filtered) {
                val day = dayLabel(item.third)
                if (day != lastDay) {
                    lastDay = day
                    b.section(day)
                    card = b.card()
                }
                val target = card ?: continue
                entryRow(b, target, item.first, item.second) { delete(item.second, item.third) }
            }
        }

        b.section(getString(R.string.hist_clear))
        val c = b.card()
        b.navRow(c, getString(R.string.hist_hour), null) { clearSince(3600000L) }
        b.divider(c)
        b.navRow(c, getString(R.string.hist_day), null) { clearSince(86400000L) }
        b.divider(c)
        b.navRow(c, getString(R.string.hist_week), null) { clearSince(7 * 86400000L) }
        b.divider(c)
        b.navRow(c, getString(R.string.priv_clear_all), null) {
            prefs.edit().remove("history").apply(); rebuild()
        }
        b.note(getString(R.string.hist_note))
    }

    /** The search pill, added once and kept across rebuilds. */
    private fun addSearch() {
        if (added) return
        added = true
        val et = EditText(this)
        et.hint = getString(R.string.hist_search)
        et.isSingleLine = true
        et.setTextColor(attr(R.attr.textPrimaryColor))
        et.setHintTextColor(attr(R.attr.textSecondaryColor))
        val bg = GradientDrawable()
        bg.cornerRadius = dp(22).toFloat()
        bg.setColor(attr(R.attr.surface2Color))
        et.background = bg
        et.setPadding(dp(16), dp(11), dp(16), dp(11))
        et.layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        et.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) {
                val next = s?.toString() ?: ""
                if (next == query) return
                query = next
                rebuild()
            }
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) { }
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) { }
        })
        val box = LinearLayout(this)
        box.setPadding(dp(16), dp(10), dp(16), dp(2))
        box.addView(et)
        addTopView(box)
    }

    /**
     * One entry: a round mark with the site's initial, the title, the host under
     * it, and a cross that removes just this entry - the way the reference does
     * it, in one row rather than two.
     */
    private fun entryRow(b: SettingsBuilder, card: LinearLayout, title: String, url: String, onDelete: () -> Unit) {
        val host = try { android.net.Uri.parse(url).host?.removePrefix("www.") ?: url } catch (_: Exception) { url }
        val label = if (title.isBlank()) host else title

        val row = LinearLayout(this)
        row.orientation = LinearLayout.HORIZONTAL
        row.gravity = android.view.Gravity.CENTER_VERTICAL
        row.setPadding(dp(14), dp(11), dp(6), dp(11))

        val mark = android.widget.TextView(this)
        mark.text = (label.firstOrNull() ?: '?').uppercaseChar().toString()
        mark.setTextColor(0xFFFFFFFF.toInt())
        mark.textSize = 15f
        mark.gravity = android.view.Gravity.CENTER
        mark.setTypeface(null, android.graphics.Typeface.BOLD)
        val bg = GradientDrawable()
        bg.shape = GradientDrawable.OVAL
        bg.setColor(avatarColour(host))
        mark.background = bg
        row.addView(mark, LinearLayout.LayoutParams(dp(34), dp(34)))

        val col = LinearLayout(this)
        col.orientation = LinearLayout.VERTICAL
        val nm = android.widget.TextView(this)
        nm.text = label
        nm.setTextColor(attr(R.attr.textPrimaryColor))
        nm.textSize = 15f
        nm.setTypeface(null, android.graphics.Typeface.BOLD)
        nm.maxLines = 1
        nm.ellipsize = android.text.TextUtils.TruncateAt.END
        val hs = android.widget.TextView(this)
        hs.text = host
        hs.setTextColor(attr(R.attr.textSecondaryColor))
        hs.textSize = 13f
        hs.maxLines = 1
        hs.ellipsize = android.text.TextUtils.TruncateAt.END
        col.addView(nm)
        col.addView(hs)
        val clp = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        clp.leftMargin = dp(13)
        row.addView(col, clp)

        val x = android.widget.TextView(this)
        x.text = "\u2715"
        x.textSize = 15f
        x.gravity = android.view.Gravity.CENTER
        x.setTextColor(attr(R.attr.textSecondaryColor))
        x.setPadding(dp(10), dp(10), dp(10), dp(10))
        x.setOnClickListener { onDelete() }
        row.addView(x, LinearLayout.LayoutParams(dp(42), dp(42)))

        card.addView(row)
        b.divider(card)
    }

    /** A stable colour per host, so the same site keeps the same mark. */
    private fun avatarColour(host: String): Int {
        val palette = intArrayOf(
            0xFF2A9CF0.toInt(), 0xFF0C9054.toInt(), 0xFFE2543A.toInt(), 0xFFC13584.toInt(),
            0xFF7B4BFF.toInt(), 0xFF00A8A2.toInt(), 0xFFF5A623.toInt())
        var h = 0
        for (ch in host) h = (h * 31 + ch.code) and 0x7FFFFFFF
        return palette[h % palette.size]
    }

    private fun parse(): List<Triple<String, String, Long>> {
        val out = ArrayList<Triple<String, String, Long>>()
        for (e in (prefs.getString("history", "") ?: "").split("\n")) {
            if (e.isBlank()) continue
            val p = e.split('\u0001')
            val t = p.getOrElse(0) { "" }
            val u = p.getOrElse(1) { "" }
            if (u.isBlank()) continue
            out.add(Triple(t, u, p.getOrElse(2) { "0" }.toLongOrNull() ?: 0L))
        }
        return out
    }

    private fun dayLabel(ts: Long): String {
        if (ts <= 0L) return getString(R.string.hist_older)
        val now = Calendar.getInstance()
        val then = Calendar.getInstance().apply { timeInMillis = ts }
        val sameYear = now.get(Calendar.YEAR) == then.get(Calendar.YEAR)
        if (sameYear && now.get(Calendar.DAY_OF_YEAR) == then.get(Calendar.DAY_OF_YEAR))
            return getString(R.string.hist_today)
        val y = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, -1) }
        if (sameYear && y.get(Calendar.DAY_OF_YEAR) == then.get(Calendar.DAY_OF_YEAR))
            return getString(R.string.hist_yesterday)
        return SimpleDateFormat("d MMM yyyy", Locale.getDefault()).format(Date(ts))
    }

    private fun delete(url: String, ts: Long) {
        write(parse().filterNot { it.second == url && it.third == ts })
    }

    private fun clearSince(ms: Long) {
        val cutoff = System.currentTimeMillis() - ms
        write(parse().filter { it.third != 0L && it.third < cutoff })
    }

    private fun write(l: List<Triple<String, String, Long>>) {
        prefs.edit().putString("history", l.joinToString("\n") {
            it.first + '\u0001' + it.second + '\u0001' + it.third
        }).apply()
        rebuild()
    }
}

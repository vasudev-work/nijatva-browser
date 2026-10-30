package `in`.nijatva.browser

import android.content.Intent
import android.speech.tts.TextToSpeech
import android.speech.tts.Voice
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import androidx.appcompat.app.AlertDialog
import java.util.Locale

/**
 * Choosing how Nijatva speaks, kept simple.
 *
 * The engine can carry hundreds of voices - 473 on one phone - and a flat list of
 * them is unreadable. So this screen lists languages, one row each, sorted A to Z:
 * pick Hindi and you are done, because most languages have exactly one voice.
 * Only when a language really has several does a second, short list appear.
 */
class VoiceActivity : BaseSettingsActivity() {

    override val titleRes = R.string.tts_voice

    private var engine: TextToSpeech? = null
    private var ready = false
    private var failed = false
    private var query = ""
    private var searchAdded = false
    private var all: List<Voice> = emptyList()

    private fun startEngine() {
        if (engine != null) return
        try {
            engine = TextToSpeech(this) { status ->
                ready = status == TextToSpeech.SUCCESS
                failed = !ready
                all = try { engine?.voices?.toList() ?: emptyList() } catch (_: Exception) { emptyList() }
                if (ready && all.isEmpty()) failed = true
                rebuild()
            }
        } catch (_: Exception) { failed = true }
    }

    /** One entry per language, A to Z, each carrying its voices. */
    private fun byLanguage(): List<Pair<String, List<Voice>>> {
        val map = LinkedHashMap<String, MutableList<Voice>>()
        for (v in all) {
            val tag = try { v.locale?.toLanguageTag() ?: "" } catch (_: Exception) { "" }
            if (tag.isBlank()) continue
            map.getOrPut(tag) { ArrayList() }.add(v)
        }
        return map.entries
            .map { it.key to it.value.toList() }
            .sortedBy { displayName(it.first) }
    }

    private fun displayName(tag: String): String = try {
        Locale.forLanguageTag(tag).getDisplayName(Locale.ENGLISH).ifBlank { tag }
    } catch (_: Exception) { tag }

    private fun currentTag(): String = prefs.getString("tts_voice_lang", "") ?: ""
    private fun currentName(): String = prefs.getString("tts_voice_name", "") ?: ""

    private fun save(tag: String, name: String) {
        prefs.edit().putString("tts_voice_lang", tag).putString("tts_voice_name", name).apply()
    }

    private fun clear() {
        prefs.edit().remove("tts_voice_lang").remove("tts_voice_name").apply()
    }

    override fun build(b: SettingsBuilder, content: LinearLayout) {
        startEngine()

        if (!ready) {
            b.note(getString(if (failed) R.string.tts_voice_failed else R.string.tts_voice_starting))
            return
        }

        addSearch()

        val langs = byLanguage().filter {
            query.isBlank() || displayName(it.first).contains(query, true) || it.first.contains(query, true)
        }

        b.section(getString(R.string.tts_voice))
        val head = b.card()
        b.navRow(head, getString(R.string.tts_voice_default),
            if (currentTag().isBlank()) getString(R.string.tts_voice_on) else "",
            View.OnClickListener {
                clear()
                toastDone()
                rebuild()
            })

        if (langs.isEmpty()) {
            b.note(getString(R.string.d_empty))
            return
        }

        b.section(getString(R.string.tts_voice_languages))
        val card = b.card()
        for ((i, entry) in langs.withIndex()) {
            if (i > 0) b.divider(card)
            val (tag, voices) = entry
            val on = tag == currentTag()
            val summary = when {
                on && currentName().isNotBlank() -> currentName()
                voices.size > 1 -> getString(R.string.tts_voice_count, voices.size)
                else -> voices.firstOrNull()?.name ?: ""
            }
            b.navRow(card, displayName(tag), summary, View.OnClickListener {
                if (voices.size <= 1) {
                    save(tag, voices.firstOrNull()?.name ?: "")
                    toastDone()
                    rebuild()
                } else {
                    pickVoice(tag, voices)
                }
            })
        }
    }

    /** Only shown when a language genuinely has more than one voice. */
    private fun pickVoice(tag: String, voices: List<Voice>) {
        val sorted = voices.sortedBy { it.name ?: "" }
        val names = sorted.map { v ->
            val q = if (v.quality > 300) " · high quality" else ""
            val n = if (v.isNetworkConnectionRequired) " · needs network" else ""
            (v.name ?: "Voice") + q + n
        }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle(displayName(tag))
            .setItems(names) { _, which ->
                save(tag, sorted[which].name ?: "")
                toastDone()
                rebuild()
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    private fun toastDone() {
        try { android.widget.Toast.makeText(this, R.string.tts_voice_saved, android.widget.Toast.LENGTH_SHORT).show() } catch (_: Exception) { }
    }

    private fun addSearch() {
        if (searchAdded) return
        searchAdded = true
        val et = EditText(this)
        et.hint = getString(R.string.tts_voice_search)
        et.isSingleLine = true
        et.setTextColor(attr(R.attr.textPrimaryColor))
        et.setHintTextColor(attr(R.attr.textSecondaryColor))
        val bg = android.graphics.drawable.GradientDrawable()
        bg.cornerRadius = dp(20).toFloat()
        bg.setColor(attr(R.attr.surface2Color))
        et.background = bg
        et.setPadding(dp(16), dp(11), dp(16), dp(11))
        et.layoutParams = LinearLayout.LayoutParams(0, android.view.ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        et.addTextChangedListener(object : android.text.TextWatcher {
            override fun afterTextChanged(s: android.text.Editable?) { query = s?.toString() ?: ""; rebuild() }
            override fun beforeTextChanged(s: CharSequence?, a: Int, b2: Int, c: Int) { }
            override fun onTextChanged(s: CharSequence?, a: Int, b2: Int, c: Int) { }
        })
        val box = LinearLayout(this)
        box.setPadding(dp(14), dp(10), dp(14), dp(2))
        box.addView(et)
        addTopView(box)
    }

    override fun onDestroy() {
        try { engine?.stop(); engine?.shutdown() } catch (_: Exception) { }
        engine = null
        super.onDestroy()
    }
}

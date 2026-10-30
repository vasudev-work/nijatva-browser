package `in`.nijatva.browser

import android.app.DownloadManager
import android.content.Intent
import android.net.Uri
import android.widget.LinearLayout
import androidx.appcompat.app.AlertDialog

/**
 * Settings hub.
 *
 * The first screen carries only the ten things people actually change — search
 * engine, appearance, shields, tabs, downloads, history, bookmarks, passwords
 * and clearing data. Everything else lives behind "All settings", grouped by
 * what it is for and sorted A to Z inside each group, so the list stays
 * scannable instead of being a 45-row wall. The search box always looks at the
 * whole set, whichever screen you are on.
 */
class SettingsActivity : BaseSettingsActivity() {

    override val titleRes = R.string.settings_title

    private var query = ""
    private var searchAdded = false

    private data class Item(val label: String, val action: () -> Unit)

    private val showAll: Boolean
        get() = intent?.getBooleanExtra("all", false) == true

    private fun row(r: Int, action: () -> Unit) = Item(getString(r), action)

    private fun downloads() = row(R.string.s_downloads) {
        try { startActivity(Intent(DownloadManager.ACTION_VIEW_DOWNLOADS)) } catch (_: Exception) { }
    }

    private fun dialog(r: Int, body: String) = { showDialog(getString(r), body) }

    /** The ten rows worth showing without a tap. */
    private fun essentials(): List<Item> = listOf(
        row(R.string.s_search_engine) { go(SearchEngineActivity::class.java) },
        row(R.string.s_appearance) { go(AppearanceActivity::class.java) },
        row(R.string.r_privacy_dashboard) { go(PrivacyActivity::class.java) },
        row(R.string.ab_title) { go(AdBlockActivity::class.java) },
        row(R.string.s_tabs) { go(TabsActivity::class.java) },
        downloads(),
        row(R.string.s_history) { go(HistoryActivity::class.java) },
        row(R.string.s_bookmarks) { go(BookmarksActivity::class.java) },
        row(R.string.s_passwords) { go(PasswordsActivity::class.java) },
        row(R.string.s_clear_data) { go(PrivacyActivity::class.java) }
    ).sortedBy { it.label.lowercase() }

    /** Everything, grouped by what it is for, A to Z inside each group. */
    private fun everything(): List<Pair<String, List<Item>>> = listOf(
        getString(R.string.sec_general) to listOf(
            row(R.string.s_appearance) { go(AppearanceActivity::class.java) },
            row(R.string.s_bookmarks) { go(BookmarksActivity::class.java) },
            row(R.string.dls_title) { go(DownloadSettingsActivity::class.java) },
            downloads(),
            row(R.string.fl_title) { go(FilesActivity::class.java) },
            row(R.string.s_history) { go(HistoryActivity::class.java) },
            row(R.string.hs_title) { go(HistorySettingsActivity::class.java) },
            row(R.string.s_homepage) { go(HomeShortcutsActivity::class.java) },
            row(R.string.hp_title) { go(HomepageActivity::class.java) },
            row(R.string.rl_title) { go(ReadingListActivity::class.java) },
            row(R.string.s_search_engine) { go(SearchEngineActivity::class.java) },
            row(R.string.s_tabs) { go(TabsActivity::class.java) },
            row(R.string.s_toolbar_nav) { go(ToolbarActivity::class.java) }
        ).sortedBy { it.label.lowercase() },

        getString(R.string.sec_privacy) to listOf(
            row(R.string.ab_title) { go(AdBlockActivity::class.java) },
            row(R.string.r_autofill) { go(AutofillActivity::class.java) },
            row(R.string.s_clear_data) { go(PrivacyActivity::class.java) },
            row(R.string.s_cookies) { go(PrivacyActivity::class.java) },
            row(R.string.s_passwords) { go(PasswordsActivity::class.java) },
            row(R.string.s_permissions) { go(SitePermissionsActivity::class.java) },
            row(R.string.r_privacy_dashboard) { go(PrivacyActivity::class.java) },
            row(R.string.pf_title) { go(ProfilesActivity::class.java) },
            row(R.string.s_tracking) { go(ShieldsActivity::class.java) },
            row(R.string.s_website_settings) { go(SitePermissionsActivity::class.java) }
        ).sortedBy { it.label.lowercase() },

        getString(R.string.sec_accessibility) to listOf(
            row(R.string.s_accessibility) { go(AppearanceActivity::class.java) },
            row(R.string.rd_title) { go(ReadingActivity::class.java) },
            row(R.string.s_reader_translate) { go(ReadingActivity::class.java) },
            row(R.string.sf_title) { go(ScreenFilterActivity::class.java) },
            row(R.string.s_text_size) { go(AppearanceActivity::class.java) }
        ).sortedBy { it.label.lowercase() },

        getString(R.string.sec_performance) to listOf(
            row(R.string.s_background) { go(AdvancedActivity::class.java) },
            row(R.string.s_cache) { go(PrivacyActivity::class.java) },
            row(R.string.s_data_usage) { go(AdvancedActivity::class.java) }
        ).sortedBy { it.label.lowercase() },

        getString(R.string.sec_advanced) to listOf(
            row(R.string.s_backup) { go(BackupActivity::class.java) },
            row(R.string.s_developer) { go(AdvancedActivity::class.java) },
            row(R.string.dg_title) { go(DiagnosticsActivity::class.java) },
            row(R.string.r_extensions) { go(ExtensionsActivity::class.java) },
            Item(getString(R.string.s_experimental), dialog(R.string.s_experimental, getString(R.string.exp_note))),
            row(R.string.nl_title) { go(NetLogActivity::class.java) },
            row(R.string.uf_title) { go(UrlFiltersActivity::class.java) },
            row(R.string.us_title) { go(UserStylesActivity::class.java) }
        ).sortedBy { it.label.lowercase() },

        getString(R.string.sec_about) to listOf(
            Item(getString(R.string.r_about), { go(AboutActivity::class.java) }),
            Item(getString(R.string.s_updates), dialog(R.string.s_updates, getString(R.string.updates_note))),
            Item(getString(R.string.s_feedback), { feedback() }),
            Item(getString(R.string.s_licences), dialog(R.string.s_licences, getString(R.string.licences_note))),
            Item(getString(R.string.s_privacy_policy), dialog(R.string.s_privacy_policy, getString(R.string.policy_note))),
            Item(getString(R.string.s_webview_version), dialog(R.string.s_webview_version, webViewVersion()))
        ).sortedBy { it.label.lowercase() }
    )

    override fun build(b: SettingsBuilder, content: LinearLayout) {
        addSearchBox()

        // A search always looks at everything, on either screen.
        if (query.isNotBlank()) {
            b.section(getString(R.string.st_search_results))
            val card = b.card()
            var first = true
            for ((_, items) in everything()) {
                for (item in items) {
                    if (!item.label.contains(query, true)) continue
                    if (!first) b.divider(card)
                    first = false
                    b.navRow(card, item.label, null, android.view.View.OnClickListener { item.action() })
                }
            }
            if (first) b.note(getString(R.string.d_empty))
            return
        }

        if (!showAll) {
            b.section(getString(R.string.st_modes))
            val m = b.card()
            b.navRow(m, getString(R.string.st_manage_modes), containerName(),
                android.view.View.OnClickListener {
                    try {
                        startActivity(Intent(this, MainActivity::class.java)
                            .putExtra("show", "containers")
                            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP))
                    } catch (_: Exception) { }
                })

            b.section(getString(R.string.st_essentials))
            val e = b.card()
            val list = essentials()
            for (item in list) {
                b.navRow(e, item.label, subtitle(item.label),
                    android.view.View.OnClickListener { item.action() })
            }

            val more = everything().sumOf { it.second.size } - list.size
            b.navRow(e, getString(R.string.st_all_settings),
                getString(R.string.st_all_settings_sub, more),
                android.view.View.OnClickListener {
                    startActivity(Intent(this, SettingsActivity::class.java).putExtra("all", true))
                })
            return
        }

        b.section(getString(R.string.st_all_settings))
        for ((title, items) in everything()) {
            b.section(title)
            val card = b.card()
            for (item in items) {
                b.navRow(card, item.label, subtitle(item.label),
                    android.view.View.OnClickListener { item.action() })
            }
        }
        b.section(getString(R.string.sec_about))
        val av = b.card()
        b.valueRow(av, getString(R.string.s_app_version), appVersion(), null)
    }

    private fun addSearchBox() {
        if (searchAdded) return
        searchAdded = true
        val et = android.widget.EditText(this)
        et.hint = getString(R.string.st_search)
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

    /**
     * The second line a row shows. The reference puts the current value there
     * rather than a description, so that is what this returns.
     */
    private fun subtitle(label: String): String? = try {
        when (label) {
            getString(R.string.s_search_engine) ->
                SearchEngineStore(this).default().name
            getString(R.string.s_appearance) ->
                when (prefs.getString("theme_mode", "dark")) {
                    "light" -> "Light"
                    "system" -> "System"
                    else -> "Dark"
                }
            else -> null
        }
    } catch (_: Exception) { null }

    private fun containerName(): String = try {
        val s = ContainerStore(this)
        val id = s.activeContainerId
        s.getContainers().firstOrNull { it.id == id }?.name ?: "Personal"
    } catch (_: Exception) { "Personal" }

    private fun go(cls: Class<*>) { startActivity(Intent(this, cls)) }

    private fun showDialog(title: String, message: String) {
        AlertDialog.Builder(this).setTitle(title).setMessage(message)
            .setPositiveButton(android.R.string.ok, null).show()
    }

    private fun appVersion(): String = try {
        packageManager.getPackageInfo(packageName, 0).versionName ?: "?"
    } catch (_: Exception) { "?" }

    private fun webViewVersion(): String = try {
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            val pm = android.webkit.WebView.getCurrentWebViewPackage()
            (pm?.versionName ?: "unknown") + "  (" + (pm?.packageName ?: "") + ")"
        } else "unknown"
    } catch (_: Exception) { "unknown" }

    private fun feedback() {
        val i = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:" + getString(R.string.feedback_email)))
        try { startActivity(i) }
        catch (_: Exception) { showDialog(getString(R.string.s_feedback), getString(R.string.feedback_email)) }
    }
}

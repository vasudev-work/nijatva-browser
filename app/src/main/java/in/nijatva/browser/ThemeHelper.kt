package in.nijatva.browser

import android.content.Context
import android.content.res.Configuration

/** Picks one of the four themes: Nijatva / Quiet Nature, each dark or light. */
object ThemeHelper {

    fun prefs(context: Context) =
        context.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE)

    fun isDark(context: Context): Boolean =
        when (prefs(context).getString("theme_mode", "dark")) {
            "light" -> false
            "system" -> (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
            else -> true
        }

    fun isQuiet(context: Context): Boolean =
        (prefs(context).getString("theme_brand", "nijatva") ?: "nijatva") == "quiet"

    fun isAmoled(context: Context): Boolean =
        prefs(context).getBoolean("amoled_ui", false)

    fun res(context: Context): Int {
        val dark = isDark(context)
        val quiet = isQuiet(context)
        val amoled = isAmoled(context) && dark
        return when {
            amoled && quiet -> R.style.Theme_Nijatva_QuietAmoled
            amoled -> R.style.Theme_Nijatva_Amoled
            quiet && dark -> R.style.Theme_Nijatva_QuietDark
            quiet -> R.style.Theme_Nijatva_QuietLight
            dark -> R.style.Theme_Nijatva
            else -> R.style.Theme_Nijatva_Light
        }
    }
}

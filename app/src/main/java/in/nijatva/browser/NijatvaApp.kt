package `in`.nijatva.browser

import android.app.Application

/**
 * Application setup: Material You when the device asks for it, plus a small
 * crash log the Diagnostics screen can read back.
 *
 * The old build also configured a shared settings-UI module (SettingsConfig).
 * That module is not part of this repository, so the dependency is gone; the
 * app's own theme attributes carry the branding instead.
 */
class NijatvaApp : Application() {
    override fun onCreate() {
        super.onCreate()

        // Material You, when the device and the user both want it
        try {
            val p = getSharedPreferences("nijatva", MODE_PRIVATE)
            if (p.getBoolean("dynamic_color", false) && android.os.Build.VERSION.SDK_INT >= 31) {
                com.google.android.material.color.DynamicColors.applyToActivitiesIfAvailable(this)
            }
        } catch (_: Exception) { }

        val prev = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { t, e ->
            try {
                java.io.File(filesDir, "crash.log")
                    .appendText("\n--- " + java.util.Date().toString() + " ---\n" +
                        android.util.Log.getStackTraceString(e) + "\n")
            } catch (_: Exception) { }
            prev?.uncaughtException(t, e)
        }
    }
}

package `in`.nijatva.browser

import android.app.DownloadManager
import android.content.Intent
import android.graphics.BitmapFactory
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Environment
import android.os.StatFs
import android.view.Gravity
import android.view.ViewGroup
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.TextView
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Everything the browser has downloaded, newest first, grouped by the day it
 * arrived - the shape people expect from a download list: a storage line, a row
 * of filters, then date headings with the files under them.
 */
class DownloadsActivity : BaseSettingsActivity() {

    override val titleRes = R.string.dl_title

    private var filter = "all"   // all | video | image | page | other

    private data class Item(
        val id: Long,
        val name: String,
        val size: Long,
        val host: String,
        val mime: String,
        val local: String?,
        val day: String,
        val ts: Long
    )

    override fun build(b: SettingsBuilder, content: LinearLayout) {
        // one block, added once: addTopView prepends, so two calls would flip
        // the storage line and the chips
        val head = LinearLayout(this)
        head.orientation = LinearLayout.VERTICAL
        storageLine(head)
        chips(head)
        addTopView(head)
        val items = list().filter { keep(it) }
        if (items.isEmpty()) {
            val box = LinearLayout(this)
            box.orientation = LinearLayout.VERTICAL
            box.gravity = Gravity.CENTER_HORIZONTAL
            box.setPadding(dp(24), dp(40), dp(24), dp(16))

            val mark = TextView(this)
            mark.text = "\u2913"
            mark.textSize = 44f
            mark.gravity = Gravity.CENTER
            mark.setTextColor(attr(R.attr.brandColor))
            val mbg = GradientDrawable()
            mbg.shape = GradientDrawable.OVAL
            mbg.setColor((attr(R.attr.brandColor) and 0x00FFFFFF) or 0x1F000000)
            mark.background = mbg
            mark.layoutParams = LinearLayout.LayoutParams(dp(120), dp(120))
            box.addView(mark)

            val t1 = TextView(this)
            t1.text = getString(R.string.dl_empty_title)
            t1.textSize = 17f
            t1.setTypeface(null, android.graphics.Typeface.BOLD)
            t1.setTextColor(attr(R.attr.textPrimaryColor))
            t1.gravity = Gravity.CENTER
            t1.setPadding(0, dp(18), 0, dp(8))
            box.addView(t1)

            val t2 = TextView(this)
            t2.text = getString(R.string.dl_empty_sub)
            t2.textSize = 13.5f
            t2.setTextColor(attr(R.attr.textSecondaryColor))
            t2.gravity = Gravity.CENTER
            box.addView(t2)

            b.card().addView(box)
            return
        }
        var day = ""
        var card: LinearLayout? = null
        for (it in items) {
            if (it.day != day) {
                day = it.day
                b.section(day)
                card = b.card()
            }
            row(card!!, it)
        }
    }

    /** "Using 52.93 MB of 114.30 GB" */
    private fun storageLine(parent: LinearLayout) {
        val tv = TextView(this)
        tv.text = getString(R.string.dl_using, used(), total())
        tv.setTextColor(attr(R.attr.textSecondaryColor))
        tv.textSize = 13f
        tv.setPadding(dp(20), dp(14), dp(20), dp(8))
        parent.addView(tv)
    }

    private fun chips(parent: LinearLayout) {
        val strip = HorizontalScrollView(this)
        strip.isHorizontalScrollBarEnabled = false
        val row = LinearLayout(this)
        row.orientation = LinearLayout.HORIZONTAL
        row.setPadding(dp(16), dp(6), dp(16), dp(10))
        for ((key, label) in listOf(
            "all" to getString(R.string.dl_all),
            "video" to getString(R.string.fl_videos),
            "image" to getString(R.string.fl_images),
            "page" to getString(R.string.dl_pages),
            "other" to getString(R.string.dl_other)
        )) {
            val c = TextView(this)
            c.text = label
            c.textSize = 13f
            c.gravity = Gravity.CENTER
            c.setPadding(dp(16), dp(9), dp(16), dp(9))
            val on = key == filter
            c.setTextColor(if (on) attr(R.attr.textPrimaryColor) else attr(R.attr.textSecondaryColor))
            val bg = android.graphics.drawable.GradientDrawable()
            bg.cornerRadius = dp(20).toFloat()
            bg.setColor(if (on) attr(R.attr.surface2Color) else attr(R.attr.surfaceColor))
            c.background = bg
            val lp = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT)
            lp.rightMargin = dp(8)
            c.layoutParams = lp
            c.isFocusable = false
            c.setOnClickListener { filter = key; rebuild() }
            row.addView(c)
        }
        strip.addView(row)
        parent.addView(strip)
    }

    private fun keep(it: Item): Boolean = when (filter) {
        "video" -> it.mime.startsWith("video/")
        "image" -> it.mime.startsWith("image/")
        "page" -> it.mime.contains("html") || it.name.endsWith(".html") || it.name.endsWith(".mhtml")
        "other" -> !(it.mime.startsWith("video/") || it.mime.startsWith("image/"))
        else -> true
    }

    private fun row(card: LinearLayout, item: Item) {
        val r = LinearLayout(this)
        r.orientation = LinearLayout.HORIZONTAL
        r.gravity = Gravity.CENTER_VERTICAL
        r.setPadding(dp(14), dp(12), dp(6), dp(12))
        try {
            val ta = obtainStyledAttributes(intArrayOf(android.R.attr.colorControlHighlight))
            val c = ta.getColor(0, 0x33FFFFFF.toInt())
            ta.recycle()
            r.foreground = android.graphics.drawable.RippleDrawable(
                android.content.res.ColorStateList.valueOf(c), null, null)
            r.isFocusable = false
        } catch (_: Exception) { }

        // an image shows itself, everything else shows its kind
        val thumb = ImageView(this)
        thumb.scaleType = ImageView.ScaleType.CENTER_CROP
        val lp = LinearLayout.LayoutParams(dp(48), dp(48))
        lp.rightMargin = dp(12)
        val bmp = if (item.mime.startsWith("image/")) preview(item.local) else null
        if (bmp != null) {
            thumb.setImageBitmap(bmp)
            thumb.clipToOutline = false
        } else {
            thumb.setImageResource(iconFor(item.mime))
            thumb.setColorFilter(attr(R.attr.textSecondaryColor))
            thumb.scaleType = ImageView.ScaleType.CENTER_INSIDE
            thumb.setPadding(dp(11), dp(11), dp(11), dp(11))
        }
        r.addView(thumb, lp)

        val col = LinearLayout(this)
        col.orientation = LinearLayout.VERTICAL
        col.layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        val name = TextView(this)
        name.text = item.name
        name.setTextColor(attr(R.attr.textPrimaryColor))
        name.textSize = 15f
        name.maxLines = 1
        name.ellipsize = android.text.TextUtils.TruncateAt.MIDDLE
        col.addView(name)
        val sub = TextView(this)
        sub.text = if (item.host.isBlank()) size(item.size) else size(item.size) + " \u00b7 " + item.host
        sub.setTextColor(attr(R.attr.textSecondaryColor))
        sub.textSize = 12f
        sub.maxLines = 1
        col.addView(sub)
        r.addView(col)

        val more = TextView(this)
        more.text = "\u22ee"
        more.textSize = 20f
        more.gravity = Gravity.CENTER
        more.setTextColor(attr(R.attr.textSecondaryColor))
        more.setPadding(dp(12), 0, dp(12), 0)
        more.isFocusable = false
        more.setOnClickListener { menu(more, item) }
        r.addView(more)

        r.setOnClickListener { open(item) }
        card.addView(r)
        b_divider(card)
    }

    private fun b_divider(card: LinearLayout) {
        val v = android.view.View(this)
        v.setBackgroundColor(attr(R.attr.dividerColor))
        card.addView(v, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)))
    }

    private fun menu(anchor: TextView, it: Item) {
        val pm = PopupMenu(this, anchor)
        pm.menu.add(0, 1, 0, getString(R.string.dl_open))
        pm.menu.add(0, 2, 1, getString(R.string.dl_share))
        pm.menu.add(0, 3, 2, getString(R.string.dl_delete))
        pm.setOnMenuItemClickListener { m ->
            when (m.itemId) {
                1 -> open(it)
                2 -> share(it)
                3 -> remove(it)
            }
            true
        }
        pm.show()
    }

    private fun open(it: Item) {
        try {
            val uri = it.local?.let { Uri.parse(it) } ?: return
            val i = Intent(Intent.ACTION_VIEW).setDataAndType(uri, it.mime.ifBlank { "*/*" })
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            startActivity(i)
        } catch (_: Exception) { }
    }

    private fun share(it: Item) {
        try {
            val uri = it.local?.let { Uri.parse(it) } ?: return
            startActivity(Intent.createChooser(
                Intent(Intent.ACTION_SEND).setType(it.mime.ifBlank { "*/*" })
                    .putExtra(Intent.EXTRA_STREAM, uri)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),
                getString(R.string.dl_share)))
        } catch (_: Exception) { }
    }

    private fun remove(it: Item) {
        try {
            (getSystemService(android.content.Context.DOWNLOAD_SERVICE) as DownloadManager).remove(it.id)
        } catch (_: Exception) { }
        rebuild()
    }

    private fun iconFor(mime: String): Int = when {
        mime.startsWith("video/") -> R.drawable.ic_movie
        mime.startsWith("image/") -> R.drawable.ic_camera
        mime.startsWith("audio/") -> R.drawable.ic_speak
        mime.contains("pdf") -> R.drawable.ic_pdf
        mime.contains("html") -> R.drawable.ic_globe
        else -> R.drawable.ic_doc
    }

    private fun preview(path: String?): android.graphics.Bitmap? = try {
        val f = path?.removePrefix("file://")?.let { File(it) }
        if (f == null || !f.exists()) null else {
            val o = BitmapFactory.Options()
            o.inJustDecodeBounds = true
            BitmapFactory.decodeFile(f.absolutePath, o)
            var s = 1
            while (o.outWidth / (s * 2) >= 96) s *= 2
            val o2 = BitmapFactory.Options()
            o2.inSampleSize = s
            BitmapFactory.decodeFile(f.absolutePath, o2)
        }
    } catch (_: Exception) { null }

    private fun list(): List<Item> {
        val out = ArrayList<Item>()
        try {
            val dm = getSystemService(android.content.Context.DOWNLOAD_SERVICE) as DownloadManager
            val c = dm.query(DownloadManager.Query())
            if (c == null) return out
            val fmt = SimpleDateFormat("dd MMM yyyy", Locale.getDefault())
            c.use {
                while (it.moveToNext()) {
                    val id = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_ID))
                    val title = it.getString(it.getColumnIndexOrThrow(DownloadManager.COLUMN_TITLE))
                    val uri = it.getString(it.getColumnIndexOrThrow(DownloadManager.COLUMN_URI)) ?: ""
                    val mime = it.getString(it.getColumnIndexOrThrow(DownloadManager.COLUMN_MEDIA_TYPE)) ?: ""
                    val size = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                    val when0 = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_LAST_MODIFIED_TIMESTAMP))
                    val local = it.getString(it.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI))
                    val host = try { Uri.parse(uri).host ?: "" } catch (_: Exception) { "" }
                    val name = title ?: uri.substringAfterLast('/')
                    val ts = if (when0 > 0) when0 else System.currentTimeMillis()
                    out.add(Item(id, name, if (size > 0) size else 0, host, mime, local,
                        fmt.format(Date(ts)), ts))
                }
            }
        } catch (_: Exception) { }
        return out.sortedByDescending { it.ts }
    }

    private fun used(): String {
        val items = list()
        val total = items.sumOf { if (it.size > 0) it.size else 0L }
        return size(total)
    }

    private fun total(): String = try {
        val s = StatFs(Environment.getExternalStorageDirectory().path)
        size(s.blockCountLong * s.blockSizeLong)
    } catch (_: Exception) { "?" }

    private fun size(bytes: Long): String {
        if (bytes <= 0) return "0 B"
        val kb = bytes / 1024.0
        if (kb < 1024) return String.format(Locale.getDefault(), "%.0f KB", kb)
        val mb = kb / 1024.0
        if (mb < 1024) return String.format(Locale.getDefault(), "%.2f MB", mb)
        return String.format(Locale.getDefault(), "%.2f GB", mb / 1024.0)
    }
}

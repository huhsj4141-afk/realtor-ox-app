package kr.realtor.ox

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.widget.Toast
import androidx.core.content.FileProvider
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/** 앱 자동 업데이트: GitHub 최신 릴리스의 version.txt 가 지금보다 크면 받아서 설치 화면을 띄움 */
object Updater {
    private const val BASE = "https://github.com/huhsj4141-afk/realtor-ox-app/releases/download/latest/"
    private const val EVERY = 20 * 60 * 1000L          // 앱을 열 때마다(20분에 한 번까지) 확인

    private fun get(url: String): HttpURLConnection = (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = 10_000; readTimeout = 60_000; instanceFollowRedirects = true
    }

    private fun current(a: Activity): Long =
        if (Build.VERSION.SDK_INT >= 28) a.packageManager.getPackageInfo(a.packageName, 0).longVersionCode
        else @Suppress("DEPRECATION") a.packageManager.getPackageInfo(a.packageName, 0).versionCode.toLong()

    /** 새 버전 번호를 알게 되면 불림(웹 첫 화면 배너용). 0 = 최신 */
    var onLatest: ((Long) -> Unit)? = null
    private val busy = java.util.concurrent.atomic.AtomicBoolean(false)
    fun version(a: Activity): Long = current(a)
    fun latestKnown(a: Activity): Long = a.getSharedPreferences("ox", Activity.MODE_PRIVATE).getLong("upd_latest", 0)
    fun install(a: Activity) = download(a)

    fun check(a: Activity, force: Boolean = false, quiet: Boolean = false) {
        File(a.cacheDir, "update").deleteRecursively()      // 설치 끝난 업데이트 파일(약 40MB) 정리
        val sp = a.getSharedPreferences("ox", Activity.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        if (!force && now - sp.getLong("upd_at", 0) < EVERY) return
        sp.edit().putLong("upd_at", now).apply()
        Thread {
            try {
                val latest = get(BASE + "version.txt").inputStream.bufferedReader().readText().trim().toLong()
                val cur = current(a)
                sp.edit().putLong("upd_latest", latest).apply()
                a.runOnUiThread {
                    onLatest?.invoke(if (latest > cur) latest else 0)
                    if (latest > cur && !quiet) ask(a, latest)
                    else if (force) Toast.makeText(a, "최신 버전이에요 (v$cur)", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                if (force) a.runOnUiThread { Toast.makeText(a, "업데이트 확인 실패: ${e.message}", Toast.LENGTH_SHORT).show() }
            }
        }.start()
    }

    private fun ask(a: Activity, v: Long) {
        if (a.isFinishing) return
        AlertDialog.Builder(a).setTitle("🔄 새 버전 v$v")
            .setMessage("새 해설·기능이 들어간 버전이 있어요. 지금 받을까요? (받은 파일을 눌러 설치 · 기록은 그대로 남아요)")
            .setPositiveButton("업데이트") { _, _ -> download(a) }
            .setNegativeButton("나중에", null).show()
    }

    // 앱이 직접 설치하지 않아요(보호 기능이 '유해한 앱'으로 오해하지 않게) → 브라우저로 받아서 눌러 설치
    private fun download(a: Activity) {
        Toast.makeText(a, "다운로드가 끝나면 알림이나 '내 파일 › 다운로드'에서 realtor-ox.apk 를 눌러 설치하세요 (기록은 그대로 남아요)", Toast.LENGTH_LONG).show()
        try { a.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(BASE + "realtor-ox.apk")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        catch (e: Exception) { Toast.makeText(a, "브라우저를 열지 못했어요", Toast.LENGTH_LONG).show() }
    }
}

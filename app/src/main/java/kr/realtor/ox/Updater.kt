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
    private const val BASE = "https://github.com/huhsj4141-afk/realtor-ox-app/releases/latest/download/"
    private const val EVERY = 20 * 60 * 1000L          // 앱을 열 때마다(20분에 한 번까지) 확인

    private fun get(url: String): HttpURLConnection = (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = 10_000; readTimeout = 60_000; instanceFollowRedirects = true
    }

    private fun current(a: Activity): Long =
        if (Build.VERSION.SDK_INT >= 28) a.packageManager.getPackageInfo(a.packageName, 0).longVersionCode
        else @Suppress("DEPRECATION") a.packageManager.getPackageInfo(a.packageName, 0).versionCode.toLong()

    /** 새 버전 번호를 알게 되면 불림(웹 첫 화면 배너용). 0 = 최신 */
    var onLatest: ((Long) -> Unit)? = null
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
            .setMessage("새 해설·기능이 들어간 버전이 있어요. 지금 받아서 설치할까요? (기록은 그대로 남아요)")
            .setPositiveButton("업데이트") { _, _ -> download(a) }
            .setNegativeButton("나중에", null).show()
    }

    private fun download(a: Activity) {
        if (Build.VERSION.SDK_INT >= 26 && !a.packageManager.canRequestPackageInstalls()) {
            Toast.makeText(a, "'이 출처 허용'을 켠 뒤 뒤로 돌아와 다시 업데이트를 눌러 주세요", Toast.LENGTH_LONG).show()
            a.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + a.packageName)))
            a.getSharedPreferences("ox", Activity.MODE_PRIVATE).edit().putLong("upd_at", 0).apply()
            return
        }
        Toast.makeText(a, "새 버전 받는 중… (1~2분)", Toast.LENGTH_LONG).show()
        Thread {
            try {
                val dir = File(a.cacheDir, "update").apply { mkdirs() }
                val f = File(dir, "realtor-ox.apk")
                get(BASE + "realtor-ox.apk").inputStream.use { i -> f.outputStream().use { o -> i.copyTo(o) } }
                val uri = FileProvider.getUriForFile(a, a.packageName + ".files", f)
                a.runOnUiThread {
                    a.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK))
                }
            } catch (e: Exception) {
                a.runOnUiThread { Toast.makeText(a, "받기 실패: ${e.message}", Toast.LENGTH_LONG).show() }
            }
        }.start()
    }
}

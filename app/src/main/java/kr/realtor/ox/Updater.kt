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
    fun install(a: Activity) = if (BuildConfig.PLAY) Unit else auto(a, latestKnown(a), now = true)

    fun check(a: Activity, force: Boolean = false, quiet: Boolean = false) {
        if (BuildConfig.PLAY) { if (force) Toast.makeText(a, "업데이트는 플레이스토어가 알아서 해 줘요", Toast.LENGTH_SHORT).show(); return }
        if (!busy.get()) File(a.cacheDir, "update").listFiles()?.forEach { if (!it.name.endsWith("-${latestKnown(a)}.apk") || latestKnown(a) <= current(a)) it.delete() }   // 설치 끝난 업데이트 파일 정리
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
                    if (latest > cur) auto(a, latest)   // 🔄 자동 업데이트: 알아서 받아 두고 설치 화면만 띄움
                    else if (force) Toast.makeText(a, "최신 버전이에요 (v$cur)", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                if (force) a.runOnUiThread { Toast.makeText(a, "업데이트 확인 실패: ${e.message}", Toast.LENGTH_SHORT).show() }
            }
        }.start()
    }

    /** 새 버전을 뒤에서 받아 두었다가 설치 화면을 띄워요(안드로이드는 설치 '확인' 한 번은 꼭 사람이 눌러야 해요) */
    private fun auto(a: Activity, v: Long, now: Boolean = false) {
        if (a.isFinishing) return
        if (Build.VERSION.SDK_INT >= 26 && !a.packageManager.canRequestPackageInstalls()) {
            val sp = a.getSharedPreferences("ox", Activity.MODE_PRIVATE)
            if (!now && System.currentTimeMillis() - sp.getLong("upd_perm_ask", 0) < 24 * 3600_000L) return
            sp.edit().putLong("upd_perm_ask", System.currentTimeMillis()).apply()
            AlertDialog.Builder(a).setTitle("🔄 자동 업데이트 켜기")
                .setMessage("새 버전(v$v)을 앱이 알아서 받아 설치할 수 있게 '이 출처 허용'을 한 번만 켜 주세요. 켠 뒤 뒤로 돌아오면 바로 받아요.")
                .setPositiveButton("켜러 가기") { _, _ -> a.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + a.packageName))); a.getSharedPreferences("ox", Activity.MODE_PRIVATE).edit().putLong("upd_at", 0).apply() }
                .setNegativeButton("나중에", null).show()
            return
        }
        val f = File(File(a.cacheDir, "update").apply { mkdirs() }, "realtor-ox-$v.apk")
        if (f.exists() && f.length() > 1_000_000) { prompt(a, v, f); return }
        if (!busy.compareAndSet(false, true)) return
        if (now) Toast.makeText(a, "새 버전 받는 중… (1~2분)", Toast.LENGTH_LONG).show()
        Thread {
            try {
                val dir = f.parentFile!!; var ok = false
                for (t in 1..3) {   // 끝까지 다 받았는지(크기·파일 모양) 확인, 아니면 다시
                    val tmp = File(dir, "part.apk"); tmp.delete()
                    val c = get(BASE + "realtor-ox.apk"); val want = c.contentLengthLong
                    c.inputStream.use { i -> tmp.outputStream().use { o -> i.copyTo(o) } }
                    val head = ByteArray(2); tmp.inputStream().use { it.read(head) }
                    if ((want <= 0 || tmp.length() == want) && tmp.length() > 1_000_000 && head[0] == 'P'.code.toByte() && head[1] == 'K'.code.toByte()) { f.delete(); tmp.renameTo(f); ok = true; break }
                    Thread.sleep(3000)
                }
                if (ok) a.runOnUiThread { prompt(a, v, f) }
                else if (now) a.runOnUiThread { Toast.makeText(a, "새 버전을 끝까지 받지 못했어요. 인터넷을 확인해 주세요", Toast.LENGTH_LONG).show() }
            } catch (e: Exception) {
                if (now) a.runOnUiThread { Toast.makeText(a, "받기 실패: ${e.message}", Toast.LENGTH_LONG).show() }
            } finally { busy.set(false) }
        }.start()
    }

    private fun prompt(a: Activity, v: Long, f: File) {
        if (a.isFinishing) return
        AlertDialog.Builder(a).setTitle("🔄 새 버전 v$v 준비됨")
            .setMessage("새 버전을 받아 두었어요. 설치를 누르면 바로 바뀌어요. (기록은 그대로 남아요)")
            .setPositiveButton("설치") { _, _ ->
                val uri = FileProvider.getUriForFile(a, a.packageName + ".files", f)
                a.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK))
            }
            .setNegativeButton("나중에", null).show()
    }
}

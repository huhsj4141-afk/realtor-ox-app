package kr.realtor.ox

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import org.json.JSONObject
import java.util.concurrent.Executors

/** 학습 앱 전체 화면(문제 풀기·난이도·수준 체크·일지·계획…)을 폰 안에서 그대로 띄워요 */
class WebActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var voice: ExoPlayer
    private val io = Executors.newFixedThreadPool(2)
    private var speakId: String? = null
    private var loaded = false

    /** 듣기 화면의 아래 탭에서 넘어올 때 그 탭 열기 */
    private fun goTab(i: Intent?) {
        val t = i?.getStringExtra("tab") ?: return
        if (!loaded || !t.matches(Regex("[a-z]+"))) return
        i.removeExtra("tab"); js("typeof go==='function'&&go('$t')")
    }
    override fun onNewIntent(i: Intent) { super.onNewIntent(i); setIntent(i); goTab(i) }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        if (java.io.File(filesDir, "crash.txt").exists()) startActivity(Intent(this, MainActivity::class.java))
        voice = ExoPlayer.Builder(this).build()
        voice.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(s: Int) { if (s == Player.STATE_ENDED) done("done") }
            override fun onPlayerError(error: androidx.media3.common.PlaybackException) { done("error") }
        })
        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.allowFileAccess = true
            settings.mediaPlaybackRequiresUserGesture = false
            webChromeClient = WebChromeClient()
            // 인터넷 주소(원본 PDF·신고 등)는 앱 밖 브라우저로 열기
            webViewClient = object : android.webkit.WebViewClient() {
                override fun onPageFinished(v: WebView, url: String) { loaded = true; goTab(intent) }
                override fun shouldOverrideUrlLoading(v: WebView, r: android.webkit.WebResourceRequest): Boolean {
                    val u = r.url
                    if (u.scheme == "http" || u.scheme == "https") {
                        try { startActivity(Intent(Intent.ACTION_VIEW, u)) } catch (e: Exception) { }
                        return true
                    }
                    return false
                }
            }
            addJavascriptInterface(Bridge(), "NativeBridge")
            loadUrl("file:///android_asset/web/index.html")
        }
        val dark = (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES
        setContentView(safeArea(web, if (dark) 0xFF12151B.toInt() else 0xFFF6F7F9.toInt()))
    }

    // 앱을 새로 켤 때뿐 아니라 다시 열 때(백그라운드에서 돌아올 때)도 새 버전 확인
    override fun onResume() {
        super.onResume()
        Updater.onLatest = { v -> js("window.__upd&&__upd($v)") }
        Updater.check(this, quiet = true)                  // 첫 화면 맨 위 배너로 알림
    }

    override fun onDestroy() { voice.release(); io.shutdown(); web.destroy(); super.onDestroy() }

    @Deprecated("back")
    override fun onBackPressed() {
        web.evaluateJavascript("(typeof cur!=='undefined'&&cur!=='home')?(go('home'),1):0") { r ->
            if (r != "1") @Suppress("DEPRECATION") super.onBackPressed()
        }
    }

    private fun js(code: String) = runOnUiThread { web.evaluateJavascript(code, null) }
    private fun done(ev: String) { val id = speakId ?: return; speakId = null; js("__nbt('$id','$ev')") }

    inner class Bridge {
        @JavascriptInterface fun key(name: String): String = Net.key(this@WebActivity, name)
        @JavascriptInterface fun appVersion(): Long = Updater.version(this@WebActivity)
        @JavascriptInterface fun latestVersion(): Long = Updater.latestKnown(this@WebActivity)
        @JavascriptInterface fun update() = runOnUiThread { Updater.install(this@WebActivity) }
        @JavascriptInterface fun checkUpdate() = runOnUiThread { Updater.check(this@WebActivity, true) }
        @JavascriptInterface fun asset(name: String): String =
            try { assets.open("web/$name").bufferedReader().readText() }
            catch (e: Exception) { try { assets.open(name).bufferedReader().readText() } catch (e2: Exception) { "" } }   // ox.json·exp.json 은 assets 바로 아래
        /** 웹 기출 풀이에서 틀린 문제 번호들 → 듣기의 '틀린 문제'·복습 목록 */
        @JavascriptInterface fun setWrong(json: String) = try {
            val a = org.json.JSONArray(json); Study.setWrong(this@WebActivity, (0 until a.length()).map { a.getString(it) }.toSet())
        } catch (e: Exception) { }
        /** 날짜별 듣기 통계 → 웹 학습 일지 */
        @JavascriptInterface fun listenStats(): String = Study.statsJson(this@WebActivity)
        /** 상황별 학습: 듣기를 정한 목록·타이머로 바로 시작 (mode: mix/review/wrong/bm/all) */
        @JavascriptInterface fun openOxWith(mode: String, sleepMin: Int, busMin: Int) = runOnUiThread {
            startActivity(Intent(this@WebActivity, MainActivity::class.java).putExtra("mode", mode).putExtra("sleep", sleepMin).putExtra("bus", busMin))
        }
        @JavascriptInterface fun openOx() = runOnUiThread { startActivity(Intent(this@WebActivity, MainActivity::class.java)) }

        @JavascriptInterface fun gemini(id: String, model: String, body: String) {
            io.execute {
                val (ok, text) = try { true to Net.gemini(this@WebActivity, model, body) } catch (e: Exception) { false to (e.message ?: "실패") }
                js("__nb('$id',$ok,${JSONObject.quote(text)})")
            }
        }

        @JavascriptInterface fun speak(id: String, text: String, rate: Double) {
            io.execute {
                try {
                    val files = Net.speech(this@WebActivity, text)
                    runOnUiThread {
                        speakId = id
                        voice.setMediaItems(files.map { MediaItem.fromUri(Uri.fromFile(it)) })
                        voice.setPlaybackSpeed(rate.toFloat().coerceIn(0.5f, 2f)); voice.prepare(); voice.play()
                    }
                } catch (e: Exception) { runOnUiThread { speakId = id; done("error") } }
            }
        }
        @JavascriptInterface fun ttsPause() = runOnUiThread { voice.pause() }
        @JavascriptInterface fun ttsResume() = runOnUiThread { voice.play() }
        @JavascriptInterface fun ttsStop() = runOnUiThread { speakId = null; voice.stop() }
    }
}

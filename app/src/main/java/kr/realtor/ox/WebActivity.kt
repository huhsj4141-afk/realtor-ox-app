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

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        if (java.io.File(filesDir, "crash.txt").exists()) startActivity(Intent(this, MainActivity::class.java))
        Updater.check(this)
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
            addJavascriptInterface(Bridge(), "NativeBridge")
            loadUrl("file:///android_asset/web/index.html")
        }
        setContentView(web)
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
        @JavascriptInterface fun asset(name: String): String =
            try { assets.open("web/$name").bufferedReader().readText() } catch (e: Exception) { "" }
        /** 웹 기출 풀이에서 틀린 문제 번호들 → 듣기의 '틀린 문제'·복습 목록 */
        @JavascriptInterface fun setWrong(json: String) = try {
            val a = org.json.JSONArray(json); Study.setWrong(this@WebActivity, (0 until a.length()).map { a.getString(it) }.toSet())
        } catch (e: Exception) { }
        /** 날짜별 듣기 통계 → 웹 학습 일지 */
        @JavascriptInterface fun listenStats(): String = Study.statsJson(this@WebActivity)
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

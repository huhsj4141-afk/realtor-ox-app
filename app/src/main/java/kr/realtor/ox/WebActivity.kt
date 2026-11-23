package kr.realtor.ox

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.content.pm.PackageManager
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
    @Volatile private var allQueued = true
    private val ttsGen = java.util.concurrent.atomic.AtomicInteger(0)
    private var loaded = false

    /** 듣기 화면의 아래 탭에서 넘어올 때 그 탭 열기 */
    private fun goTab(i: Intent?) {
        val t = i?.getStringExtra("tab") ?: return
        if (!loaded || !t.matches(Regex("[a-z]+"))) return
        i.removeExtra("tab"); js("typeof go==='function'&&go('$t')")
    }
    /** 학습 화면 아래 탭의 실제 크기(픽셀)를 재 두면 듣기 화면이 똑같이 그림 */
    private fun measureTabs() {
        web.postDelayed({
            web.evaluateJavascript("(()=>{const n=document.getElementById('tabs');if(!n)return '';const b=n.querySelector('button'),i=b.querySelector('b'),r=n.getBoundingClientRect(),ri=i.getBoundingClientRect(),d=devicePixelRatio,bs=getComputedStyle(b);return [r.height,ri.top-r.top,ri.height,ri.width,parseFloat(getComputedStyle(i).fontSize),parseFloat(bs.fontSize),parseFloat(bs.lineHeight)||parseFloat(bs.fontSize)*1.5].map(x=>Math.round(x*d)).join(',')})()") { r ->
                val v = r.trim('"')
                if (v.matches(Regex("[0-9,]+")) && v.count { it == ',' } == 6) getSharedPreferences("ox", MODE_PRIVATE).edit().putString("tabpx", v).apply()
            }
        }, 1500)
    }
    override fun onNewIntent(i: Intent) { super.onNewIntent(i); setIntent(i); goTab(i) }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        if (java.io.File(filesDir, "crash.txt").exists()) startActivity(Intent(this, MainActivity::class.java))
        voice = ExoPlayer.Builder(this).build()
        voice.setWakeMode(androidx.media3.common.C.WAKE_MODE_LOCAL)   // 화면이 꺼져도 계속 읽기
        voice.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(s: Int) { if (s == Player.STATE_ENDED && allQueued) done("done") }
            override fun onMediaItemTransition(item: MediaItem?, reason: Int) {
                val id = speakId ?: return; val i = item?.mediaId?.toIntOrNull() ?: return
                js("window.__nbl&&__nbl('$id',$i)")   // 지금 읽는 줄 표시 (화면이 켜져 있을 때)
            }
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
                override fun onPageFinished(v: WebView, url: String) { loaded = true; goTab(intent); measureTabs() }
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
        if (loaded) js("window.__fixTab&&__fixTab()")
    }

    override fun onDestroy() { try { stt?.destroy() } catch (e: Exception) {}; voice.release(); io.shutdown(); web.destroy(); super.onDestroy() }

    @Deprecated("back")
    override fun onBackPressed() {
        web.evaluateJavascript("(typeof cur!=='undefined'&&cur!=='home')?(go('home'),1):0") { r ->
            if (r != "1") @Suppress("DEPRECATION") super.onBackPressed()
        }
    }

    private fun js(code: String) = runOnUiThread { web.evaluateJavascript(code, null) }
    private fun done(ev: String) { val id = speakId ?: return; speakId = null; js("__nbt('$id','$ev')") }

    override fun onActivityResult(rc: Int, res: Int, data: Intent?) {
        super.onActivityResult(rc, res, data)
        if (rc == 91 && res == RESULT_OK) data?.data?.let { u ->
            io.execute { try { val t = contentResolver.openInputStream(u)!!.bufferedReader().readText(); js("window.__restore&&__restore(${q(t)})") } catch (e: Exception) { js("window.__toast&&__toast('파일을 읽지 못했어요')") } }
        }
    }
    /* 누르고 있는 동안 음성 인식 → 떼면 글자로 */
    private var stt: SpeechRecognizer? = null
    private var sttText = ""
    private fun q(t: String) = JSONObject.quote(t)
    private fun sttBegin() {
        if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(android.Manifest.permission.RECORD_AUDIO), 77); js("window.__stt&&__stt('',2)"); return
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) { js("window.__stt&&__stt('',3)"); return }
        stt?.destroy(); sttText = ""
        val r = SpeechRecognizer.createSpeechRecognizer(this); stt = r
        r.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(p: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(v: Float) {}
            override fun onBufferReceived(b: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onError(e: Int) { js("window.__stt&&__stt(${q(sttText)},1)") }
            override fun onEvent(t: Int, p: Bundle?) {}
            override fun onPartialResults(p: Bundle?) { p?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.let { if (it.isNotBlank()) { sttText = it; js("window.__stt&&__stt(${q(it)},0)") } } }
            override fun onResults(p: Bundle?) { val t = p?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: sttText; js("window.__stt&&__stt(${q(t)},1)") }
        })
        r.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ko-KR"); putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 4000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 4000L)
        })
    }

    inner class Bridge {
        /** 💾 기록 백업: 파일로 만들어 공유 창(구글 드라이브 등)으로 */
        @JavascriptInterface fun backupShare(json: String) {
            try {
                val dir = java.io.File(cacheDir, "backup").apply { mkdirs() }
                val f = java.io.File(dir, "공인중개사_기록_" + java.text.SimpleDateFormat("yyyyMMdd_HHmm", java.util.Locale.KOREA).format(java.util.Date()) + ".json")
                f.writeText(json)
                val uri = androidx.core.content.FileProvider.getUriForFile(this@WebActivity, packageName + ".files", f)
                val i = Intent(Intent.ACTION_SEND).setType("application/json").putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                runOnUiThread { startActivity(Intent.createChooser(i, "백업 저장할 곳 (구글 드라이브 추천)")) }
            } catch (e: Exception) { js("window.__toast&&__toast('백업을 만들지 못했어요')") }
        }
        @JavascriptInterface fun backupPick() {
            runOnUiThread { try { startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*"), 91) } catch (e: Exception) {} }
        }
        @JavascriptInterface fun sttStart() { runOnUiThread { sttBegin() } }
        @JavascriptInterface fun sttStop() { runOnUiThread { stt?.stopListening() } }
        @JavascriptInterface fun key(name: String): String = Net.key(this@WebActivity, name)
        @JavascriptInterface fun setTheme(json: String) { this@WebActivity.getSharedPreferences("ox", android.content.Context.MODE_PRIVATE).edit().putString("wtheme", json).apply() }
        @JavascriptInterface fun tap(strong: Boolean) = Haptic.tap(this@WebActivity, strong)
        @JavascriptInterface fun hapticOn(): Boolean = Haptic.on(this@WebActivity)
        @JavascriptInterface fun setHaptic(v: Boolean) = Haptic.set(this@WebActivity, v)
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
            startActivity(Intent(this@WebActivity, MainActivity::class.java).putExtra("mode", mode).putExtra("sleep", sleepMin).putExtra("bus", busMin)); @Suppress("DEPRECATION") overridePendingTransition(0, 0)
        }
        /** 🧭 오늘 코스 듣기용: 매니저가 고른 문제 번호·약한 과목 {"refs":[…],"subs":[…]} */
        @JavascriptInterface fun setToday(json: String) { this@WebActivity.getSharedPreferences("ox", android.content.Context.MODE_PRIVATE).edit().putString("today", json).apply() }
        @JavascriptInterface fun openOx() = runOnUiThread { startActivity(Intent(this@WebActivity, MainActivity::class.java)); @Suppress("DEPRECATION") overridePendingTransition(0, 0) }

        /** 제미나이·챗GPT 앱에 질문 넘기기 (내 유료 구독으로 답 받기). 앱이 없으면 공유 창 */
        @JavascriptInterface fun askApp(pkg: String, text: String) {
            runOnUiThread {
                try { (getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager).setPrimaryClip(android.content.ClipData.newPlainText("질문", text)) } catch (e: Exception) {}
                val i = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
                try { startActivity(Intent(i).setPackage(pkg)) }
                catch (e: Exception) { try { startActivity(Intent.createChooser(i, "질문 보낼 앱")) } catch (x: Exception) {} }
            }
        }
        /** 국가법령정보센터 조문 가져오기 (law.go.kr 만 허용) */
        @JavascriptInterface fun httpGet(id: String, url: String) {
            io.execute {
                val (ok, text) = try {
                    val u = java.net.URL(url)
                    if (u.host != "www.law.go.kr" && u.host != "law.go.kr") throw Exception("허용 안 된 주소")
                    val c = u.openConnection() as java.net.HttpURLConnection
                    c.connectTimeout = 15000; c.readTimeout = 30000; c.setRequestProperty("User-Agent", "Mozilla/5.0")
                    true to c.inputStream.bufferedReader().readText()
                } catch (e: Exception) { false to (e.message ?: "실패") }
                js("__nb('$id',$ok,${JSONObject.quote(text)})")
            }
        }
        @JavascriptInterface fun gemini(id: String, model: String, body: String) {
            io.execute {
                val (ok, text) = try { true to Net.gemini(this@WebActivity, model, body) } catch (e: Exception) { false to (e.message ?: "실패") }
                js("__nb('$id',$ok,${JSONObject.quote(text)})")
            }
        }

        @JavascriptInterface fun speak(id: String, text: String, rate: Double) {
            val g = ttsGen.get()
            io.execute {
                try {
                    if (g != ttsGen.get()) return@execute               // 그사이 멈춤을 눌렀으면 만들지도 않기
                    val files = Net.speech(this@WebActivity, text)
                    runOnUiThread {
                        if (g != ttsGen.get()) return@runOnUiThread      // 소리를 받는 동안 멈춤을 눌렀으면 틀지 않기
                        speakId = id; allQueued = true
                        voice.setMediaItems(files.map { MediaItem.fromUri(Uri.fromFile(it)) })
                        voice.setPlaybackSpeed(rate.toFloat().coerceIn(0.5f, 2f)); voice.prepare(); voice.play()
                    }
                } catch (e: Exception) { runOnUiThread { speakId = id; done("error") } }
            }
        }
        /** 여러 줄을 한 번에 받아 앱이 끝까지 이어 읽기 — 화면이 꺼져 웹이 멈춰도 계속 읽힘 */
        @JavascriptInterface fun speakAll(id: String, linesJson: String, rate: Double) {
            val g = ttsGen.get()
            val arr = try { org.json.JSONArray(linesJson) } catch (e: Exception) { org.json.JSONArray() }
            runOnUiThread { speakId = id; allQueued = false; voice.stop(); voice.clearMediaItems(); voice.setPlaybackSpeed(rate.toFloat().coerceIn(0.5f, 2f)) }
            io.execute {
                var any = false
                for (k in 0 until arr.length()) {
                    if (g != ttsGen.get()) return@execute
                    val o = arr.optJSONObject(k) ?: continue
                    val files = try { Net.speech(this@WebActivity, o.optString("t")) } catch (e: Exception) { continue }   // 한 줄 실패는 건너뜀
                    val idx = o.optInt("i", k)
                    runOnUiThread {
                        if (g != ttsGen.get()) return@runOnUiThread
                        val ended = voice.playbackState == Player.STATE_ENDED || voice.mediaItemCount == 0
                        val from = voice.mediaItemCount
                        voice.addMediaItems(files.map { MediaItem.Builder().setUri(Uri.fromFile(it)).setMediaId("$idx").build() })
                        if (from == 0) { voice.prepare(); voice.play() }
                        else if (ended) { voice.seekTo(from, 0); voice.prepare(); voice.play() }   // 앞줄을 다 읽고 기다리던 중
                    }
                    any = true
                }
                runOnUiThread {
                    if (g != ttsGen.get()) return@runOnUiThread
                    allQueued = true
                    if (!any) done("error") else if (voice.playbackState == Player.STATE_ENDED || voice.mediaItemCount == 0) done("done")
                }
            }
        }
        @JavascriptInterface fun ttsPause() = runOnUiThread { voice.pause() }
        @JavascriptInterface fun ttsResume() = runOnUiThread { voice.play() }
        @JavascriptInterface fun ttsStop() { ttsGen.incrementAndGet(); runOnUiThread { speakId = null; voice.stop(); voice.clearMediaItems() } }
    }
}

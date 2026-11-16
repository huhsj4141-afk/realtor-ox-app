package kr.realtor.ox

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import android.view.KeyEvent
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.ConcatenatingMediaSource2
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.media3.exoplayer.source.SilenceMediaSource
import java.io.File
import java.util.Locale
import java.util.UUID

/**
 * 한 문항씩 재생: [차임+지문, 생각 시간(무음), 정답소리+해설, 끝 표시(짧은 무음)] 4칸.
 * 목소리: 폰 음성(TTS, 기본 삼성 엔진)으로 미리 파일을 만들어 두고 재생 → 첫 단어 지연 없음.
 * 리모컨(미디어 버튼)은 화면이 꺼져도 MediaSession 으로 들어옴.
 */
class PlayerService : Service() {
    companion object {
        var inst: PlayerService? = null
        const val CH = "ox"
        const val NID = 7
        const val SAMSUNG = "com.samsung.SMT"
    }

    lateinit var player: ExoPlayer
    private lateinit var cue: ExoPlayer
    private lateinit var session: MediaSession
    private val h = Handler(Looper.getMainLooper())
    private val prefs by lazy { getSharedPreferences("ox", Context.MODE_PRIVATE) }

    var queue: List<Item> = emptyList(); private set
    var trackIdx = 0; private set
    var bmOnly = false; private set
    var loadedQ = -1; private set
    var autoStopQ = -1; private set
    var preparing = false; private set

    var continuous: Boolean
        get() = prefs.getBoolean("cont", false)
        set(v) { prefs.edit().putBoolean("cont", v).apply() }
    var gapSec: Int
        get() = prefs.getInt("gap", 3)
        set(v) { prefs.edit().putInt("gap", v).apply(); loadedQ = -1 }
    var speed: Float
        get() = prefs.getFloat("speed", 1f)
        set(v) { prefs.edit().putFloat("speed", v).apply(); player.setPlaybackSpeed(v) }
    var voiceCue: Boolean
        get() = prefs.getBoolean("vcue", true)
        set(v) { prefs.edit().putBoolean("vcue", v).apply() }

    private var flash = ""
    private var flashUntil = 0L

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        inst = this
        Store.load(this)
        player = ExoPlayer.Builder(this).build().apply {
            setAudioAttributes(androidx.media3.common.AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).build(), true)
            setWakeMode(C.WAKE_MODE_LOCAL)
            setHandleAudioBecomingNoisy(true)
        }
        cue = ExoPlayer.Builder(this).build()
        player.addListener(object : Player.Listener {
            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                if (reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO && player.currentMediaItemIndex == 3) {
                    if (continuous) advance(true) else { player.pause(); autoStopQ = loadedQ }
                }
                updateSession()
            }
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (isPlaying) autoStopQ = -1
                updateSession()
            }
            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                say("flash", "재생 오류 — 다시 준비해요")
                val q = loadedQ; loadedQ = -1
                if (q >= 0) { fS(queue[q]).delete(); fE(queue[q]).delete(); go(q, 0, false) }
            }
        })
        session = MediaSession(this, "ox").apply {
            setCallback(object : MediaSession.Callback() {
                override fun onMediaButtonEvent(i: Intent): Boolean {
                    val ev: KeyEvent? = if (Build.VERSION.SDK_INT >= 33) i.getParcelableExtra(Intent.EXTRA_KEY_EVENT, KeyEvent::class.java)
                    else @Suppress("DEPRECATION") i.getParcelableExtra(Intent.EXTRA_KEY_EVENT)
                    return ev != null && handleKey(ev)
                }
                override fun onPlay() { center() }
                override fun onPause() { center() }
                override fun onSkipToNext() { stepR() }
                override fun onSkipToPrevious() { stepL() }
                override fun onStop() { player.pause() }
            })
            isActive = true
        }
        createChannel()
        val n = buildNotif()
        if (Build.VERSION.SDK_INT >= 29) startForeground(NID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        else startForeground(NID, n)
        player.setPlaybackSpeed(speed)
        initTts(prefs.getString("eng", SAMSUNG))
        bmOnly = prefs.getBoolean("bmOnly", false)
        load(prefs.getInt("ti", 0), bmOnly, prefs.getInt("q", 0), play = false)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            "L" -> stepL(); "R" -> stepR(); "C" -> center()
            "QUIT" -> { player.pause(); stopForeground(STOP_FOREGROUND_REMOVE); stopSelf() }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        inst = null
        try { tts?.shutdown() } catch (e: Exception) { }
        session.release(); player.release(); cue.release()
        super.onDestroy()
    }

    // ================= 폰 음성 (TTS) =================
    private var tts: TextToSpeech? = null
    var ttsReady = false; private set
    var engineName: String = ""; private set
    private val waiting = HashMap<String, (Boolean) -> Unit>()
    private val pendingInit = ArrayList<() -> Unit>()

    private fun initTts(engine: String?) {
        ttsReady = false
        try { tts?.shutdown() } catch (e: Exception) { }
        val listener = TextToSpeech.OnInitListener { st ->
            h.post {
                if (st != TextToSpeech.SUCCESS) {
                    if (engine != null) { initTts(null); return@post }   // 삼성 엔진이 없으면 기본 엔진
                    say("flash", "폰 음성을 쓸 수 없어요"); return@post
                }
                val t = tts ?: return@post
                engineName = engine ?: (t.defaultEngine ?: "")
                t.language = Locale.KOREAN
                val want = prefs.getString("voice", null)
                val v = koVoices(t).firstOrNull { it.name == want } ?: koVoices(t).firstOrNull()
                if (v != null) t.voice = v
                t.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(id: String?) {}
                    override fun onDone(id: String?) { h.post { waiting.remove(id)?.invoke(true) } }
                    @Deprecated("old") override fun onError(id: String?) { h.post { waiting.remove(id)?.invoke(false) } }
                    override fun onError(id: String?, code: Int) { h.post { waiting.remove(id)?.invoke(false) } }
                })
                ttsReady = true
                val p = ArrayList(pendingInit); pendingInit.clear(); p.forEach { it() }
            }
        }
        tts = if (engine != null) TextToSpeech(applicationContext, listener, engine) else TextToSpeech(applicationContext, listener)
    }

    fun koVoices(t: TextToSpeech): List<Voice> = try {
        (t.voices ?: emptySet()).filter { it.locale.language == "ko" || it.locale.language == "kor" }
            .sortedWith(compareBy({ it.isNetworkConnectionRequired }, { it.name }))
    } catch (e: Exception) { emptyList() }

    fun currentVoiceName(): String = try { tts?.voice?.name ?: "" } catch (e: Exception) { "" }

    fun setVoice(engine: String, voice: String) {
        prefs.edit().putString("eng", engine).putString("voice", voice).apply()
        loadedQ = -1
        if (engine != engineName) initTts(engine)
        else tts?.let { t -> koVoices(t).firstOrNull { it.name == voice }?.let { t.voice = it } }
    }

    private fun dir(): File {
        val d = File(cacheDir, "tts/" + (engineName + "_" + currentVoiceName()).replace(Regex("[^A-Za-z0-9_.-]"), "_"))
        d.mkdirs(); return d
    }

    fun clean(s: String): String = s
        .replace(Regex("\\(([^()]*[\\u4e00-\\u9fff][^()]*)\\)"), "")
        .replace(Regex("\\(\\s*[A-Za-z][^()]*\\)"), "")
        .replace("ㆍ", ", ").replace("·", ", ").replace("․", ", ")
        .replace(Regex("[①②③④⑤]"), "")
        .replace(Regex("\\s+"), " ").trim()

    /** 글을 음성 파일로 (이미 있으면 바로) */
    private fun synth(text: String, f: File, cb: (Boolean) -> Unit) {
        if (f.exists() && f.length() > 100) { cb(true); return }
        if (!ttsReady) { pendingInit.add { synth(text, f, cb) }; return }
        val t = tts ?: return cb(false)
        val tmp = File(f.path + ".tmp")
        val id = UUID.randomUUID().toString()
        waiting[id] = { ok -> if (ok && tmp.exists()) tmp.renameTo(f); cb(ok && f.exists()) }
        val r = t.synthesizeToFile(text, Bundle(), tmp, id)
        if (r != TextToSpeech.SUCCESS) { waiting.remove(id); cb(false) }
    }

    private fun fS(it: Item) = File(dir(), "s_${it.key}.wav")
    private fun fE(it: Item) = File(dir(), "e_${it.key}.wav")

    private fun ready(q: Int, cb: (Boolean) -> Unit) {
        val it = queue.getOrNull(q) ?: return cb(false)
        synth(clean(it.s), fS(it)) { a ->
            if (it.exp.isBlank()) cb(a) else synth(clean(it.exp), fE(it)) { b -> cb(a && b) }
        }
    }

    private fun prefetch(q: Int) { if (q in queue.indices) ready(q) { } }

    // ================= 재생 목록 =================
    private val dsf by lazy { DefaultDataSource.Factory(this) }
    private fun src(uri: String): MediaSource = ProgressiveMediaSource.Factory(dsf).createMediaSource(MediaItem.fromUri(Uri.parse(uri)))
    private fun asset(p: String) = src("asset:///$p")
    private fun file(f: File) = src(Uri.fromFile(f).toString())
    private fun concat(vararg s: MediaSource): MediaSource {
        val b = ConcatenatingMediaSource2.Builder()
        s.forEach { b.add(it, C.TIME_UNSET) }
        return b.build()
    }

    private fun slots(q: Int): List<MediaSource> {
        val it = queue[q]
        val ans = asset(if (it.o) "snd/ding.wav" else "snd/ttaeng.wav")
        val s = fS(it); val e = fE(it)
        val stmt = if (s.exists()) concat(asset("snd/chime.wav"), asset("snd/gap.wav"), file(s)) else asset("snd/chime.wav")
        val exp = if (e.exists()) concat(ans, asset("snd/gap.wav"), file(e)) else ans
        return listOf(stmt, SilenceMediaSource(gapSec * 1_000_000L), exp, SilenceMediaSource(150_000L))
    }

    fun bookmarks(): MutableSet<String> = HashSet(prefs.getStringSet("bm", emptySet()) ?: emptySet())

    fun load(ti: Int, onlyBm: Boolean, q: Int, play: Boolean) {
        trackIdx = ti.coerceIn(0, Store.tracks.size - 1); bmOnly = onlyBm
        queue = if (onlyBm) {
            val b = bookmarks(); Store.tracks.flatMap { it.items }.filter { b.contains(it.key) }
        } else Store.tracks[trackIdx].items
        if (queue.isEmpty()) { bmOnly = false; queue = Store.tracks[trackIdx].items; say("flash", "북마크가 없어요") }
        prefs.edit().putInt("ti", trackIdx).putBoolean("bmOnly", bmOnly).apply()
        loadedQ = -1
        go(q.coerceIn(0, queue.size - 1), 0, play)
    }

    private var goSeq = 0
    /** q번 문항의 k칸으로 이동 (목소리 파일이 없으면 만들고 나서) */
    fun go(q: Int, k: Int, play: Boolean = true) {
        if (q !in queue.indices) return
        val my = ++goSeq
        autoStopQ = -1
        preparing = true
        if (play && player.isPlaying) player.pause()
        ready(q) { _ ->
            if (my != goSeq) return@ready
            preparing = false
            if (loadedQ != q) {
                player.setMediaSources(slots(q), k, 0); player.prepare(); loadedQ = q
            } else player.seekTo(k, 0)
            prefs.edit().putInt("q", q).apply()
            if (play) player.play()
            updateSession()
            prefetch(q + 1); prefetch(q + 2)
        }
    }

    /** 다음 문항으로 (트랙 끝이면 다음 과목) */
    private fun advance(play: Boolean) {
        val q = loadedQ
        when {
            q + 1 < queue.size -> go(q + 1, 0, play)
            !bmOnly && trackIdx + 1 < Store.tracks.size -> load(trackIdx + 1, false, 0, play)
            else -> { player.pause(); autoStopQ = q; say("last", "마지막 지문이에요") }
        }
    }

    fun phase(): Pair<Int, Char> {
        val q = loadedQ.coerceAtLeast(0)
        if (autoStopQ >= 0 && !player.isPlaying) return autoStopQ to 'E'
        return q to (if (player.currentMediaItemIndex <= 1) 'S' else 'E')
    }

    fun currentItem(): Item? = queue.getOrNull(phase().first)

    // ================= 안내 음성 =================
    fun say(name: String, text: String, then: (() -> Unit)? = null) {
        flash = text; flashUntil = SystemClock.elapsedRealtime() + 2500
        if (name == "flash" || !voiceCue) { then?.invoke(); return }
        if (then != null && player.isPlaying) player.pause()
        val f = File(dir(), "cue_$name.wav")
        synth(text.replace("★", "").trim(), f) { ok ->
            if (!ok) { then?.invoke(); return@synth }
            cue.setMediaItem(MediaItem.fromUri(Uri.fromFile(f))); cue.setPlaybackSpeed(maxOf(1.1f, speed)); cue.prepare()
            var done = false
            cue.addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(s: Int) {
                    if (s == Player.STATE_ENDED && !done) { done = true; cue.removeListener(this); then?.invoke() }
                }
                override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                    if (!done) { done = true; cue.removeListener(this); then?.invoke() }
                }
            })
            cue.play()
        }
    }

    fun flashText(): String = if (SystemClock.elapsedRealtime() < flashUntil) flash else if (preparing) "목소리 준비 중…" else ""

    // ================= 동작 =================
    fun stepR() {
        if (queue.isEmpty()) return
        val (q, ph) = phase()
        if (ph == 'S') { say("exp", "현재 지문 해설") { go(q, 2) }; return }
        if (q + 1 < queue.size) { say("next", "다음 지문") { go(q + 1, 0) }; return }
        if (!bmOnly && trackIdx + 1 < Store.tracks.size) { say("nextpart", "다음 과목") { load(trackIdx + 1, false, 0, true) }; return }
        say("last", "마지막 지문이에요")
    }

    private var lastL = 0L
    private var lastLPh = ' '
    fun stepL() {
        if (queue.isEmpty()) return
        val (q, ph) = phase()
        val now = SystemClock.elapsedRealtime()
        val dbl = now - lastL < 800 && lastLPh == 'S'
        lastL = now; lastLPh = ph
        if (dbl) {
            lastL = 0
            when {
                q > 0 -> say("prev", "이전 지문") { go(q - 1, 0) }
                !bmOnly && trackIdx > 0 -> say("prev", "이전 지문") { load(trackIdx - 1, false, Store.tracks[trackIdx - 1].items.size - 1, true) }
                else -> say("first", "첫 지문이에요") { go(0, 0) }
            }
            return
        }
        if (ph == 'E') { go(q, 2); return }            // 정답 소리부터 해설 다시
        lastLPh = 'S'
        say("restart", "현재 지문 처음부터") { go(q, 0) }
    }

    private var cCount = 0
    private val cFire = Runnable { val n = cCount; cCount = 0; if (n >= 2) bookmark() else toggle() }
    fun center() {
        cCount++
        h.removeCallbacks(cFire)
        if (cCount >= 2) cFire.run() else h.postDelayed(cFire, 650)
    }

    fun toggle() {
        when {
            player.isPlaying -> { player.pause(); say("stop", "정지") }
            autoStopQ >= 0 -> advance(true)                      // 한 문항 끝난 뒤 재생 = 다음 문항
            loadedQ < 0 || player.playbackState == Player.STATE_IDLE || player.playbackState == Player.STATE_ENDED -> go(phase().first, 0)
            else -> player.play()
        }
    }

    fun bookmark() {
        val it = currentItem() ?: return
        val b = bookmarks()
        val on = if (b.contains(it.key)) { b.remove(it.key); false } else { b.add(it.key); true }
        prefs.edit().putStringSet("bm", b).apply()
        say(if (on) "bookmark" else "unbookmark", if (on) "★ 북마크" else "북마크 해제")
    }

    fun jump(q: Int) { if (q in queue.indices) go(q, 0, player.isPlaying) }

    fun handleKey(ev: KeyEvent): Boolean {
        val c = ev.keyCode
        val ours = c == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE || c == KeyEvent.KEYCODE_HEADSETHOOK || c == KeyEvent.KEYCODE_MEDIA_PLAY ||
            c == KeyEvent.KEYCODE_MEDIA_PAUSE || c == KeyEvent.KEYCODE_MEDIA_NEXT || c == KeyEvent.KEYCODE_MEDIA_PREVIOUS ||
            c == KeyEvent.KEYCODE_MEDIA_FAST_FORWARD || c == KeyEvent.KEYCODE_MEDIA_REWIND || c == KeyEvent.KEYCODE_MEDIA_STOP
        if (!ours) return false
        if (ev.action != KeyEvent.ACTION_DOWN || ev.repeatCount > 0) return true
        when (c) {
            KeyEvent.KEYCODE_MEDIA_NEXT, KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> stepR()
            KeyEvent.KEYCODE_MEDIA_PREVIOUS, KeyEvent.KEYCODE_MEDIA_REWIND -> stepL()
            KeyEvent.KEYCODE_MEDIA_STOP -> player.pause()
            else -> center()
        }
        return true
    }

    // ================= 알림·세션 =================
    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            getSystemService(NotificationManager::class.java)
                .createNotificationChannel(NotificationChannel(CH, "OX 듣기", NotificationManager.IMPORTANCE_LOW))
        }
    }

    private fun pi(a: String, code: Int): PendingIntent =
        PendingIntent.getService(this, code, Intent(this, PlayerService::class.java).setAction(a),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    private fun buildNotif(): Notification {
        val it = currentItem()
        val title = if (bmOnly) "★ 북마크" else Store.tracks.getOrNull(trackIdx)?.name ?: "OX 듣기"
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CH) else @Suppress("DEPRECATION") Notification.Builder(this)
        val playing = this::player.isInitialized && player.isPlaying
        return b.setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(title)
            .setContentText(it?.s ?: "")
            .setContentIntent(open)
            .setOngoing(true)
            .addAction(Notification.Action.Builder(null, "◀ 처음부터", pi("L", 1)).build())
            .addAction(Notification.Action.Builder(null, if (playing) "⏸ 정지" else "▶ 재생", pi("C", 2)).build())
            .addAction(Notification.Action.Builder(null, "▶▶ 다음", pi("R", 3)).build())
            .addAction(Notification.Action.Builder(null, "종료", pi("QUIT", 4)).build())
            .setStyle(Notification.MediaStyle().setMediaSession(session.sessionToken).setShowActionsInCompactView(0, 1, 2))
            .build()
    }

    private fun updateSession() {
        if (!this::session.isInitialized) return
        val playing = player.isPlaying
        session.setPlaybackState(PlaybackState.Builder()
            .setActions(PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE or
                PlaybackState.ACTION_SKIP_TO_NEXT or PlaybackState.ACTION_SKIP_TO_PREVIOUS or PlaybackState.ACTION_STOP)
            .setState(if (playing) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED, player.currentPosition, if (playing) speed else 0f)
            .build())
        val it = currentItem()
        session.setMetadata(MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, it?.s ?: "OX 듣기")
            .putString(MediaMetadata.METADATA_KEY_ARTIST, if (bmOnly) "★ 북마크" else Store.tracks.getOrNull(trackIdx)?.name ?: "")
            .build())
        try { getSystemService(NotificationManager::class.java).notify(NID, buildNotif()) } catch (e: Exception) { }
    }
}

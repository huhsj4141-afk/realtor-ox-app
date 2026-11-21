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
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.view.KeyEvent
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.media3.exoplayer.source.SilenceMediaSource

/**
 * 한 문항 = [차임+지문, 생각 시간, 정답소리+해설, 끝 표시] 4칸 (모두 녹음 파일).
 * 리모컨 미디어 버튼은 화면이 꺼져도 MediaSession 으로 들어와요.
 */
class PlayerService : Service() {
    companion object {
        var inst: PlayerService? = null
        const val CH = "ox"
        const val NID = 7
    }

    lateinit var player: ExoPlayer
    private lateinit var cue: ExoPlayer
    private lateinit var session: MediaSession
    private val h = Handler(Looper.getMainLooper())
    val prefs by lazy { getSharedPreferences("ox", Context.MODE_PRIVATE) }

    var queue: List<Item> = emptyList(); private set
    var trackIdx = 0; private set
    /** 듣는 목록: all(과목 순서) / bm(★ 북마크) / wrong(틀린 문제) / review(오늘 복습) */
    var mode = "all"; private set
    val isList get() = mode != "all"
    private var loadedQ = -1
    private var autoStopQ = -1
    private var changingQueue = false
    private var checkpointTicks = 0
    private val detailRequests = LatestRequest()
    private val cueRequests = LatestRequest()
    private var cueListener: Player.Listener? = null
    private var destroyed = false

    var continuous: Boolean
        get() = prefs.getBoolean("cont", false)
        set(v) { prefs.edit().putBoolean("cont", v).apply() }
    var gapSec: Int
        get() = prefs.getInt("gap", 3)
        set(v) { prefs.edit().putInt("gap", v).apply(); val q = phase().first; loadedQ = -1; go(q, 0, false) }
    var speed: Float
        get() = prefs.getFloat("speed", 1f)
        set(v) { prefs.edit().putFloat("speed", v).apply(); player.setPlaybackSpeed(v) }
    var voiceCue: Boolean
        get() = prefs.getBoolean("vcue", true)
        set(v) { prefs.edit().putBoolean("vcue", v).apply() }

    fun mapOf(slot: String): String =
        prefs.getString("map_$slot", null) ?: Remote.SLOTS.first { it.first == slot }.third
    fun setMap(slot: String, action: String) { prefs.edit().putString("map_$slot", action).apply() }
    fun resetMap() { prefs.edit().apply { prefs.all.keys.filter { it.startsWith("map_") || it.startsWith("key_") && it.removePrefix("key_").toIntOrNull() != null }.forEach { remove(it) } }.apply() }   // 옛 버전 키 기록도 정리
    /** 키 신호 번호 → 칸 (링 리모컨 길게 누르기 = 표준 미디어 키) */
    private fun slotOf(code: Int): String? = Remote.KEYS[code]
    var lastKey = ""

    var detailText = ""; var detailKey = ""
    private var flash = ""
    private var flashUntil = 0L
    fun flashText(): String = if (SystemClock.elapsedRealtime() < flashUntil) flash else ""

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        if (prefs.getInt("mapv", 0) < 3) { resetMap(); prefs.edit().putInt("mapv", 3).apply() }   // 새 기본 매핑 적용
        super.onCreate()
        inst = this
        Store.load(this)
        player = ExoPlayer.Builder(this).build().apply {
            setAudioAttributes(androidx.media3.common.AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).build(), true)
            setWakeMode(C.WAKE_MODE_LOCAL)
            setHandleAudioBecomingNoisy(true)
            setPlaybackSpeed(speed)
        }
        cue = ExoPlayer.Builder(this).build()
        player.addListener(object : Player.Listener {
            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                if (reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO && player.currentMediaItemIndex == 3) {
                    queue.getOrNull(loadedQ)?.let { done(it) }
                    if (continuous) advance() else { player.pause(); autoStopQ = loadedQ }
                }
                updateSession()
            }
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (isPlaying) { autoStopQ = -1; fg() } else { savePosition(); flushSeconds() }
                updateSession()
            }
        })
        session = MediaSession(this, "ox").apply {
            setCallback(object : MediaSession.Callback() {
                override fun onMediaButtonEvent(i: Intent): Boolean {
                    val ev: KeyEvent? = if (Build.VERSION.SDK_INT >= 33) i.getParcelableExtra(Intent.EXTRA_KEY_EVENT, KeyEvent::class.java)
                    else @Suppress("DEPRECATION") i.getParcelableExtra(Intent.EXTRA_KEY_EVENT)
                    return ev != null && handleKey(ev)
                }
                override fun onPlay() { if (!player.isPlaying) act("toggle") }
                override fun onPause() { stopCue(); detailRequests.cancel(); player.pause() }
                override fun onSkipToNext() = press("r")
                override fun onSkipToPrevious() = press("l")
                override fun onStop() { stopCue(); detailRequests.cancel(); player.pause() }
            })
            // 앱이 꺼져 있어도 리모컨 버튼을 이 앱이 받도록
            setMediaButtonReceiver(PendingIntent.getBroadcast(this@PlayerService, 9,
                Intent(Intent.ACTION_MEDIA_BUTTON).setClass(this@PlayerService, ButtonReceiver::class.java), PendingIntent.FLAG_IMMUTABLE))
            isActive = true
        }
        createChannel()
        fg()
        load(prefs.getInt("ti", 0), prefs.getString("mode", "all")!!, prefs.getInt("q", 0), false, resume = true)
        h.post(tick)
    }

    private var isFg = false
    private fun fg(force: Boolean = false) {
        if (isFg && !force) return
        try {
            val n = buildNotif()
            if (Build.VERSION.SDK_INT >= 29) startForeground(NID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            else startForeground(NID, n)
            isFg = true
        } catch (e: Exception) { }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        fg(true)    // startForegroundService 로 불렸으면 5초 안에 꼭 다시 알려야 함(안 하면 앱이 강제 종료)
        when (intent?.action) {
            "L" -> act("stepBack"); "R" -> act("stepFwd"); "C" -> act("toggle")
            "PRESET" -> {   // 상황별 학습에서: 듣는 목록·잠자기 타이머를 정하고 바로 시작
                detailRequests.cancel(); stopCue()
                fg()
                val m = intent.getStringExtra("mode") ?: "mix"
                if (mode == m && m !in setOf("bm", "wrong", "review", "today") && loadedQ in queue.indices) {
                    if (autoStopQ >= 0) advance() else player.play()
                } else load(trackIdx, m, 0, true, resume = true)
                setSleep(intent.getIntExtra("sleep", 0))
                setBus(intent.getIntExtra("bus", 0))
            }
            "WAKE" -> {      // 앱이 꺼진 상태에서 리모컨: 가운데 = 바로 재생, 나머지 = 준비됐다고 알려 주기
                fg()
                if (intent.getStringExtra("slot") == "c") act("toggle") else say("ready", "🎧 OX 듣기 준비됐어요")
                openScreen()
            }
            "QUIT" -> { player.pause(); stopForeground(STOP_FOREGROUND_REMOVE); isFg = false; stopSelf() }
            else -> fg()
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        destroyed = true
        detailRequests.cancel(); stopCue()
        savePosition(); flushSeconds()
        inst = null
        h.removeCallbacksAndMessages(null)
        if (::session.isInitialized) session.release()
        if (::player.isInitialized) player.release()
        if (::cue.isInitialized) cue.release()
        super.onDestroy()
    }

    // ================= 재생 목록 =================
    private val dsf by lazy { DefaultDataSource.Factory(this) }
    private fun asset(p: String): MediaSource =
        ProgressiveMediaSource.Factory(dsf).createMediaSource(MediaItem.fromUri(Uri.parse("asset:///$p")))

    private fun stmtSrc(it: Item): MediaSource {
        val s = asset("a/t${it.ti}_${it.i}_s.ogg")
        if ("t${it.ti}_${it.i}_c.ogg" !in Store.hasCtxAudio) return s
        return androidx.media3.exoplayer.source.ConcatenatingMediaSource2.Builder()
            .add(asset("a/t${it.ti}_${it.i}_c.ogg"), 15_000L).add(s, 8_000L).build()   // 길이는 읽으면서 실제 값으로 바뀜
    }
    private fun slots(it: Item): List<MediaSource> = listOf(
        stmtSrc(it), SilenceMediaSource(gapSec * 1_000_000L),
        asset("a/t${it.ti}_${it.i}_e.ogg"), SilenceMediaSource(150_000L))

    fun bookmarks(): MutableSet<String> = HashSet(prefs.getStringSet("bm", emptySet()) ?: emptySet())

    /** 북마크 + 틀린 문제 지문 (복습 대상) */
    private fun reviewKeys(): Set<String> {
        val w = Study.wrong(this)
        return bookmarks() + Store.tracks.flatMap { it.items }.filter { w.contains(it.ref) }.map { it.key }
    }
    fun itemsOf(m: String): List<Item> {
        val all = Store.tracks.flatMap { it.items }
        return when (m) {
            "bm" -> bookmarks().let { b -> all.filter { b.contains(it.key) } }
            "wrong" -> Study.wrong(this).let { w -> all.filter { w.contains(it.ref) } }
            "review" -> Study.dueOf(this, reviewKeys()).let { d -> all.filter { d.contains(it.key) } }
            "mix" -> Study.mix(this, Store.tracks)
            "today" -> {   // 🧭 오늘 코스: 매니저가 고른 문제(틀린·복습·약점)와 약한 과목부터, 그다음 골고루
                val j = try { org.json.JSONObject(getSharedPreferences("ox", MODE_PRIVATE).getString("today", "{}")!!) } catch (e: Exception) { org.json.JSONObject() }
                val refs = (0 until (j.optJSONArray("refs")?.length() ?: 0)).map { j.getJSONArray("refs").getString(it) }.toSet()
                val subs = (0 until (j.optJSONArray("subs")?.length() ?: 0)).map { j.getJSONArray("subs").getInt(it) }
                val first = all.filter { refs.contains(it.ref) }
                val mix = Study.mix(this, Store.tracks, 200)
                val weak = mix.filter { Store.tracks[it.ti].sub in subs }
                (first + weak + mix).distinctBy { it.key }.take(60)
            }
            else -> Store.tracks[trackIdx].items
        }
    }
    val LIST_NAMES = kotlin.collections.mapOf("mix" to "🔀 골고루 섞기", "bm" to "★ 북마크", "wrong" to "❌ 틀린 문제", "review" to "🔁 오늘 복습", "today" to "🧭 오늘 코스")

    // 목록마다 문항·구간·초를 보관. 섞기 목록도 같은 순서로 이어져요.
    private fun contentIdentity(item: Item) = PlaybackResume.identity(item.ref, item.s, item.exp)

    private fun resumeKey(ti: Int, m: String) = "resume_" + if (m == "all") "all_$ti" else m

    private fun savePosition() {
        if (!::player.isInitialized || changingQueue || loadedQ !in queue.indices || player.mediaItemCount == 0) return
        val slot = player.currentMediaItemIndex.coerceIn(0, 3)
        val j = org.json.JSONObject().put("item", queue[loadedQ].key)
            .put("content", contentIdentity(queue[loadedQ]))
            .put("slot", slot).put("ms", player.currentPosition.coerceAtLeast(0L))
            .put("finished", autoStopQ >= 0 || slot == 3)
            .put("items", org.json.JSONArray(queue.map { it.key }))
        prefs.edit().putString(resumeKey(trackIdx, mode), j.toString()).apply()
    }

    fun load(ti: Int, m: String, q: Int, play: Boolean, resume: Boolean = false) {
        detailRequests.cancel(); stopCue()
        savePosition()
        changingQueue = true
        try {
            if (Store.tracks.isEmpty()) { queue = emptyList(); loadedQ = -1; player.clearMediaItems(); return }
            trackIdx = ti.coerceIn(0, Store.tracks.size - 1); mode = m
            val saved = if (resume) try {
                prefs.getString(resumeKey(trackIdx, m), null)?.let { org.json.JSONObject(it) }
            } catch (e: Exception) { null } else null
            queue = itemsOf(m)
            if (saved != null && m != "all" && m != "today") {
                val eligible = if (m == "mix") Store.tracks.flatMap { it.items } else queue
                val keys = saved.optJSONArray("items")
                val previous = (0 until (keys?.length() ?: 0)).map { keys!!.optString(it) }
                queue = PlaybackResume.order(eligible, previous, saved.optString("item"), m != "mix") { it.key }
            }
            if (queue.isEmpty()) { if (m != "all") note(LIST_NAMES[m] + " 목록이 비어 있어요", 4000); mode = "all"; queue = Store.tracks[trackIdx].items }
            if (queue.isEmpty()) { loadedQ = -1; player.clearMediaItems(); return }
            prefs.edit().putInt("ti", trackIdx).putString("mode", mode).apply()
            val index = if (mode == m) queue.indexOfFirst { it.key == saved?.optString("item") } else -1
            val found = index >= 0 && saved!!.optString("content") == contentIdentity(queue[index])
            val slot = if (found) saved!!.optInt("slot", 0).coerceIn(0, 3) else 0
            loadedQ = -1
            go(if (index >= 0) index else q.coerceIn(0, queue.size - 1), slot, false,
                if (found) saved!!.optLong("ms", 0).coerceAtLeast(0L) else 0L)
            if (found && (saved!!.optBoolean("finished", false) || slot == 3)) autoStopQ = loadedQ
        } finally { changingQueue = false }
        savePosition()
        if (play) { if (autoStopQ >= 0) advance() else player.play() }
    }

    /** q번 문항의 k칸으로 이동. 이어듣기일 때만 저장한 초를 넘겨요. */
    fun go(q: Int, k: Int, play: Boolean = true, positionMs: Long = 0L) {
        if (q !in queue.indices) return
        detailRequests.cancel(); stopCue()
        autoStopQ = -1
        val wasChanging = changingQueue; changingQueue = true
        try {
            player.pause()
            if (loadedQ != q) {
                loadedQ = q
                player.setMediaSources(slots(queue[q]), k, positionMs); player.prepare()
            } else player.seekTo(k, positionMs)
            prefs.edit().putInt("q", q).apply()
        } finally { changingQueue = wasChanging }
        savePosition()
        if (play) player.play()
        updateSession()
    }

    private fun advance() {
        val q = loadedQ
        when {
            q + 1 < queue.size -> go(q + 1, 0)
            !isList && trackIdx + 1 < Store.tracks.size -> say("nextpart", "다음 과목") { load(trackIdx + 1, "all", 0, true) }
            else -> { player.pause(); autoStopQ = q; say("last", "마지막 지문이에요") }
        }
    }

    /** 지금 단계: 문항 번호와 지문(S)/해설(E). 한 문항 끝나 멈춘 상태는 해설 단계로 봐요 */
    fun phase(): Pair<Int, Char> {
        if (autoStopQ >= 0 && !player.isPlaying) return autoStopQ to 'E'
        return loadedQ.coerceAtLeast(0) to (if (player.currentMediaItemIndex <= 1) 'S' else 'E')
    }

    fun currentItem(): Item? = queue.getOrNull(phase().first)

    // ================= 안내 음성 =================
    private fun note(t: String, ms: Long = 2500) { flash = t; flashUntil = SystemClock.elapsedRealtime() + ms }

    private fun stopCue() {
        cueRequests.cancel()
        if (::cue.isInitialized) {
            cueListener?.let { cue.removeListener(it) }
            cueListener = null
            cue.stop()
        }
    }

    private fun say(name: String, text: String, then: (() -> Unit)? = null) {
        stopCue()
        val token = cueRequests.next()
        note(text)
        if (!voiceCue) { then?.invoke(); return }
        if (then != null && player.isPlaying) player.pause()
        cue.setMediaItem(MediaItem.fromUri(Uri.parse("asset:///cue/$name.ogg")))
        cue.setPlaybackSpeed(maxOf(1.1f, speed)); cue.prepare()
        var done = false
        val listener = object : Player.Listener {
            private fun end() { if (!done) { done = true; cue.removeListener(this); cueListener = null; if (!destroyed && cueRequests.current(token)) then?.invoke() } }
            override fun onPlaybackStateChanged(s: Int) { if (s == Player.STATE_ENDED) end() }
            override fun onPlayerError(error: androidx.media3.common.PlaybackException) = end()
        }
        cueListener = listener
        cue.addListener(listener)
        cue.play()
    }

    // ================= 동작 =================
    fun act(a: String) {
        detailRequests.cancel(); stopCue()
        if (queue.isEmpty()) return
        val (q, ph) = phase()
        when (a) {
            "toggle" -> when {
                player.isPlaying -> { player.pause(); say("stop", "정지") }
                autoStopQ >= 0 -> advance()                    // 한 문항 끝난 뒤 재생 = 다음 문항
                else -> { if (player.playbackState == Player.STATE_IDLE || player.playbackState == Player.STATE_ENDED) go(q, 0) else player.play() }
            }
            "stepBack" -> when {
                ph == 'E' -> say("cur", "현재 지문") { go(q, 0) }
                q > 0 -> say("prevexp", "이전 해설") { go(q - 1, 2) }
                else -> say("cur", "현재 지문") { go(0, 0) }
            }
            "itemPrev" -> when {
                q > 0 -> say("prev", "이전 지문") { go(q - 1, 0) }
                !isList && trackIdx > 0 -> say("prev", "이전 지문") { load(trackIdx - 1, "all", Store.tracks[trackIdx - 1].items.size - 1, true) }
                else -> say("first", "첫 지문이에요") { go(0, 0) }
            }
            "itemNext" -> when {
                q + 1 < queue.size -> say("next", "다음 지문") { go(q + 1, 0) }
                !isList && trackIdx + 1 < Store.tracks.size -> say("nextpart", "다음 과목") { load(trackIdx + 1, "all", 0, true) }
                else -> say("last", "마지막 지문이에요")
            }
            "stepFwd" -> when {
                ph == 'S' || (autoStopQ >= 0 && !player.isPlaying) -> say("curexp", "현재 해설") { go(q, 2) }
                q + 1 < queue.size -> say("next", "다음 지문") { go(q + 1, 0) }
                !isList && trackIdx + 1 < Store.tracks.size -> say("nextpart", "다음 과목") { load(trackIdx + 1, "all", 0, true) }
                else -> say("last", "마지막 지문이에요")
            }
            "detail" -> {
                val token = detailRequests.next()
                val it = currentItem() ?: return
                if (player.isPlaying) player.pause()
                note("🤖 더 자세히 준비 중…", 120000); detailText = ""
                Thread {
                    try {
                        val t = Net.detail(this, it)
                        if (!detailRequests.current(token)) return@Thread
                        h.post { if (!destroyed && detailRequests.current(token)) { detailText = t; detailKey = it.key; note("🤖 음성 만드는 중…", 120000) } }
                        val files = Net.speech(this, t)
                        h.post { if (destroyed || !detailRequests.current(token)) return@post
                            note("")
                            cue.setMediaItems(files.map { f -> MediaItem.fromUri(Uri.fromFile(f)) }); cue.setPlaybackSpeed(speed); cue.prepare(); cue.play() }
                    } catch (e: Exception) { h.post { if (!destroyed && detailRequests.current(token)) note("더 자세히 실패: " + Net.friendly(e), 15000) } }
                }.start()
            }
            "bookmark" -> {
                val it = currentItem() ?: return
                val b = bookmarks()
                val on = if (b.contains(it.key)) { b.remove(it.key); false } else { b.add(it.key); true }
                prefs.edit().putStringSet("bm", b).apply()
                say(if (on) "bookmark" else "unbookmark", if (on) "★ 북마크" else "북마크 해제")
            }
        }
    }

    // ================= 공부 기록 =================
    /** 한 지문을 해설까지 다 들음 */
    private fun done(it: Item) {
        Study.addOx(this, Store.tracks[it.ti].sub)
        Study.heardOnce(this, it.key)
        if (reviewKeys().contains(it.key)) Study.heard(this, it.key)
    }

    // ================= 타이머: 잠자기 · 하차 알림 =================
    var sleepEnd = 0L; private set      // elapsedRealtime, 0 = 꺼짐
    var busEnd = 0L; private set
    var alerting = false; private set
    private var busWarned = false
    private var secAcc = 0
    private fun flushSeconds() { if (secAcc > 0) { val seconds = secAcc; secAcc = 0; Study.addSec(this, seconds) } }
    fun setSleep(min: Int) { sleepEnd = if (min > 0) SystemClock.elapsedRealtime() + min * 60_000L else 0; player.volume = 1f
        note(if (min > 0) "⏲ ${min}분 뒤 멈춰요" else "⏲ 잠자기 타이머 끔") }
    fun setBus(min: Int) { busEnd = if (min > 0) SystemClock.elapsedRealtime() + min * 60_000L else 0; busWarned = false
        if (alerting) stopAlert()
        note(if (min > 0) "🚌 ${min}분 뒤 하차 알림" else "🚌 하차 알림 끔") }
    fun left(end: Long) = if (end == 0L) 0 else ((end - SystemClock.elapsedRealtime()) / 1000).toInt().coerceAtLeast(0)

    private val vib by lazy {
        if (Build.VERSION.SDK_INT >= 31) getSystemService(android.os.VibratorManager::class.java).defaultVibrator
        else @Suppress("DEPRECATION") getSystemService(VIBRATOR_SERVICE) as android.os.Vibrator
    }
    private fun buzz(ms: LongArray) = try {
        if (Build.VERSION.SDK_INT >= 26) vib.vibrate(android.os.VibrationEffect.createWaveform(ms, -1)) else @Suppress("DEPRECATION") vib.vibrate(ms, -1)
    } catch (e: Exception) { }

    private var alertN = 0
    private val alertLoop = object : Runnable { override fun run() {
        if (!alerting) return
        if (++alertN > 25) { stopAlert(); return }             // 약 3분 동안 반복
        buzz(longArrayOf(0, 700, 300, 700, 300, 700))
        say("busalert", "🚌 내릴 때가 됐어요 (아무 버튼이나 누르면 꺼져요)")
        h.postDelayed(this, 8000)
    } }
    private fun startAlert() { alerting = true; alertN = 0; if (player.isPlaying) player.pause(); h.post(alertLoop) }
    fun stopAlert() { alerting = false; h.removeCallbacks(alertLoop); try { vib.cancel() } catch (e: Exception) { }; note("🚌 하차 알림 끔") }

    /** 1초마다: 듣기 시간 기록, 타이머 확인 */
    private val tick = object : Runnable { override fun run() {
        h.postDelayed(this, 1000)
        if (player.isPlaying && ++checkpointTicks >= 5) { checkpointTicks = 0; savePosition() }
        if (player.isPlaying && ++secAcc >= 15) { Study.addSec(this@PlayerService, secAcc); secAcc = 0 }
        if (sleepEnd > 0) {
            val r = sleepEnd - SystemClock.elapsedRealtime()
            if (r <= 0) { player.pause(); player.volume = 1f; sleepEnd = 0; note("⏲ 잠자기 타이머로 멈췄어요") }
            else if (r < 10_000) player.volume = r / 10_000f          // 마지막 10초 동안 작아지기
        }
        if (busEnd > 0) {
            val r = busEnd - SystemClock.elapsedRealtime()
            if (!busWarned && r in 1..120_000) { busWarned = true; buzz(longArrayOf(0, 300)); say("buspre", "🚌 2분 뒤 내릴 시간이에요") }
            if (r <= 0) { busEnd = 0; startAlert() }
        }
    } }

    // ================= 리모컨 (길게 누르기) =================
    private val tone by lazy { try { android.media.ToneGenerator(android.media.AudioManager.STREAM_MUSIC, 70) } catch (e: Exception) { null } }
    fun press(slot: String) {
        try { tone?.startTone(android.media.ToneGenerator.TONE_PROP_BEEP, 90) } catch (e: Exception) { }
        if (alerting) { stopAlert(); return }      // 하차 알림 중엔 아무 버튼이나 = 알림 끄기
        act(mapOf(slot))
    }

    fun handleKey(ev: KeyEvent): Boolean {
        if (ev.action != KeyEvent.ACTION_DOWN || ev.repeatCount != 0) return slotOf(ev.keyCode) != null
        lastKey = "${KeyEvent.keyCodeToString(ev.keyCode).removePrefix("KEYCODE_")} (${ev.keyCode})"
        val slot = slotOf(ev.keyCode) ?: return false
        press(slot)
        return true
    }

    /** 화면이 켜져 있으면 듣기 화면 띄우기 (화면이 꺼져 있으면 안드로이드가 막아서 알림만 남음) */
    private fun openScreen() = try {
        startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP))
    } catch (e: Exception) { }

    // ================= 알림·세션 =================
    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= 26) getSystemService(NotificationManager::class.java)
            .createNotificationChannel(NotificationChannel(CH, "OX 듣기", NotificationManager.IMPORTANCE_LOW))
    }

    private fun pi(a: String, code: Int): PendingIntent =
        PendingIntent.getService(this, code, Intent(this, PlayerService::class.java).setAction(a),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    private fun title() = LIST_NAMES[mode] ?: Store.tracks.getOrNull(trackIdx)?.name ?: "OX 듣기"

    private fun buildNotif(): Notification {
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CH) else @Suppress("DEPRECATION") Notification.Builder(this)
        val playing = this::player.isInitialized && player.isPlaying
        return b.setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(title())
            .setContentText(currentItem()?.s ?: "")
            .setContentIntent(PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE))
            .setOngoing(true)
            .addAction(Notification.Action.Builder(null, "◀ 처음부터", pi("L", 1)).build())
            .addAction(Notification.Action.Builder(null, if (playing) "⏸ 정지" else "▶ 재생", pi("C", 2)).build())
            .addAction(Notification.Action.Builder(null, "다음 ▶", pi("R", 3)).build())
            .addAction(Notification.Action.Builder(null, "종료", pi("QUIT", 4)).build())
            .setStyle(Notification.MediaStyle().setMediaSession(session.sessionToken).setShowActionsInCompactView(0, 1, 2))
            .build()
    }

    private fun updateSession() {
        if (destroyed || !this::session.isInitialized) return
        val playing = player.isPlaying
        session.setPlaybackState(PlaybackState.Builder()
            .setActions(PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE or
                PlaybackState.ACTION_SKIP_TO_NEXT or PlaybackState.ACTION_SKIP_TO_PREVIOUS or PlaybackState.ACTION_STOP)
            .setState(if (playing) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED, player.currentPosition, if (playing) speed else 0f)
            .build())
        session.setMetadata(MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, currentItem()?.s ?: "OX 듣기")
            .putString(MediaMetadata.METADATA_KEY_ARTIST, title()).build())
        if (isFg) try { getSystemService(NotificationManager::class.java).notify(NID, buildNotif()) } catch (e: Exception) { }
    }
}

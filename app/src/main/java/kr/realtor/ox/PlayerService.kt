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
    var bmOnly = false; private set
    private var loadedQ = -1
    private var autoStopQ = -1

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
    fun resetMap() { prefs.edit().apply { Remote.SLOTS.forEach { remove("map_${it.first}") } }.apply() }

    var detailText = ""; var detailKey = ""
    private var flash = ""
    private var flashUntil = 0L
    fun flashText(): String = if (SystemClock.elapsedRealtime() < flashUntil) flash else ""

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
            setPlaybackSpeed(speed)
        }
        cue = ExoPlayer.Builder(this).build()
        player.addListener(object : Player.Listener {
            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                if (reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO && player.currentMediaItemIndex == 3) {
                    if (continuous) advance() else { player.pause(); autoStopQ = loadedQ }
                }
                updateSession()
            }
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (isPlaying) { autoStopQ = -1; fg() }
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
                override fun onPlay() = press("c")
                override fun onPause() = press("c")
                override fun onSkipToNext() = press("r")
                override fun onSkipToPrevious() = press("l")
                override fun onStop() { player.pause() }
            })
            isActive = true
        }
        createChannel()
        fg()
        bmOnly = prefs.getBoolean("bmOnly", false)
        load(prefs.getInt("ti", 0), bmOnly, prefs.getInt("q", 0), false)
    }

    private var isFg = false
    private fun fg() {
        if (isFg) return
        try {
            val n = buildNotif()
            if (Build.VERSION.SDK_INT >= 29) startForeground(NID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            else startForeground(NID, n)
            isFg = true
        } catch (e: Exception) { }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            "L" -> act("restart"); "R" -> act("next"); "C" -> act("toggle")
            "QUIT" -> { player.pause(); stopForeground(STOP_FOREGROUND_REMOVE); isFg = false; stopSelf() }
            else -> fg()
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        inst = null
        session.release(); player.release(); cue.release()
        super.onDestroy()
    }

    // ================= 재생 목록 =================
    private val dsf by lazy { DefaultDataSource.Factory(this) }
    private fun asset(p: String): MediaSource =
        ProgressiveMediaSource.Factory(dsf).createMediaSource(MediaItem.fromUri(Uri.parse("asset:///$p")))

    private fun slots(it: Item): List<MediaSource> = listOf(
        asset("a/t${it.ti}_${it.i}_s.ogg"), SilenceMediaSource(gapSec * 1_000_000L),
        asset("a/t${it.ti}_${it.i}_e.ogg"), SilenceMediaSource(150_000L))

    fun bookmarks(): MutableSet<String> = HashSet(prefs.getStringSet("bm", emptySet()) ?: emptySet())

    fun load(ti: Int, onlyBm: Boolean, q: Int, play: Boolean) {
        trackIdx = ti.coerceIn(0, Store.tracks.size - 1); bmOnly = onlyBm
        queue = if (onlyBm) { val b = bookmarks(); Store.tracks.flatMap { it.items }.filter { b.contains(it.key) } }
                else Store.tracks[trackIdx].items
        if (queue.isEmpty()) { bmOnly = false; queue = Store.tracks[trackIdx].items; note("북마크가 없어요") }
        prefs.edit().putInt("ti", trackIdx).putBoolean("bmOnly", bmOnly).apply()
        loadedQ = -1
        go(q.coerceIn(0, queue.size - 1), 0, play)
    }

    /** q번 문항의 k칸으로 이동 */
    fun go(q: Int, k: Int, play: Boolean = true) {
        if (q !in queue.indices) return
        autoStopQ = -1
        if (loadedQ != q) { player.setMediaSources(slots(queue[q]), k, 0); player.prepare(); loadedQ = q }
        else player.seekTo(k, 0)
        prefs.edit().putInt("q", q).apply()
        if (play) player.play()
        updateSession()
    }

    private fun advance() {
        val q = loadedQ
        when {
            q + 1 < queue.size -> go(q + 1, 0)
            !bmOnly && trackIdx + 1 < Store.tracks.size -> say("nextpart", "다음 과목") { load(trackIdx + 1, false, 0, true) }
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
    private fun note(t: String) { flash = t; flashUntil = SystemClock.elapsedRealtime() + 2500 }

    private fun say(name: String, text: String, then: (() -> Unit)? = null) {
        note(text)
        if (!voiceCue) { then?.invoke(); return }
        if (then != null && player.isPlaying) player.pause()
        cue.setMediaItem(MediaItem.fromUri(Uri.parse("asset:///cue/$name.ogg")))
        cue.setPlaybackSpeed(maxOf(1.1f, speed)); cue.prepare()
        var done = false
        cue.addListener(object : Player.Listener {
            private fun end() { if (!done) { done = true; cue.removeListener(this); then?.invoke() } }
            override fun onPlaybackStateChanged(s: Int) { if (s == Player.STATE_ENDED) end() }
            override fun onPlayerError(error: androidx.media3.common.PlaybackException) = end()
        })
        cue.play()
    }

    // ================= 동작 =================
    fun act(a: String) {
        if (queue.isEmpty()) return
        val (q, ph) = phase()
        when (a) {
            "toggle" -> when {
                player.isPlaying -> { player.pause(); say("stop", "정지") }
                autoStopQ >= 0 -> advance()                    // 한 문항 끝난 뒤 재생 = 다음 문항
                else -> { if (player.playbackState == Player.STATE_IDLE || player.playbackState == Player.STATE_ENDED) go(q, 0) else player.play() }
            }
            "restart" -> if (ph == 'E') go(q, 2) else say("restart", "현재 지문 처음부터") { go(q, 0) }
            "next" -> if (ph == 'S') say("exp", "현재 지문 해설") { go(q, 2) } else act("nextItem")
            "exp" -> say("exp", "해설") { go(q, 2) }
            "nextItem" -> when {
                q + 1 < queue.size -> say("next", "다음 지문") { go(q + 1, 0) }
                !bmOnly && trackIdx + 1 < Store.tracks.size -> say("nextpart", "다음 과목") { load(trackIdx + 1, false, 0, true) }
                else -> say("last", "마지막 지문이에요")
            }
            "prev" -> when {
                q > 0 -> say("prev", "이전 지문") { go(q - 1, 0) }
                !bmOnly && trackIdx > 0 -> say("prev", "이전 지문") { load(trackIdx - 1, false, Store.tracks[trackIdx - 1].items.size - 1, true) }
                else -> say("first", "첫 지문이에요") { go(0, 0) }
            }
            "detail" -> {
                val it = currentItem() ?: return
                if (player.isPlaying) player.pause()
                note("🤖 더 자세히 준비 중…"); detailText = ""
                Thread {
                    try {
                        val t = Net.detail(this, it); val files = Net.speech(this, t)
                        h.post { detailText = t; detailKey = it.key
                            cue.setMediaItems(files.map { f -> MediaItem.fromUri(Uri.fromFile(f)) }); cue.setPlaybackSpeed(speed); cue.prepare(); cue.play() }
                    } catch (e: Exception) { h.post { note("더 자세히 실패: ${e.message?.take(60)}") } }
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

    // ================= 리모컨 =================
    private val count = HashMap<String, Int>()
    /** 길게 누른 미디어 키(c/l/r). 두 번 칸에 동작이 있으면 잠깐 기다려 한 번/두 번을 구분해요 */
    fun press(key: String) {
        if (mapOf(key + "2") == "none") { act(mapOf(key + "1")); return }
        val n = (count[key] ?: 0) + 1
        count[key] = n
        h.removeCallbacksAndMessages(key)
        if (n >= 2) { count[key] = 0; act(mapOf(key + "2")); return }
        h.postAtTime({ count[key] = 0; act(mapOf(key + "1")) }, key, SystemClock.uptimeMillis() + 500)
    }

    fun handleKey(ev: KeyEvent): Boolean {
        val k = when (ev.keyCode) {
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_HEADSETHOOK, KeyEvent.KEYCODE_MEDIA_PLAY, KeyEvent.KEYCODE_MEDIA_PAUSE -> "c"
            KeyEvent.KEYCODE_MEDIA_PREVIOUS, KeyEvent.KEYCODE_MEDIA_REWIND -> "l"
            KeyEvent.KEYCODE_MEDIA_NEXT, KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> "r"
            else -> return false
        }
        if (ev.action == KeyEvent.ACTION_DOWN && ev.repeatCount == 0) press(k)
        return true
    }

    // ================= 알림·세션 =================
    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= 26) getSystemService(NotificationManager::class.java)
            .createNotificationChannel(NotificationChannel(CH, "OX 듣기", NotificationManager.IMPORTANCE_LOW))
    }

    private fun pi(a: String, code: Int): PendingIntent =
        PendingIntent.getService(this, code, Intent(this, PlayerService::class.java).setAction(a),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    private fun title() = if (bmOnly) "★ 북마크" else Store.tracks.getOrNull(trackIdx)?.name ?: "OX 듣기"

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
        if (!this::session.isInitialized) return
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

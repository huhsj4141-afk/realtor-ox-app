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
 * 재생 목록: 문항마다 [지문(차임+지문), 생각 시간(무음), 정답소리+해설, 끝 표시(짧은 무음)] 4칸.
 * 끝 표시 칸에 들어가면 (계속 듣기가 아니면) 멈춤 → 한 문항씩 재생.
 * 리모컨(미디어 버튼)은 화면이 꺼져도 MediaSession 으로 들어옴.
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
    private val prefs by lazy { getSharedPreferences("ox", Context.MODE_PRIVATE) }

    // 현재 재생 목록
    var queue: List<Item> = emptyList(); private set
    var trackIdx = 0; private set
    var bmOnly = false; private set
    var continuous: Boolean
        get() = prefs.getBoolean("cont", false)
        set(v) { prefs.edit().putBoolean("cont", v).apply() }
    var gapSec: Int
        get() = prefs.getInt("gap", 3)
        set(v) { prefs.edit().putInt("gap", v).apply(); rebuild() }
    var speed: Float
        get() = prefs.getFloat("speed", 1f)
        set(v) { prefs.edit().putFloat("speed", v).apply(); player.setPlaybackSpeed(v) }
    var voiceCue: Boolean
        get() = prefs.getBoolean("vcue", true)
        set(v) { prefs.edit().putBoolean("vcue", v).apply() }

    /** 문항 끝에서 자동으로 멈췄으면 그 문항 번호 (다음 문항 처음에 멈춰 있음) */
    var autoStopQ = -1; private set
    var flash = ""; private set
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
                val idx = player.currentMediaItemIndex
                if (reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO && idx % 4 == 3) {
                    val q = idx / 4
                    if (!continuous || q == queue.size - 1) {
                        player.pause()
                        if (q + 1 < queue.size) player.seekTo((q + 1) * 4, 0) else player.seekTo(q * 4 + 2, 0)
                        autoStopQ = q
                    }
                }
                saveResume(); updateSession()
            }
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (isPlaying) autoStopQ = -1
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
        // 이어 듣기
        bmOnly = prefs.getBoolean("bmOnly", false)
        val ti = prefs.getInt("ti", 0)
        load(ti, bmOnly, prefs.getInt("q", 0), play = false)
        player.setPlaybackSpeed(speed)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            "L" -> stepL(); "R" -> stepR(); "C" -> center()
            "QUIT" -> { player.pause(); stopForeground(STOP_FOREGROUND_REMOVE); stopSelf() }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        saveResume(); inst = null
        session.release(); player.release(); cue.release()
        super.onDestroy()
    }

    // ---------- 재생 목록 ----------
    private val dsf by lazy { DefaultDataSource.Factory(this) }
    private fun src(path: String): MediaSource =
        ProgressiveMediaSource.Factory(dsf).createMediaSource(MediaItem.fromUri(Uri.parse("asset:///$path")))

    fun bookmarks(): MutableSet<String> = HashSet(prefs.getStringSet("bm", emptySet()) ?: emptySet())

    fun load(ti: Int, onlyBm: Boolean, q: Int, play: Boolean) {
        trackIdx = ti.coerceIn(0, Store.tracks.size - 1); bmOnly = onlyBm
        queue = if (onlyBm) {
            val b = bookmarks()
            Store.tracks.flatMap { it.items }.filter { b.contains(it.key) }
        } else Store.tracks[trackIdx].items
        if (queue.isEmpty()) { bmOnly = false; queue = Store.tracks[trackIdx].items; say("flash", "북마크가 없어요") }
        prefs.edit().putInt("ti", trackIdx).putBoolean("bmOnly", bmOnly).apply()
        rebuild(q.coerceIn(0, queue.size - 1), play)
    }

    private fun rebuild(q: Int = curQ(), play: Boolean = player.isPlaying) {
        if (queue.isEmpty()) return
        val list = ArrayList<MediaSource>()
        for (it in queue) {
            list.add(src("a/t${it.ti}_${it.i}_s.ogg"))
            list.add(SilenceMediaSource(gapSec * 1_000_000L))
            list.add(src("a/t${it.ti}_${it.i}_e.ogg"))
            list.add(SilenceMediaSource(150_000L))
        }
        player.setMediaSources(list, q.coerceIn(0, queue.size - 1) * 4, 0)
        player.prepare()
        autoStopQ = -1
        if (play) player.play()
        saveResume(); updateSession()
    }

    fun curQ(): Int = (player.currentMediaItemIndex / 4).coerceIn(0, maxOf(0, queue.size - 1))

    /** 지금 단계: 문항 번호와 지문(S)/해설(E) */
    fun phase(): Pair<Int, Char> {
        if (autoStopQ >= 0 && !player.isPlaying) return autoStopQ to 'E'
        val idx = player.currentMediaItemIndex
        return (idx / 4).coerceIn(0, maxOf(0, queue.size - 1)) to (if (idx % 4 <= 1) 'S' else 'E')
    }

    fun currentItem(): Item? = queue.getOrNull(phase().first)

    private fun saveResume() {
        prefs.edit().putInt("q", curQ()).apply()
    }

    // ---------- 동작 ----------
    private fun go(q: Int, k: Int, play: Boolean = true) {
        autoStopQ = -1
        player.seekTo(q * 4 + k, 0)
        if (play) player.play()
    }

    /** 안내 음성을 먼저 말하고 동작 */
    private fun say(name: String, text: String, then: (() -> Unit)? = null) {
        flash = text; flashUntil = SystemClock.elapsedRealtime() + 2500
        if (name == "flash" || !voiceCue) { then?.invoke(); return }
        val wasPlaying = player.isPlaying
        if (then != null && wasPlaying) player.pause()
        cue.setMediaItem(MediaItem.fromUri(Uri.parse("asset:///cue/$name.ogg")))
        cue.setPlaybackSpeed(maxOf(1f, speed))
        cue.prepare()
        var done = false
        val l = object : Player.Listener {
            override fun onPlaybackStateChanged(s: Int) {
                if (s == Player.STATE_ENDED && !done) { done = true; cue.removeListener(this); then?.invoke() }
            }
            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                if (!done) { done = true; cue.removeListener(this); then?.invoke() }
            }
        }
        cue.addListener(l)
        cue.play()
    }

    fun flashText(): String = if (SystemClock.elapsedRealtime() < flashUntil) flash else ""

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
        if (ph == 'E') { lastLPh = 'E'; go(q, 2); return }      // 정답 소리부터 해설 다시
        lastLPh = 'S'
        say("restart", "현재 지문 처음부터") { go(q, 0) }
    }

    private var cCount = 0
    private val cFire = Runnable {
        val n = cCount; cCount = 0
        if (n >= 2) bookmark() else toggle()
    }
    fun center() {
        cCount++
        h.removeCallbacks(cFire)
        if (cCount >= 2) cFire.run() else h.postDelayed(cFire, 650)
    }

    fun toggle() {
        if (player.isPlaying) { player.pause(); say("stop", "정지") }
        else { if (player.playbackState == Player.STATE_IDLE) player.prepare(); player.play() }
    }

    fun bookmark() {
        val it = currentItem() ?: return
        val b = bookmarks()
        val on = if (b.contains(it.key)) { b.remove(it.key); false } else { b.add(it.key); true }
        prefs.edit().putStringSet("bm", b).apply()
        say(if (on) "bookmark" else "unbookmark", if (on) "★ 북마크" else "북마크 해제")
    }

    fun jump(q: Int) { if (q in queue.indices) go(q, 0, player.isPlaying) }

    // ---------- 리모컨 키 ----------
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

    // ---------- 알림·세션 ----------
    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            val ch = NotificationChannel(CH, "OX 듣기", NotificationManager.IMPORTANCE_LOW)
            getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
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

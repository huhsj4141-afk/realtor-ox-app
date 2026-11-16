package kr.realtor.ox

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Gravity
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.CheckBox
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.abs
import kotlin.math.hypot

class MainActivity : Activity() {
    private val h = Handler(Looper.getMainLooper())
    private val svc get() = PlayerService.inst
    private lateinit var spinner: Spinner
    private lateinit var pos: TextView
    private lateinit var stmt: TextView
    private lateinit var expV: TextView
    private lateinit var playBtn: Button
    private lateinit var dark: FrameLayout
    private lateinit var darkText: TextView
    private lateinit var mapBox: LinearLayout
    private val speedBtns = ArrayList<Pair<Float, Button>>()
    private val gapBtns = ArrayList<Pair<Int, Button>>()
    private var synced = false
    private var spinBusy = false

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        val cf = java.io.File(filesDir, "crash.txt")
        if (cf.exists()) {      // 지난번 비정상 종료 원인 보여주기
            val msg = cf.readText(); cf.delete()
            setContentView(ScrollView(this).apply { addView(TextView(this@MainActivity).apply {
                text = "지난번 비정상 종료 원인 (캡처해서 Claude에게 보내주세요)\n\n$msg"; textSize = 12f; setTextIsSelectable(true); setPadding(24, 48, 24, 24) }) })
            return
        }
        Store.load(this)
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        val i = Intent(this, PlayerService::class.java)
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(i) else startService(i)
        setContentView(buildUi())
        h.post(tick)
    }

    override fun onDestroy() { h.removeCallbacksAndMessages(null); super.onDestroy() }

    // ---------- 화면 구성 ----------
    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
    private fun round(c: Int, r: Int) = GradientDrawable().apply { setColor(c); cornerRadius = dp(r).toFloat() }
    private fun card() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL; setPadding(dp(16), dp(14), dp(16), dp(14)); background = round(Color.WHITE, 16)
        layoutParams = LinearLayout.LayoutParams(-1, -2).apply { setMargins(dp(12), dp(6), dp(12), dp(6)) }
    }
    private fun tv(t: String, sp: Float, bold: Boolean = false, color: String = "#111827") = TextView(this).apply {
        text = t; textSize = sp; setTextColor(Color.parseColor(color)); setLineSpacing(0f, 1.25f); if (bold) setTypeface(typeface, Typeface.BOLD)
    }
    private fun btn(t: String, primary: Boolean = false, f: () -> Unit) = Button(this).apply {
        text = t; isAllCaps = false; textSize = 16f
        setTextColor(if (primary) Color.WHITE else Color.parseColor("#111827"))
        background = round(Color.parseColor(if (primary) "#2563EB" else "#EEF1F5"), 12)
        layoutParams = LinearLayout.LayoutParams(0, dp(56), 1f).apply { setMargins(dp(4), dp(4), dp(4), dp(4)) }
        setOnClickListener { f() }
    }
    private fun row(vararg v: View) = LinearLayout(this).apply { v.forEach { addView(it) } }
    private fun wide(b: Button) = b.apply { layoutParams = LinearLayout.LayoutParams(-1, dp(52)).apply { setMargins(dp(4), dp(6), dp(4), dp(4)) } }

    private fun buildUi(): View {
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.parseColor("#F5F6F8")); setPadding(0, dp(12), 0, dp(24)) }
        col.addView(tv("🎧 공인중개사 OX 듣기", 22f, true).apply { setPadding(dp(18), dp(8), dp(18), dp(6)) })

        // 지금 듣는 문항
        val c1 = card()
        spinner = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, Store.tracks.map { it.name } + "★ 북마크만 듣기")
            onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(p: AdapterView<*>?, v: View?, n: Int, id: Long) {
                    val s = svc ?: return
                    if (spinBusy || !synced) return
                    if (n == Store.tracks.size) s.load(s.trackIdx, true, 0, false) else s.load(n, false, 0, false)
                }
                override fun onNothingSelected(p: AdapterView<*>?) {}
            }
        }
        pos = tv("", 13f, color = "#6B7280").apply { setPadding(0, dp(8), 0, 0) }
        stmt = tv("", 19f).apply { setPadding(0, dp(8), 0, dp(8)) }
        expV = tv("", 15f, color = "#374151")
        listOf(spinner, pos, stmt, expV).forEach { c1.addView(it) }
        col.addView(c1)

        // 조작 버튼 (리모컨 동작과 같은 것만)
        val c2 = card()
        playBtn = btn("▶ 재생", true) { svc?.act("toggle") }
        c2.addView(row(btn("◀ 처음부터") { svc?.act("restart") }, playBtn, btn("다음 ▶") { svc?.act("next") }))
        c2.addView(row(btn("⏮ 이전 지문") { svc?.act("prev") }, btn("★ 북마크") { svc?.act("bookmark") }))
        c2.addView(wide(btn("🌙 검은 화면") { showDark(true) }))
        col.addView(c2)

        // 듣는 방식
        val c3 = card()
        c3.addView(CheckBox(this).apply { text = "계속 듣기 (끄면 한 문항씩 멈춰요)"; textSize = 15f
            isChecked = getSharedPreferences("ox", android.content.Context.MODE_PRIVATE).getBoolean("cont", false)
            setOnCheckedChangeListener { _, v -> svc?.continuous = v } })
        c3.addView(CheckBox(this).apply { text = "🗣 동작 안내 음성"; textSize = 15f
            isChecked = getSharedPreferences("ox", android.content.Context.MODE_PRIVATE).getBoolean("vcue", true)
            setOnCheckedChangeListener { _, v -> svc?.voiceCue = v } })
        c3.addView(tv("속도", 14f, true).apply { setPadding(0, dp(8), 0, 0) })
        c3.addView(row(*listOf(0.8f, 1f, 1.2f, 1.5f).map { v -> btn("${v}배") { svc?.speed = v }.also { speedBtns.add(v to it) } }.toTypedArray()))
        c3.addView(tv("지문 뒤 생각 시간", 14f, true).apply { setPadding(0, dp(8), 0, 0) })
        c3.addView(row(*listOf(1, 3, 5, 8).map { v -> btn("${v}초") { svc?.gapSec = v }.also { gapBtns.add(v to it) } }.toTypedArray()))
        col.addView(c3)

        // 리모컨 매핑
        val c4 = card()
        c4.addView(tv("🎮 링 리모컨", 16f, true))
        c4.addView(tv("길게 누르기는 화면이 꺼져도 돼요. 짧게 누르기는 검은 화면에서만 돼요. 눌러서 동작을 바꾸세요.", 13f, color = "#6B7280").apply { setPadding(0, dp(4), 0, dp(4)) })
        mapBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        c4.addView(mapBox)
        c4.addView(wide(btn("기본값으로") { svc?.resetMap(); drawMap() }))
        col.addView(c4)

        val root = FrameLayout(this)
        root.addView(ScrollView(this).apply { addView(col) })
        dark = FrameLayout(this).apply { setBackgroundColor(Color.BLACK); visibility = View.GONE }
        darkText = tv("", 16f, color = "#555555").apply { gravity = Gravity.CENTER }
        dark.addView(darkText, FrameLayout.LayoutParams(-1, -2, Gravity.CENTER))
        setupDark()
        root.addView(dark, FrameLayout.LayoutParams(-1, -1))
        return root
    }

    private fun drawMap() {
        val s = svc ?: return
        mapBox.removeAllViews()
        Remote.SLOTS.forEach { (slot, name, _) ->
            mapBox.addView(LinearLayout(this).apply {
                gravity = Gravity.CENTER_VERTICAL; setPadding(0, dp(6), 0, dp(6))
                addView(tv(name, 14f).apply { layoutParams = LinearLayout.LayoutParams(0, -2, 1f) })
                addView(Button(this@MainActivity).apply {
                    text = Remote.label(s.mapOf(slot)); isAllCaps = false; textSize = 14f
                    background = round(Color.parseColor("#EEF1F5"), 10); setPadding(dp(12), 0, dp(12), 0)
                    setOnClickListener {
                        val cur = Remote.ACTIONS.indexOfFirst { it.first == s.mapOf(slot) }
                        AlertDialog.Builder(this@MainActivity).setTitle(name)
                            .setSingleChoiceItems(Remote.ACTIONS.map { it.second }.toTypedArray(), cur) { d, i ->
                                s.setMap(slot, Remote.ACTIONS[i].first); d.dismiss(); drawMap() }
                            .setNegativeButton("닫기", null).show()
                    }
                })
            })
        }
    }

    // ---------- 검은 화면: 손가락 톡(왼쪽/가운데/오른쪽), 1초 꾹 = 나가기. 링 커서 = 짧게 누르기 매핑 ----------
    private var x0 = 0f; private var y0 = 0f; private var held = false
    private val holdR = Runnable { held = true; showDark(false) }
    private var hv: FloatArray? = null
    private val hvEnd = Runnable {
        val v = hv ?: return@Runnable; hv = null
        val dx = v[2] - v[0]; val dy = v[3] - v[1]
        if (hypot(dx, dy) < dp(4)) return@Runnable
        val slot = if (abs(dx) > abs(dy)) (if (dx > 0) "kr" else "kl") else (if (dy < 0) "ku" else "kd")
        svc?.let { it.act(it.mapOf(slot)) }
    }
    private var mouseDown = 0L

    private fun setupDark() {
        dark.setOnTouchListener { _, e ->
            val s = svc
            if (e.getToolType(0) != MotionEvent.TOOL_TYPE_FINGER) {     // 링 리모컨 클릭
                when (e.actionMasked) {
                    MotionEvent.ACTION_DOWN -> mouseDown = SystemClock.elapsedRealtime()
                    MotionEvent.ACTION_UP -> if (SystemClock.elapsedRealtime() - mouseDown > 700) showDark(false) else s?.let { it.act(it.mapOf("kc")) }
                }
                return@setOnTouchListener true
            }
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> { x0 = e.x; y0 = e.y; held = false; h.postDelayed(holdR, 1000) }
                MotionEvent.ACTION_MOVE -> if (hypot(e.x - x0, e.y - y0) > dp(20)) h.removeCallbacks(holdR)
                MotionEvent.ACTION_UP -> {
                    h.removeCallbacks(holdR)
                    if (!held && s != null) {
                        val w = dark.width
                        s.act(when { e.x < w / 3f -> "restart"; e.x > w * 2 / 3f -> "next"; else -> "toggle" })
                    }
                }
            }
            true
        }
        dark.setOnGenericMotionListener { _, e ->
            if (e.actionMasked != MotionEvent.ACTION_HOVER_MOVE) return@setOnGenericMotionListener false
            hv = hv?.also { it[2] = e.x; it[3] = e.y } ?: floatArrayOf(e.x, e.y, e.x, e.y)
            h.removeCallbacks(hvEnd); h.postDelayed(hvEnd, 180)
            true
        }
    }

    private fun showDark(on: Boolean) {
        dark.visibility = if (on) View.VISIBLE else View.GONE
        if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = if (on) View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY else 0
        window.attributes = window.attributes.apply { screenBrightness = if (on) 0.01f else WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE }
    }

    @Deprecated("back")
    override fun onBackPressed() {
        if (dark.visibility == View.VISIBLE) showDark(false) else @Suppress("DEPRECATION") super.onBackPressed()
    }

    // 화면이 켜져 있을 때 들어오는 미디어 키도 같은 매핑으로
    override fun dispatchKeyEvent(e: KeyEvent): Boolean = svc?.handleKey(e) == true || super.dispatchKeyEvent(e)

    // ---------- 화면 갱신 ----------
    private val tick = object : Runnable { override fun run() { refresh(); h.postDelayed(this, 300) } }

    private fun refresh() {
        val s = svc ?: return
        if (!synced) { synced = true; drawMap() }
        val want = if (s.bmOnly) Store.tracks.size else s.trackIdx
        if (spinner.selectedItemPosition != want) { spinBusy = true; spinner.setSelection(want, false); h.post { spinBusy = false } }
        val (q, ph) = s.phase()
        val it = s.queue.getOrNull(q)
        val name = if (it != null) Store.tracks[it.ti].name else ""
        val bm = it != null && s.bookmarks().contains(it.key)
        pos.text = "$name · ${q + 1}/${s.queue.size}${if (bm) " · ★" else ""} · ${if (ph == 'S') "지문" else "해설"}"
        stmt.text = it?.s ?: ""
        expV.text = if (it != null && ph == 'E') "정답 ${if (it.o) "O" else "X"}\n${it.exp}" else ""
        playBtn.text = if (s.player.isPlaying) "⏸ 정지" else "▶ 재생"
        speedBtns.forEach { (v, b) -> b.alpha = if (abs(v - s.speed) < .01f) 1f else .45f }
        gapBtns.forEach { (v, b) -> b.alpha = if (v == s.gapSec) 1f else .45f }
        if (dark.visibility == View.VISIBLE)
            darkText.text = "${SimpleDateFormat("HH:mm", Locale.KOREA).format(Date())}\n$name · ${q + 1}/${s.queue.size}\n${if (s.player.isPlaying) "▶ 읽는 중" else "⏸ 멈춤"}\n${s.flashText()}"
    }
}

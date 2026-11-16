package kr.realtor.ox

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Gravity
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
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
    private lateinit var pos: TextView
    private lateinit var stmt: TextView
    private lateinit var expV: TextView
    private lateinit var playBtn: Button
    private lateinit var spinner: Spinner
    private lateinit var cont: CheckBox
    private lateinit var vcue: CheckBox
    private lateinit var dark: FrameLayout
    private lateinit var darkText: TextView
    private val speedBtns = ArrayList<Pair<Float, Button>>()
    private val gapBtns = ArrayList<Pair<Int, Button>>()
    private var ignoreSpin = true

    private val svc get() = PlayerService.inst
    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
    private val BG = Color.parseColor("#F5F6F8")
    private val PRI = Color.parseColor("#2563EB")

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        Store.load(this)
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        val i = Intent(this, PlayerService::class.java)
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(i) else startService(i)
        setContentView(buildUi())
        h.post(tick)
    }

    override fun onDestroy() { h.removeCallbacks(tick); super.onDestroy() }

    // ---------- 화면 ----------
    private fun card(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(16), dp(14), dp(16), dp(14))
        background = android.graphics.drawable.GradientDrawable().apply { setColor(Color.WHITE); cornerRadius = dp(16).toFloat() }
        layoutParams = LinearLayout.LayoutParams(-1, -2).apply { setMargins(dp(12), dp(6), dp(12), dp(6)) }
    }

    private fun tv(t: String, sp: Float, bold: Boolean = false, color: Int = Color.parseColor("#111827")) = TextView(this).apply {
        text = t; textSize = sp; setTextColor(color); if (bold) setTypeface(typeface, Typeface.BOLD)
        setLineSpacing(0f, 1.25f)
    }

    private fun btn(t: String, primary: Boolean = false, f: () -> Unit) = Button(this).apply {
        text = t; isAllCaps = false; textSize = 16f
        setTextColor(if (primary) Color.WHITE else Color.parseColor("#111827"))
        background = android.graphics.drawable.GradientDrawable().apply {
            setColor(if (primary) PRI else Color.parseColor("#EEF1F5")); cornerRadius = dp(12).toFloat()
        }
        layoutParams = LinearLayout.LayoutParams(0, dp(56), 1f).apply { setMargins(dp(4), dp(4), dp(4), dp(4)) }
        setOnClickListener { f() }
    }

    private fun row(vararg v: View) = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; v.forEach { addView(it) } }

    private fun buildUi(): View {
        val root = FrameLayout(this)
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(BG); setPadding(0, dp(12), 0, dp(24)) }
        col.addView(tv("🎧 공인중개사 OX 듣기", 22f, true).apply { setPadding(dp(18), dp(8), dp(18), dp(6)) })

        val c1 = card()
        spinner = Spinner(this)
        val names = Store.tracks.map { it.name } + "★ 북마크만 듣기"
        spinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, names)
        spinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                if (ignoreSpin) return
                val s = svc ?: return
                if (pos == Store.tracks.size) s.load(s.trackIdx, true, 0, false) else s.load(pos, false, 0, false)
            }
            override fun onNothingSelected(p: AdapterView<*>?) {}
        }
        c1.addView(spinner)
        pos = tv("", 13f, color = Color.parseColor("#6B7280")).apply { setPadding(0, dp(8), 0, 0) }
        stmt = tv("", 19f).apply { setPadding(0, dp(8), 0, dp(8)) }
        expV = tv("", 15f, color = Color.parseColor("#374151"))
        c1.addView(pos); c1.addView(stmt); c1.addView(expV)
        col.addView(c1)

        val c2 = card()
        playBtn = btn("▶ 재생", true) { svc?.toggle() }
        c2.addView(row(btn("◀ 처음부터") { svc?.stepL() }, playBtn, btn("▶▶ 다음") { svc?.stepR() }))
        c2.addView(row(btn("⏮ 이전 지문") { svc?.let { it.jump(it.phase().first - 1) } }, btn("★ 북마크") { svc?.bookmark() },
            btn("⏭ 다음 지문") { svc?.let { it.jump(it.phase().first + 1) } }))
        c2.addView(btn("🌙 검은 화면 (화면 꺼도 리모컨 작동)") { showDark(true) }.apply {
            layoutParams = LinearLayout.LayoutParams(-1, dp(56)).apply { setMargins(dp(4), dp(8), dp(4), dp(4)) } })
        col.addView(c2)

        val c3 = card()
        cont = CheckBox(this).apply { text = "계속 듣기 (끄면 한 문항씩 멈춰요)"; textSize = 15f
            setOnCheckedChangeListener { _, v -> svc?.continuous = v } }
        vcue = CheckBox(this).apply { text = "🗣 동작 안내 음성"; textSize = 15f
            setOnCheckedChangeListener { _, v -> svc?.voiceCue = v } }
        c3.addView(cont); c3.addView(vcue)
        c3.addView(tv("속도", 14f, true).apply { setPadding(0, dp(8), 0, 0) })
        val sr = LinearLayout(this)
        listOf(0.8f, 1f, 1.2f, 1.5f).forEach { v -> val bt = btn("${v}배") { svc?.speed = v }; speedBtns.add(v to bt); sr.addView(bt) }
        c3.addView(sr)
        c3.addView(tv("지문 뒤 생각 시간", 14f, true).apply { setPadding(0, dp(8), 0, 0) })
        val gr = LinearLayout(this)
        listOf(1, 3, 5, 8).forEach { v -> val bt = btn("${v}초") { svc?.gapSec = v }; gapBtns.add(v to bt); gr.addView(bt) }
        c3.addView(gr)
        col.addView(c3)

        val c4 = card()
        c4.addView(tv("🎮 링 리모컨 (화면 꺼져도 작동)", 16f, true))
        c4.addView(tv("• 가운데 길게: 재생 / 정지\n• 가운데 길게 두 번: ★ 북마크\n• 왼쪽 길게: 지문 중 → 지문 처음부터 · 해설 중 → 정답 소리+해설 처음부터 (두 번 빠르게 → 이전 지문)\n• 오른쪽 길게: 지문 중 → 해설로 · 해설 중 → 다음 지문\n\n검은 화면에선 짧게 누르기(커서)도 돼요: 좌우 이동 = 왼쪽/오른쪽, 위 = 북마크, 클릭 = 재생/정지. 손가락: 왼쪽·가운데·오른쪽 톡, 1초 꾹 = 나가기.",
            14f, color = Color.parseColor("#4B5563")).apply { setPadding(0, dp(6), 0, 0) })
        col.addView(c4)

        root.addView(ScrollView(this).apply { addView(col) })
        dark = FrameLayout(this).apply { setBackgroundColor(Color.BLACK); visibility = View.GONE; isFocusable = true }
        darkText = tv("", 16f, color = Color.parseColor("#555555")).apply { gravity = Gravity.CENTER }
        dark.addView(darkText, FrameLayout.LayoutParams(-1, -2, Gravity.CENTER).apply { setMargins(dp(24), 0, dp(24), 0) })
        setupDark()
        root.addView(dark, ViewGroup.LayoutParams(-1, -1))
        return root
    }

    // ---------- 검은 화면 ----------
    private var dx0 = 0f; private var dy0 = 0f; private var held = false
    private val holdR = Runnable { held = true; showDark(false) }
    private var hvX = 0f; private var hvY = 0f; private var hvX1 = 0f; private var hvY1 = 0f; private var hvOn = false
    private val hvEnd = Runnable {
        hvOn = false
        val dx = hvX1 - hvX; val dy = hvY1 - hvY
        if (hypot(dx, dy) < dp(4)) return@Runnable
        val s = svc ?: return@Runnable
        if (abs(dx) > abs(dy)) { if (dx > 0) s.stepR() else s.stepL() } else if (dy < 0) s.bookmark()
    }
    private var mouseDown = 0L

    private fun setupDark() {
        dark.setOnTouchListener { _, e ->
            val finger = e.getToolType(0) == MotionEvent.TOOL_TYPE_FINGER
            if (!finger) {   // 링 리모컨 커서 클릭
                when (e.actionMasked) {
                    MotionEvent.ACTION_DOWN -> mouseDown = SystemClock.elapsedRealtime()
                    MotionEvent.ACTION_UP -> if (SystemClock.elapsedRealtime() - mouseDown > 700) showDark(false) else svc?.center()
                }
                return@setOnTouchListener true
            }
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> { dx0 = e.x; dy0 = e.y; held = false; h.postDelayed(holdR, 1000) }
                MotionEvent.ACTION_MOVE -> if (hypot(e.x - dx0, e.y - dy0) > dp(20)) h.removeCallbacks(holdR)
                MotionEvent.ACTION_UP -> {
                    h.removeCallbacks(holdR)
                    if (!held) {
                        val dx = e.x - dx0; val dy = e.y - dy0; val s = svc
                        if (s != null) {
                            if (hypot(dx, dy) > dp(50)) {
                                if (abs(dx) > abs(dy)) { if (dx > 0) s.stepR() else s.stepL() } else if (dy < 0) s.bookmark()
                            } else {
                                val w = dark.width
                                when { e.x < w / 3f -> s.stepL(); e.x > w * 2 / 3f -> s.stepR(); else -> s.center() }
                            }
                        }
                    }
                }
            }
            true
        }
        dark.setOnGenericMotionListener { _, e ->
            if (e.actionMasked == MotionEvent.ACTION_HOVER_MOVE || e.actionMasked == MotionEvent.ACTION_HOVER_ENTER) {
                if (!hvOn) { hvOn = true; hvX = e.x; hvY = e.y }
                hvX1 = e.x; hvY1 = e.y
                h.removeCallbacks(hvEnd); h.postDelayed(hvEnd, 180)
                true
            } else false
        }
    }

    private fun showDark(on: Boolean) {
        dark.visibility = if (on) View.VISIBLE else View.GONE
        if (on) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            window.attributes = window.attributes.apply { screenBrightness = 0.01f }
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = 0
            window.attributes = window.attributes.apply { screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE }
        }
    }

    @Deprecated("back")
    override fun onBackPressed() {
        if (dark.visibility == View.VISIBLE) showDark(false) else @Suppress("DEPRECATION") super.onBackPressed()
    }

    // ---------- 키 (화면 켜져 있을 때) ----------
    override fun dispatchKeyEvent(e: KeyEvent): Boolean {
        val s = svc ?: return super.dispatchKeyEvent(e)
        if (s.handleKey(e)) return true
        val c = e.keyCode
        val map = when (c) {
            KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_PAGE_UP -> 'L'
            KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.KEYCODE_PAGE_DOWN -> 'R'
            KeyEvent.KEYCODE_DPAD_UP -> 'U'
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_SPACE -> 'C'
            else -> ' '
        }
        if (map == ' ' || dark.visibility != View.VISIBLE) return super.dispatchKeyEvent(e)
        if (e.action == KeyEvent.ACTION_DOWN && e.repeatCount == 0) when (map) {
            'L' -> s.stepL(); 'R' -> s.stepR(); 'U' -> s.bookmark(); 'C' -> s.toggle()
        }
        return true
    }

    // ---------- 화면 갱신 ----------
    private val tick = object : Runnable {
        override fun run() {
            refresh(); h.postDelayed(this, 300)
        }
    }

    private fun refresh() {
        val s = svc ?: return
        if (ignoreSpin) {
            spinner.setSelection(if (s.bmOnly) Store.tracks.size else s.trackIdx, false)
            cont.isChecked = s.continuous; vcue.isChecked = s.voiceCue
            ignoreSpin = false
        }
        val want = if (s.bmOnly) Store.tracks.size else s.trackIdx
        if (spinner.selectedItemPosition != want) { ignoreSpin = true; spinner.setSelection(want, false); h.post { ignoreSpin = false } }
        val (q, ph) = s.phase()
        val it = s.queue.getOrNull(q)
        val bm = it != null && s.bookmarks().contains(it.key)
        val name = if (s.bmOnly && it != null) Store.tracks[it.ti].name else Store.tracks[s.trackIdx].name
        pos.text = "$name · ${q + 1}/${s.queue.size}${if (bm) " · ★" else ""}  ${if (ph == 'S') "지문" else "해설"}"
        stmt.text = it?.s ?: ""
        expV.text = if (it != null && ph == 'E') "정답 ${if (it.o) "O (맞는 말)" else "X (틀린 말)"}\n${it.exp}" else ""
        playBtn.text = if (s.player.isPlaying) "⏸ 정지" else "▶ 재생"
        speedBtns.forEach { (v, b) -> b.alpha = if (abs(v - s.speed) < .01f) 1f else .45f }
        gapBtns.forEach { (v, b) -> b.alpha = if (v == s.gapSec) 1f else .45f }
        if (dark.visibility == View.VISIBLE) {
            val f = s.flashText()
            darkText.text = "${SimpleDateFormat("HH:mm", Locale.KOREA).format(Date())}\n$name · ${q + 1}/${s.queue.size}\n${if (s.player.isPlaying) "▶ 읽는 중" else "⏸ 멈춤"}${if (f.isNotEmpty()) "\n$f" else ""}"
        }
    }
}

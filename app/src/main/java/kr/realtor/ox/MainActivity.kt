package kr.realtor.ox

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
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
import android.view.View
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

class MainActivity : Activity() {
    private val h = Handler(Looper.getMainLooper())
    private val svc get() = PlayerService.inst
    private lateinit var spinner: Spinner
    private lateinit var pos: TextView
    private lateinit var stmt: TextView
    private lateinit var expV: TextView
    private lateinit var playBtn: Button
    private var keyV: TextView? = null
    private lateinit var mapBox: LinearLayout
    private val gapBtns = ArrayList<Pair<Int, Button>>()
    private var synced = false
    // 화면 테마: auto(낮 7~19시 밝게, 밤 어둡게) / light / dark
    private val prefs by lazy { getSharedPreferences("ox", android.content.Context.MODE_PRIVATE) }
    // 학습 화면에서 고른 색 테마(🎨)를 그대로 따라감. '자동'이면 폰 다크 모드를 따라감
    private val wt: org.json.JSONObject? by lazy { try { prefs.getString("wtheme", "")!!.let { if (it.isBlank()) null else org.json.JSONObject(it) } } catch (e: Exception) { null } }
    private fun wantDark(): Boolean = wt?.let { it.optInt("dark", 0) == 1 } ?: ( (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES)
    private var dk = false
    private val WK = mapOf("#12151B" to "bg", "#1B1F27" to "card", "#262B35" to "line", "#2C3240" to "line", "#1F2A44" to "pri2")
    private fun w(k: String): String? = wt?.optString(k, "")?.ifBlank { null }
    private fun c(light: String, dark: String) = Color.parseColor(WK[dark]?.let { w(it) } ?: if (dk) dark else light)
    private val TXT get() = w("ink") ?: if (dk) "#E8EBF1" else "#1D2433"
    private val SUB get() = w("sub2") ?: if (dk) "#9AA3B5" else "#6B7385"
    private val PRI get() = w("pri") ?: if (dk) "#6F9BFF" else "#2457C5"
    private var spinBusy = false

    // 화면이 켜져 있을 때 들어오는 리모컨 키도 같은 매핑으로
    override fun dispatchKeyEvent(e: KeyEvent): Boolean = svc?.handleKey(e) == true || super.dispatchKeyEvent(e)

    override fun onCreate(b: Bundle?) {
        dk = wantDark()
        setTheme(if (dk) android.R.style.Theme_Material_NoActionBar else android.R.style.Theme_Material_Light_NoActionBar)
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
        intent?.getStringExtra("mode")?.let { m ->    // 상황별 학습에서 열었을 때
            i.action = "PRESET"; i.putExtra("mode", m).putExtra("sleep", intent.getIntExtra("sleep", 0)).putExtra("bus", intent.getIntExtra("bus", 0))
        }
        // 화면이 떠 있을 때는 일반 시작으로 충분(앞에 보이는 앱은 서비스 시작 제한이 없음)
        try { startService(i) } catch (e: Exception) { if (Build.VERSION.SDK_INT >= 26) startForegroundService(i) }
        setContentView(buildUi())
        h.post(tick)
    }

    override fun onResume() { super.onResume(); Updater.check(this) }

    // 탭 넘어갈 때 옆으로 미끄러지는 효과 없이 (학습 화면 탭들과 똑같이)
    override fun finish() { super.finish(); @Suppress("DEPRECATION") overridePendingTransition(0, 0) }

    override fun onDestroy() { h.removeCallbacksAndMessages(null); super.onDestroy() }

    // ---------- 화면 구성 ----------
    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
    private fun round(c: Int, r: Int) = GradientDrawable().apply { setColor(c); cornerRadius = dp(r).toFloat() }
    private fun card() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL; setPadding(dp(16), dp(14), dp(16), dp(14)); background = round(c("#FFFFFF", "#1B1F27"), 16)
        layoutParams = LinearLayout.LayoutParams(-1, -2).apply { setMargins(dp(12), dp(6), dp(12), dp(6)) }
    }
    private fun tv(t: String, sp: Float, bold: Boolean = false, color: String = TXT) = TextView(this).apply {
        text = t; textSize = sp; setTextColor(Color.parseColor(color)); setLineSpacing(0f, 1.25f); if (bold) setTypeface(typeface, Typeface.BOLD)
    }
    private fun btn(t: String, primary: Boolean = false, f: () -> Unit) = Button(this).apply {
        text = t; isAllCaps = false; textSize = 16f
        setTextColor(if (primary) Color.WHITE else Color.parseColor(TXT))
        background = round(if (primary) Color.parseColor(w("pri") ?: "#2563EB") else c("#EEF1F5", "#262B35"), 12)
        layoutParams = LinearLayout.LayoutParams(0, dp(56), 1f).apply { setMargins(dp(4), dp(4), dp(4), dp(4)) }
        setOnClickListener { f() }
    }
    private fun row(vararg v: View) = LinearLayout(this).apply { v.forEach { addView(it) } }
    private fun wide(b: Button) = b.apply { layoutParams = LinearLayout.LayoutParams(-1, dp(52)).apply { setMargins(dp(4), dp(6), dp(4), dp(4)) } }

    private fun buildUi(): View {
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(c("#F6F7F9", "#12151B")); setPadding(0, dp(12), 0, dp(24)) }

        // 지금 듣는 문항
        val c1 = card()
        spinner = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, Store.tracks.map { it.name } + LISTS.map { it.second })
            onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(p: AdapterView<*>?, v: View?, n: Int, id: Long) {
                    val s = svc ?: return
                    if (spinBusy || !synced) return
                    if (n >= Store.tracks.size) s.load(s.trackIdx, LISTS[n - Store.tracks.size].first, 0, false) else s.load(n, "all", 0, false)
                }
                override fun onNothingSelected(p: AdapterView<*>?) {}
            }
        }
        pos = tv("", 13f, color = SUB).apply { setPadding(0, dp(8), 0, 0) }
        stmt = tv("", 19f).apply { setPadding(0, dp(8), 0, dp(8)) }
        expV = tv("", 15f, color = if (dk) "#C9D1D9" else "#374151")
        Gloss.load(this)
        stmt.movementMethod = android.text.method.LinkMovementMethod.getInstance()
        expV.movementMethod = android.text.method.LinkMovementMethod.getInstance()
        stmt.textSize = 21f; stmt.setLineSpacing(0f, 1.35f)
        // 🤖 더보기 준비·음성 만드는 동안 움직이는 막대
        busyBar = android.widget.ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            isIndeterminate = true; visibility = View.GONE
            indeterminateTintList = android.content.res.ColorStateList.valueOf(Color.parseColor(PRI))
            layoutParams = LinearLayout.LayoutParams(-1, dp(10)).apply { topMargin = dp(6) }
        }
        val flag = Button(this).apply {
            text = "🚩"; textSize = 15f; background = null; minWidth = 0; minimumWidth = 0; setPadding(dp(8), 0, dp(4), 0)
            layoutParams = LinearLayout.LayoutParams(-2, dp(44)); setOnClickListener { reportItem() }
        }
        spinner.layoutParams = LinearLayout.LayoutParams(0, -2, 1f)
        val top = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL; addView(spinner); addView(flag) }
        listOf(top, pos, busyBar, stmt, expV).forEach { c1.addView(it) }
        col.addView(c1)

        // 조작: 큰 줄(이전·재생·다음) + 작은 줄(다시·★·자세히·속도·타이머)
        val c2 = card()
        playBtn = btn("▶ 재생", true) { svc?.act("toggle") }.apply { layoutParams = LinearLayout.LayoutParams(0, dp(60), 2f).apply { setMargins(dp(4), dp(4), dp(4), dp(4)) } }
        c2.addView(row(btn("⏮") { svc?.act("itemPrev") }.apply { textSize = 20f }, playBtn, btn("⏭") { svc?.act("itemNext") }.apply { textSize = 20f }))
        fun small(b: Button) = b.apply { textSize = 13f; setPadding(0, 0, 0, 0); minWidth = 0; minimumWidth = 0; maxLines = 1; isSingleLine = true; layoutParams = LinearLayout.LayoutParams(0, dp(44), 1f).apply { setMargins(dp(3), dp(3), dp(3), dp(3)) } }
        speedBtn = small(btn("1배") {
            val l = listOf(0.8f, 1f, 1.2f, 1.5f); val s = svc ?: return@btn
            s.speed = l[(l.indexOfFirst { abs(it - s.speed) < .01f } + 1) % l.size] })
        timerBtn = small(btn("⏱") { timerDialog() })
        c2.addView(row(small(btn("↩ 다시") { svc?.act("stepBack") }), small(btn("★") { svc?.act("bookmark") }),
            small(btn("🤖더보기") { svc?.act("detail") ?: android.widget.Toast.makeText(this, "먼저 ▶ 재생을 눌러 주세요", android.widget.Toast.LENGTH_SHORT).show() }), speedBtn, timerBtn))
        alertBtn = wide(btn("🚌 하차 알림 끄기", true) { svc?.stopAlert() }).apply { visibility = View.GONE }
        c2.addView(alertBtn)
        col.addView(c2)

        // ---- 아래는 모두 ⚙ 설정 안에 접어 둠 ----
        val c3 = card()
        c3.addView(CheckBox(this).apply { text = "계속 듣기 (끄면 한 문항씩 멈춰요)"; textSize = 15f; setTextColor(Color.parseColor(TXT))
            isChecked = prefs.getBoolean("cont", false); setOnCheckedChangeListener { _, v -> svc?.continuous = v } })
        c3.addView(CheckBox(this).apply { text = "동작 안내 말하기 (\"다음 지문\" 등)"; textSize = 15f; setTextColor(Color.parseColor(TXT))
            isChecked = prefs.getBoolean("vcue", true); setOnCheckedChangeListener { _, v -> svc?.voiceCue = v } })
        c3.addView(tv("지문 뒤 생각 시간", 14f, true).apply { setPadding(0, dp(8), 0, 0) })
        c3.addView(row(*listOf(1, 3, 5, 8).map { v -> small(btn("${v}초") { svc?.gapSec = v }).also { gapBtns.add(v to it) } }.toTypedArray()))
        usageV = tv("", 13f, color = SUB).apply { setPadding(0, dp(10), 0, 0) }
        c3.addView(usageV)

        // 인터넷 기능 키: 직접 붙여넣어 폰에만 저장
        val c5 = card()
        c5.addView(tv("🔑 키 (더 자세히·AI 해설용)", 15f, true))
        listOf("gemini" to "Gemini API 키", "tts" to "구글 클라우드 음성 키").forEach { (k, n) ->
            val f = android.widget.EditText(this).apply {
                hint = n; textSize = 14f; setTextColor(Color.parseColor(TXT)); setHintTextColor(Color.parseColor(SUB))
                inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
                setText(prefs.getString("key_$k", ""))
                setOnFocusChangeListener { _, has -> if (!has) prefs.edit().putString("key_$k", text.toString().trim()).apply() }
            }
            c5.addView(f)
        }
        c5.addView(wide(btn("키 저장") { currentFocus?.clearFocus(); android.widget.Toast.makeText(this, "저장했어요", android.widget.Toast.LENGTH_SHORT).show() }))
        col.addView(c5)

        // 리모컨 매핑
        val c4 = card()
        c4.addView(tv("🎮 링 리모컨", 15f, true))
        c4.addView(tv("화면이 꺼져도 되는 건 왼쪽·가운데·오른쪽 길게 누르기 3개예요. 오른쪽 칸을 눌러 바꿔요.", 13f, color = SUB).apply { setPadding(0, dp(4), 0, dp(4)) })
        mapBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        c4.addView(mapBox)
        keyV = tv("", 13f, color = SUB).apply { setPadding(0, dp(6), 0, 0) }
        c4.addView(keyV)
        c4.addView(wide(btn("기본값으로") { svc?.resetMap(); drawMap() }))
        col.addView(c4)
        col.addView(c3, col.indexOfChild(c5))

        val more = listOf(c3, c5, c4)
        val needKey = prefs.getString("key_gemini", "").isNullOrBlank() || prefs.getString("key_tts", "").isNullOrBlank()
        var open = needKey || prefs.getBoolean("moreOpen", false)
        val tg = btn("") { }.apply { textSize = 14f; setTextColor(Color.parseColor(SUB)); background = null }
        fun apply() { more.forEach { it.visibility = if (open) View.VISIBLE else View.GONE }; tg.text = if (open) "⚙ 설정 접기 ▲" else "⚙ 설정 ▼" }
        tg.setOnClickListener { open = !open; prefs.edit().putBoolean("moreOpen", open).apply(); apply() }
        col.addView(wide(tg), col.indexOfChild(c3)); apply()

        // 가운데 정렬, 넓은 화면에서도 너무 퍼지지 않게
        col.layoutParams = FrameLayout.LayoutParams(minOf(resources.displayMetrics.widthPixels, dp(640)), FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER_HORIZONTAL)
        val center = FrameLayout(this).apply { addView(col) }
        val sv = ScrollView(this).apply { addView(center); isFillViewport = true; layoutParams = LinearLayout.LayoutParams(-1, 0, 1f) }
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; addView(sv); addView(tabBar()) }
        return safeArea(root, c("#F6F7F9", "#12151B"))
    }

    /** 학습 화면과 같은 맨 아래 탭 4개 (듣기 = 지금 화면) */
    private fun tabBar(): View {
        // 학습 화면에서 잰 실제 픽셀 크기: 전체 높이, 아이콘 위치, 아이콘 줄 높이, 아이콘 칸 너비, 아이콘 글자, 탭 글자, 탭 글자 줄
        val m = prefs.getString("tabpx", "")!!.split(",").mapNotNull { it.toIntOrNull() }
        val px = if (m.size == 7) m else listOf(dp(63), dp(9), dp(25), dp(56), dp(21), dp(12), dp(19))
        val (navH, iconTop, iconH, iconW) = px; val iconFs = px[4]; val labFs = px[5]; val labLh = px[6]
        val line = maxOf(1, dp(1) / 2)
        val pri = Color.parseColor(PRI)
        val wrap = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(c("#FFFFFF", "#1B1F27")) }
        wrap.addView(View(this).apply { setBackgroundColor(c("#E3E6EC", "#2C3240")); layoutParams = LinearLayout.LayoutParams(-1, line) })
        val bar = LinearLayout(this).apply { gravity = Gravity.CENTER_HORIZONTAL; layoutParams = LinearLayout.LayoutParams(-1, navH - line) }
        listOf(Triple("🏠", "오늘", "home"), Triple("✏️", "문제", "setup"), Triple("🎧", "듣기", ""), Triple("📊", "기록", "wrong")).forEach { (ic, n, v) ->
            val on = v.isEmpty()
            val cell = FrameLayout(this).apply { layoutParams = LinearLayout.LayoutParams(0, -1, 1f).apply { width = 0 }
                setOnClickListener { if (!on) { startActivity(Intent(this@MainActivity, WebActivity::class.java).putExtra("tab", v).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)); finish() } } }
            val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL; setPadding(0, iconTop - line, 0, 0)
                layoutParams = FrameLayout.LayoutParams(-1, -1) }
            col.addView(TextView(this).apply { text = ic; setTextSize(android.util.TypedValue.COMPLEX_UNIT_PX, iconFs.toFloat()); includeFontPadding = false; gravity = Gravity.CENTER
                if (on) background = round(c("#E8EEFB", "#1F2A44"), 14)
                layoutParams = LinearLayout.LayoutParams(iconW, iconH) })
            col.addView(TextView(this).apply { text = n; setTextSize(android.util.TypedValue.COMPLEX_UNIT_PX, labFs.toFloat()); includeFontPadding = false; gravity = Gravity.CENTER
                setTextColor(if (on) pri else Color.parseColor(SUB)); if (on) setTypeface(typeface, Typeface.BOLD)
                layoutParams = LinearLayout.LayoutParams(-1, labLh) })
            cell.addView(col)
            if (on) cell.addView(View(this).apply { background = round(pri, 2)      // 선택된 탭 위쪽 막대
                layoutParams = FrameLayout.LayoutParams(-1, dp(3), Gravity.TOP).apply { leftMargin = 0; rightMargin = 0 } }.also { bar.post { val w = cell.width; (it.layoutParams as FrameLayout.LayoutParams).apply { leftMargin = (w * .28).toInt(); rightMargin = (w * .28).toInt() }; it.requestLayout() } })
            bar.addView(cell)
        }
        wrap.addView(bar)
        return wrap
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
                    background = round(c("#EEF1F5", "#262B35"), 10); setTextColor(Color.parseColor(TXT)); setPadding(dp(12), 0, dp(12), 0)
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

    // ---------- 화면 갱신 ----------
    private val tick = object : Runnable { override fun run() { refresh(); h.postDelayed(this, 300) } }

    /** 해설 차례면 틀린 부분을 빨간 굵은 밑줄로, 바른 말을 아래에 */
    private fun stmtText(it: Item?, showAns: Boolean): CharSequence {
        if (it == null) return ""
        val mk = if (showAns) Store.markOf(it) else null
        val cx = Store.ctx[it.key]?.let { c -> "📋 상황 · " + (if (c.length > 320) c.take(320) + "…" else c) + "\n\n" } ?: ""
        val b = android.text.SpannableStringBuilder(cx + it.s)
        if (cx.isNotEmpty()) {
            b.setSpan(android.text.style.RelativeSizeSpan(.72f), 0, cx.length, 0)
            b.setSpan(android.text.style.ForegroundColorSpan(Color.parseColor(SUB)), 0, cx.length, 0)
        }
        if (mk != null) {
            val i = it.s.indexOf(mk.first).let { k -> if (k >= 0) k + cx.length else k }
            if (i >= 0) listOf(android.text.style.ForegroundColorSpan(Color.parseColor("#DC2626")), android.text.style.StyleSpan(android.graphics.Typeface.BOLD),
                android.text.style.UnderlineSpan()).forEach { sp -> b.setSpan(sp, i, i + mk.first.length, 0) }
            if (mk.second.isNotBlank()) {
                val st = b.length; b.append("\n→ 바르게: ").append(mk.second)
                b.setSpan(android.text.style.ForegroundColorSpan(Color.parseColor("#16A34A")), st, b.length, 0)
                b.setSpan(android.text.style.StyleSpan(android.graphics.Typeface.BOLD), st, b.length, 0)
            }
        }
        return glossed(b)
    }
    private fun glossed(b: android.text.SpannableStringBuilder) = Gloss.apply(b, Color.parseColor(if (dk) "#C4B5FD" else "#7C3AED")) { k, v ->
        AlertDialog.Builder(this).setTitle("📖 $k").setMessage(v).setPositiveButton("알겠어요", null).show()
    }
    private fun expText(it: Item?, showAns: Boolean, detail: String): CharSequence {
        val b = android.text.SpannableStringBuilder()
        if (it != null && showAns) {
            val head = if (it.o) "⭕ 정답 O · 맞는 말" else "❌ 정답 X · 틀린 말"
            b.append(head)
            b.setSpan(android.text.style.ForegroundColorSpan(Color.parseColor(if (it.o) "#16A34A" else "#DC2626")), 0, head.length, 0)
            b.setSpan(android.text.style.StyleSpan(android.graphics.Typeface.BOLD), 0, head.length, 0)
            b.setSpan(android.text.style.RelativeSizeSpan(1.1f), 0, head.length, 0)
            b.append("\n").append(it.exp)
        }
        if (detail.isNotEmpty()) b.append(if (b.isEmpty()) "🤖 " else "\n\n🤖 ").append(detail.trim())
        return glossed(b)
    }
    private var textSig = ""
    private var usageV: TextView? = null
    private lateinit var alertBtn: Button
    private lateinit var speedBtn: Button
    private lateinit var busyBar: android.widget.ProgressBar
    private lateinit var timerBtn: Button
    /** 🚩 지금 지문 신고 → GitHub 이슈(제출 한 번). 자동으로 원본 다시 읽고, 듣기 지문은 확인 후 고침 */
    private fun reportItem() {
        val it = svc?.currentItem() ?: return android.widget.Toast.makeText(this, "먼저 ▶ 재생을 눌러 주세요", android.widget.Toast.LENGTH_SHORT).show()
        val rs = arrayOf("지문 앞 내용(상황)이 빠졌어요", "지문 글이 깨지거나 잘렸어요", "O·X 정답이 틀린 것 같아요", "해설이 이상하거나 부족해요", "기타")
        val on = BooleanArray(rs.size).also { a -> a[0] = Store.ctx[it.key] == null && Regex("[甲乙丙丁]").containsMatchIn(it.s) }
        AlertDialog.Builder(this).setTitle("🚩 이 지문 신고")
            .setMultiChoiceItems(rs, on) { _, i, v -> on[i] = v }
            .setNegativeButton("닫기", null)
            .setPositiveButton("보내기") { _, _ ->
                val body = "문항: ${it.ref}\nOX 지문: ${it.key} (${Store.tracks[it.ti].name})\n\n" +
                    rs.indices.joinToString("\n") { i -> "- [${if (on[i]) "x" else " "}] ${rs[i]}" } +
                    "\n\n--- 지금 앱에 보이는 지문 ---\n${it.s}\n정답: ${if (it.o) "O" else "X"}\n\n해설: ${it.exp.take(600)}"
                val url = "https://github.com/huhsj4141-afk/realtor-ox-app/issues/new?title=" + Uri.encode("[신고] ${it.ref} 듣기 ${it.key}") + "&body=" + Uri.encode(body)
                try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (e: Exception) { }
                android.widget.Toast.makeText(this, "GitHub 화면에서 초록색 Submit(제출)을 눌러 주세요", android.widget.Toast.LENGTH_LONG).show()
            }.show()
    }
    private fun timerDialog() {
        val o = listOf("😴 잠자기 15분" to { svc?.setSleep(15) }, "😴 잠자기 30분" to { svc?.setSleep(30) }, "😴 잠자기 60분" to { svc?.setSleep(60) },
            "🚌 하차 알림 10분" to { svc?.setBus(10) }, "🚌 하차 알림 20분" to { svc?.setBus(20) }, "🚌 하차 알림 30분" to { svc?.setBus(30) }, "🚌 하차 알림 40분" to { svc?.setBus(40) },
            "⏹ 타이머 모두 끄기" to { svc?.setSleep(0); svc?.setBus(0) })
        AlertDialog.Builder(this).setTitle("⏱ 타이머").setItems(o.map { it.first }.toTypedArray()) { _, i -> o[i].second() }.setNegativeButton("닫기", null).show()
    }
    private var slowAt = 0L
    private val LISTS = listOf("mix" to "🔀 골고루 섞기", "bm" to "★ 북마크", "wrong" to "❌ 틀린 문제", "review" to "🔁 복습하기")
    private fun mmss(sec: Int) = "%d:%02d".format(sec / 60, sec % 60)
    private fun refresh() {
        usageV?.text = Usage.summary(this)
        val s = svc ?: return
        if (!synced) { synced = true; drawMap() }
        if (wantDark() != dk) { recreate(); return }
        keyV?.text = if (s.lastKey.isEmpty()) "마지막으로 받은 신호: 아직 없음" else "마지막으로 받은 신호: ${s.lastKey}"
        val want = if (s.isList) Store.tracks.size + LISTS.indexOfFirst { it.first == s.mode } else s.trackIdx
        alertBtn.visibility = if (s.alerting) View.VISIBLE else View.GONE
        timerBtn.text = listOfNotNull(
            if (s.sleepEnd > 0) "😴${s.left(s.sleepEnd) / 60 + 1}분" else null,
            if (s.busEnd > 0) "🚌${s.left(s.busEnd) / 60 + 1}분" else null).joinToString(" ").ifEmpty { "⏱" }
        if (spinner.selectedItemPosition != want) { spinBusy = true; spinner.setSelection(want, false); h.post { spinBusy = false } }
        busyBar.visibility = if (s.flashText().contains("중…")) View.VISIBLE else View.GONE
        val (q, ph) = s.phase()
        val it = s.queue.getOrNull(q)
        val name = if (it != null) Store.tracks[it.ti].name else ""
        val bm = it != null && s.bookmarks().contains(it.key)
        pos.text = "$name · ${q + 1}/${s.queue.size}${if (bm) " · ★" else ""} · ${if (ph == 'S') "지문" else "해설"}" +
            s.flashText().let { f -> if (f.isNotEmpty()) "\n$f" else "" }
        val sig = "${it?.key}|$ph|${s.detailKey}|${s.detailText.length}"
        if (sig != textSig) {      // 내용이 바뀔 때만 다시 그림 (용어 누르기가 끊기지 않게)
            textSig = sig
            stmt.text = stmtText(it, ph == 'E')
            expV.text = expText(it, ph == 'E', if (it != null && s.detailKey == it.key) s.detailText else "")
        }
        playBtn.text = if (s.player.isPlaying) "⏸ 정지" else "▶ 재생"
        speedBtn.text = "${if (s.speed % 1f == 0f) s.speed.toInt().toString() else s.speed.toString()}배"
        gapBtns.forEach { (v, b) -> b.alpha = if (v == s.gapSec) 1f else .45f }
    }
}

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
    private val speedBtns = ArrayList<Pair<Float, Button>>()
    private val gapBtns = ArrayList<Pair<Int, Button>>()
    private var synced = false
    // 화면 테마: auto(낮 7~19시 밝게, 밤 어둡게) / light / dark
    private val prefs by lazy { getSharedPreferences("ox", android.content.Context.MODE_PRIVATE) }
    private fun wantDark(): Boolean = when (prefs.getString("theme", "auto")) {
        "dark" -> true; "light" -> false
        else -> java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY).let { it >= 19 || it < 7 }
    }
    private var dk = false
    private fun c(light: String, dark: String) = Color.parseColor(if (dk) dark else light)
    private val TXT get() = if (dk) "#E6EDF3" else "#111827"
    private val SUB get() = if (dk) "#9AA4AF" else "#6B7280"
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

    override fun onDestroy() { h.removeCallbacksAndMessages(null); super.onDestroy() }

    // ---------- 화면 구성 ----------
    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
    private fun round(c: Int, r: Int) = GradientDrawable().apply { setColor(c); cornerRadius = dp(r).toFloat() }
    private fun card() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL; setPadding(dp(16), dp(14), dp(16), dp(14)); background = round(c("#FFFFFF", "#161B22"), 16)
        layoutParams = LinearLayout.LayoutParams(-1, -2).apply { setMargins(dp(12), dp(6), dp(12), dp(6)) }
    }
    private fun tv(t: String, sp: Float, bold: Boolean = false, color: String = TXT) = TextView(this).apply {
        text = t; textSize = sp; setTextColor(Color.parseColor(color)); setLineSpacing(0f, 1.25f); if (bold) setTypeface(typeface, Typeface.BOLD)
    }
    private fun btn(t: String, primary: Boolean = false, f: () -> Unit) = Button(this).apply {
        text = t; isAllCaps = false; textSize = 16f
        setTextColor(if (primary) Color.WHITE else Color.parseColor(TXT))
        background = round(if (primary) Color.parseColor("#2563EB") else c("#EEF1F5", "#21262D"), 12)
        layoutParams = LinearLayout.LayoutParams(0, dp(56), 1f).apply { setMargins(dp(4), dp(4), dp(4), dp(4)) }
        setOnClickListener { f() }
    }
    private fun row(vararg v: View) = LinearLayout(this).apply { v.forEach { addView(it) } }
    private fun wide(b: Button) = b.apply { layoutParams = LinearLayout.LayoutParams(-1, dp(52)).apply { setMargins(dp(4), dp(6), dp(4), dp(4)) } }

    private fun buildUi(): View {
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(c("#F5F6F8", "#0B0F14")); setPadding(0, dp(12), 0, dp(24)) }
        col.addView(tv("🎧 공인중개사 OX 듣기", 22f, true).apply { setPadding(dp(18), dp(8), dp(18), dp(6)) })

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
        todayV = tv("", 13f, color = SUB).apply { setPadding(0, dp(2), 0, 0) }
        listOf(spinner, todayV!!, pos, stmt, expV).forEach { c1.addView(it) }
        col.addView(c1)

        // 조작 버튼 (리모컨 동작과 같은 것만)
        val c2 = card()
        playBtn = btn("▶ 재생", true) { svc?.act("toggle") }
        c2.addView(row(btn("◀ 뒤로") { svc?.act("stepBack") }, playBtn, btn("앞으로 ▶") { svc?.act("stepFwd") }))
        c2.addView(row(btn("⏮ 이전 문항") { svc?.act("itemPrev") }, btn("다음 문항 ⏭") { svc?.act("itemNext") }))
        c2.addView(row(btn("★ 북마크") { svc?.act("bookmark") }, btn("🤖 더 자세히") { svc?.act("detail") ?: android.widget.Toast.makeText(this, "먼저 ▶ 재생을 눌러 주세요", android.widget.Toast.LENGTH_SHORT).show() }))
        alertBtn = wide(btn("🚌 하차 알림 끄기", true) { svc?.stopAlert() }).apply { visibility = View.GONE }
        c2.addView(alertBtn)
        col.addView(c2)

        // 타이머
        val ct = card()
        ct.addView(tv("⏲ 타이머", 16f, true))
        ct.addView(tv("잠자기: 정한 시간 뒤 소리가 작아지다 멈춰요", 13f, color = SUB).apply { setPadding(0, dp(6), 0, 0) })
        ct.addView(row(*listOf(0, 15, 30, 60).map { m -> btn(if (m == 0) "끄기" else "${m}분") { svc?.setSleep(m) } }.toTypedArray()))
        ct.addView(tv("🚌 하차 알림: 2분 전 한 번, 시간이 되면 진동과 음성으로 계속 알려요 (아무 버튼이나 누르면 꺼짐)", 13f, color = SUB).apply { setPadding(0, dp(10), 0, 0) })
        ct.addView(row(*listOf(0, 5, 10, 15).map { m -> btn(if (m == 0) "끄기" else "${m}분") { svc?.setBus(m) } }.toTypedArray()))
        ct.addView(row(*listOf(20, 30, 40, 60).map { m -> btn("${m}분") { svc?.setBus(m) } }.toTypedArray()))
        timerV = tv("", 14f).apply { setPadding(0, dp(6), 0, 0) }
        ct.addView(timerV)
        col.addView(ct)

        // 듣는 방식
        val c3 = card()
        c3.addView(CheckBox(this).apply { text = "계속 듣기 (끄면 한 문항씩 멈춰요)"; textSize = 15f; setTextColor(Color.parseColor(TXT))
            isChecked = getSharedPreferences("ox", android.content.Context.MODE_PRIVATE).getBoolean("cont", false)
            setOnCheckedChangeListener { _, v -> svc?.continuous = v } })
        c3.addView(CheckBox(this).apply { text = "동작 안내 말하기 (\"다음 지문\" 등)"; textSize = 15f; setTextColor(Color.parseColor(TXT))
            isChecked = getSharedPreferences("ox", android.content.Context.MODE_PRIVATE).getBoolean("vcue", true)
            setOnCheckedChangeListener { _, v -> svc?.voiceCue = v } })
        c3.addView(tv("속도", 14f, true).apply { setPadding(0, dp(8), 0, 0) })
        c3.addView(row(*listOf(0.8f, 1f, 1.2f, 1.5f).map { v -> btn("${v}배") { svc?.speed = v }.also { speedBtns.add(v to it) } }.toTypedArray()))
        c3.addView(tv("지문 뒤 생각 시간", 14f, true).apply { setPadding(0, dp(8), 0, 0) })
        c3.addView(row(*listOf(1, 3, 5, 8).map { v -> btn("${v}초") { svc?.gapSec = v }.also { gapBtns.add(v to it) } }.toTypedArray()))
        c3.addView(tv("화면", 14f, true).apply { setPadding(0, dp(8), 0, 0) })
        val th = prefs.getString("theme", "auto")
        c3.addView(row(*listOf("auto" to "자동 (낮·밤)", "light" to "밝게", "dark" to "어둡게").map { (k, n) ->
            btn(n) { prefs.edit().putString("theme", k).apply(); recreate() }.apply { alpha = if (k == th) 1f else .45f } }.toTypedArray()))
        col.addView(c3)

        val cu = card()
        cu.addView(tv("💰 이번 달 사용량·요금", 16f, true))
        usageV = tv("", 14f, color = SUB).apply { setPadding(0, dp(6), 0, 0) }
        cu.addView(usageV)
        cu.addView(wide(btn("🔄 업데이트 확인") { Updater.check(this, true) }))
        col.addView(cu)

        // 인터넷 기능 키 (더 자세히·문제 해설 AI): 직접 붙여넣어 폰에만 저장
        val c5 = card()
        c5.addView(tv("🔑 키 설정 (더 자세히·AI 해설용)", 16f, true))
        listOf("gemini" to "Gemini API 키", "tts" to "구글 클라우드 음성 키").forEach { (k, n) ->
            val f = android.widget.EditText(this).apply {
                hint = n; textSize = 14f; setTextColor(Color.parseColor(TXT)); setHintTextColor(Color.parseColor(SUB))
                inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
                setText(prefs.getString("key_$k", ""))
            }
            c5.addView(f)
            c5.addView(wide(btn("$n 저장") { prefs.edit().putString("key_$k", f.text.toString().trim()).apply(); android.widget.Toast.makeText(this, "저장했어요", android.widget.Toast.LENGTH_SHORT).show() }))
        }
        col.addView(c5)

        // 리모컨 매핑
        val c4 = card()
        c4.addView(tv("🎮 링 리모컨", 16f, true))
        c4.addView(tv("화면이 꺼져도 되는 건 왼쪽·가운데·오른쪽 길게 누르기 3개뿐이에요. 오른쪽 칸을 눌러 동작을 바꿀 수 있어요.", 13f, color = SUB).apply { setPadding(0, dp(4), 0, dp(4)) })
        mapBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        c4.addView(mapBox)
        keyV = tv("", 13f, color = SUB).apply { setPadding(0, dp(6), 0, 0) }
        c4.addView(keyV)
        c4.addView(wide(btn("기본값으로") { svc?.resetMap(); drawMap() }))
        col.addView(c4)

        // 자주 안 쓰는 설정(사용량·키·리모컨)은 접어 두기. 키가 비어 있으면 펼쳐서 보여 줌
        val more = listOf(cu, c5, c4)
        val needKey = prefs.getString("key_gemini", "").isNullOrBlank() || prefs.getString("key_tts", "").isNullOrBlank()
        var open = needKey || prefs.getBoolean("moreOpen", false)
        val tg = btn("") { }
        fun apply() { more.forEach { it.visibility = if (open) View.VISIBLE else View.GONE }; tg.text = if (open) "⚙ 설정 접기" else "⚙ 사용량·키·리모컨 설정" }
        tg.setOnClickListener { open = !open; prefs.edit().putBoolean("moreOpen", open).apply(); apply() }
        col.addView(wide(tg), col.indexOfChild(cu)); apply()

        // 가운데 정렬, 넓은 화면에서도 너무 퍼지지 않게
        col.layoutParams = FrameLayout.LayoutParams(minOf(resources.displayMetrics.widthPixels, dp(640)), FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER_HORIZONTAL)
        val center = FrameLayout(this).apply { addView(col) }
        return safeArea(ScrollView(this).apply { addView(center); isFillViewport = true }, c("#F5F6F8", "#0B0F14"))
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
                    background = round(c("#EEF1F5", "#21262D"), 10); setTextColor(Color.parseColor(TXT)); setPadding(dp(12), 0, dp(12), 0)
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
        val b = android.text.SpannableStringBuilder(it.s)
        if (mk != null) {
            val i = it.s.indexOf(mk.first)
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
        if (detail.isNotEmpty()) b.append("\n\n🤖 ").append(detail)
        return glossed(b)
    }
    private var textSig = ""
    private var usageV: TextView? = null
    private var todayV: TextView? = null
    private var timerV: TextView? = null
    private lateinit var alertBtn: Button
    private var slowAt = 0L
    private val LISTS = listOf("mix" to "🔀 골고루 섞기 (과목·단원 번갈아, 덜 들은 것부터)", "bm" to "★ 북마크만 듣기", "wrong" to "❌ 틀린 문제 지문만", "review" to "🔁 오늘 복습 (북마크·틀린 문제)")
    private fun mmss(sec: Int) = "%d:%02d".format(sec / 60, sec % 60)
    private fun refresh() {
        usageV?.text = Usage.summary(this)
        val s = svc ?: return
        if (!synced) { synced = true; drawMap() }
        if (wantDark() != dk) { recreate(); return }
        keyV?.text = if (s.lastKey.isEmpty()) "마지막으로 받은 신호: 아직 없음" else "마지막으로 받은 신호: ${s.lastKey}"
        val want = if (s.isList) Store.tracks.size + LISTS.indexOfFirst { it.first == s.mode } else s.trackIdx
        alertBtn.visibility = if (s.alerting) View.VISIBLE else View.GONE
        timerV?.text = listOfNotNull(
            if (s.sleepEnd > 0) "⏲ 잠자기 ${mmss(s.left(s.sleepEnd))} 남음" else null,
            if (s.busEnd > 0) "🚌 하차 알림 ${mmss(s.left(s.busEnd))} 남음" else null,
            if (s.alerting) "🚌 지금 하차 알림 중!" else null).joinToString("\n").ifEmpty { "켜진 타이머 없음" }
        if (SystemClock.elapsedRealtime() - slowAt > 5000) {      // 무거운 계산은 5초마다
            slowAt = SystemClock.elapsedRealtime()
            todayV?.text = "${Study.todayLine(this)} · 오늘 복습할 지문 ${s.itemsOf("review").size}개"
        }
        if (spinner.selectedItemPosition != want) { spinBusy = true; spinner.setSelection(want, false); h.post { spinBusy = false } }
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
        speedBtns.forEach { (v, b) -> b.alpha = if (abs(v - s.speed) < .01f) 1f else .45f }
        gapBtns.forEach { (v, b) -> b.alpha = if (v == s.gapSec) 1f else .45f }
    }
}

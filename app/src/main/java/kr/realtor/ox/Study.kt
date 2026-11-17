package kr.realtor.ox

import android.content.Context
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** 공부 기록 (폰 저장소): 틀린 문제, 간격 복습 일정, 날짜별 듣기 통계 */
object Study {
    private fun p(ctx: Context) = ctx.getSharedPreferences("study", Context.MODE_PRIVATE)
    private fun dayNo() = (System.currentTimeMillis() + java.util.TimeZone.getDefault().getOffset(System.currentTimeMillis())) / 86_400_000L
    fun dayKey(): String = SimpleDateFormat("yyyy-MM-dd", Locale.KOREA).format(Date())   // 웹 학습 일지와 같은 형식

    // ---------- 틀린 문제: 웹 기출 풀이에서 마지막에 틀린 문제 번호 (OX 지문의 ref와 같음) ----------
    fun setWrong(ctx: Context, refs: Set<String>) { p(ctx).edit().putStringSet("wrong", refs).apply() }
    fun wrong(ctx: Context): Set<String> = p(ctx).getStringSet("wrong", emptySet()) ?: emptySet()

    // ---------- 간격 복습: 들을 때마다 다음 복습일이 1·3·7·14·30일 뒤로 ----------
    private val GAPS = intArrayOf(1, 3, 7, 14, 30)
    private fun rv(ctx: Context) = try { JSONObject(p(ctx).getString("rv", "{}")!!) } catch (e: Exception) { JSONObject() }
    /** 복습할 차례인가 (처음 들어온 지문은 바로 복습 대상) */
    fun isDue(ctx: Context, key: String, r: JSONObject = rv(ctx)): Boolean =
        r.optJSONArray(key)?.let { it.optLong(1) <= dayNo() } ?: true
    fun dueOf(ctx: Context, keys: Collection<String>): Set<String> { val r = rv(ctx); return keys.filter { isDue(ctx, it, r) }.toSet() }
    /** 해설까지 다 들음 → 복습 단계 올리기 (차례가 아니면 그대로) */
    fun heard(ctx: Context, key: String) {
        val r = rv(ctx)
        if (!isDue(ctx, key, r)) return
        val st = ((r.optJSONArray(key)?.optInt(0) ?: 0) + 1).coerceAtMost(GAPS.size)
        r.put(key, org.json.JSONArray().put(st).put(dayNo() + GAPS[st - 1]))
        p(ctx).edit().putString("rv", r.toString()).apply()
    }

    // ---------- 지문별 들은 횟수·마지막으로 들은 때 (골고루 섞기용) ----------
    private fun hc(ctx: Context) = try { JSONObject(p(ctx).getString("hc", "{}")!!) } catch (e: Exception) { JSONObject() }
    fun heardOnce(ctx: Context, key: String) {
        val h = hc(ctx); val a = h.optJSONArray(key)
        h.put(key, org.json.JSONArray().put((a?.optInt(0) ?: 0) + 1).put(System.currentTimeMillis()))
        p(ctx).edit().putString("hc", h.toString()).apply()
    }
    /** 과목을 번갈아 가며, 과목 안에서는 덜 들은·오래전에 들은 지문부터 n개 */
    fun mix(ctx: Context, tracks: List<Track>, n: Int = 60): List<Item> {
        val h = hc(ctx); val rnd = java.util.Random()
        fun score(it: Item): Double { val a = h.optJSONArray(it.key); return (a?.optInt(0) ?: 0) * 1e13 + (a?.optLong(1) ?: 0L) + rnd.nextInt(3_600_000) }
        val bySub = tracks.flatMap { it.items }.groupBy { tracks[it.ti].sub }.mapValues { (_, v) -> v.sortedBy { score(it) }.toMutableList() }
        val out = ArrayList<Item>(); val subs = bySub.keys.shuffled()
        while (out.size < n && bySub.values.any { it.isNotEmpty() })
            for (s in subs) { val l = bySub[s]!!; if (l.isNotEmpty() && out.size < n) out.add(l.removeAt(0)) }
        return out
    }

    // ---------- 날짜별 듣기 통계: 들은 시간(초), 끝까지 들은 지문 수, 과목별 수 ----------
    private fun stats(ctx: Context) = try { JSONObject(p(ctx).getString("st", "{}")!!) } catch (e: Exception) { JSONObject() }
    private fun bump(ctx: Context, f: (JSONObject) -> Unit) {
        val all = stats(ctx); val k = dayKey()
        val d = all.optJSONObject(k) ?: JSONObject().put("lsec", 0).put("ox", 0).put("oxs", JSONObject())
        f(d); all.put(k, d)
        // 60일 넘은 날은 지움
        all.keys().asSequence().toList().sorted().dropLast(60).forEach { all.remove(it) }
        p(ctx).edit().putString("st", all.toString()).apply()
    }
    fun addSec(ctx: Context, sec: Int) = bump(ctx) { it.put("lsec", it.optInt("lsec") + sec) }
    fun addOx(ctx: Context, sub: Int) = bump(ctx) {
        it.put("ox", it.optInt("ox") + 1)
        val s = it.optJSONObject("oxs") ?: JSONObject(); s.put("$sub", s.optInt("$sub") + 1); it.put("oxs", s)
    }
    fun statsJson(ctx: Context): String = stats(ctx).toString()
    fun todayLine(ctx: Context): String {
        val d = stats(ctx).optJSONObject(dayKey()) ?: return "오늘 들은 지문 0개"
        return "오늘 들은 지문 ${d.optInt("ox")}개 · ${d.optInt("lsec") / 60}분"
    }
}

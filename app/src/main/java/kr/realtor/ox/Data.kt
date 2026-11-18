package kr.realtor.ox

import android.content.Context
import org.json.JSONObject
import org.json.JSONArray

class Item(val ti: Int, val i: Int, val s: String, val o: Boolean, val theme: String, val exp: String, val ref: String = "") {
    val key get() = "${ti}_$i"
}

class Track(val name: String, val sub: Int, val items: List<Item>)

object Store {
    var tracks: List<Track> = emptyList()
    val SUBS = listOf("학개론", "민법", "중개사법", "공법", "공시법", "세법")

    /** X 지문의 틀린 부분과 바른 말 (gen/ox_mark.json) — 없으면 해설의 "A가 아니라 B"에서 찾음 */
    val marks = HashMap<String, Pair<String, String>>()
    /** 사례 문제의 앞 상황 (gen/ox_ctx.json) — 甲·乙 지문이 무슨 얘긴지 알 수 있게 */
    val ctx = HashMap<String, String>()
    var hasCtxAudio: Set<String> = emptySet()
    fun markOf(it: Item): Pair<String, String>? {
        if (it.o) return null
        marks[it.key]?.let { return it }
        val m = Regex("([가-힣A-Za-z0-9·]{2,15})\\s*(?:이|가|은|는)?\\s*아니(?:라|고)\\s*([가-힣A-Za-z0-9·]{2,15})").find(it.exp) ?: return null
        val a = m.groupValues[1]; return if (it.s.contains(a)) a to m.groupValues[2] else null
    }

    fun load(ctx: Context) {
        if (tracks.isNotEmpty()) return
        try {
            val mk = JSONObject(ctx.assets.open("ox_mark.json").bufferedReader().readText())
            mk.keys().forEach { k -> mk.optJSONObject(k)?.let { marks[k] = it.optString("bad") to it.optString("fix") } }
        } catch (e: Exception) { }
        try {
            val cj = JSONObject(ctx.assets.open("ox_ctx.json").bufferedReader().readText())
            cj.keys().forEach { k -> this.ctx[k] = cj.optString(k) }
            hasCtxAudio = (ctx.assets.list("a") ?: emptyArray()).filter { it.endsWith("_c.ogg") }.toSet()
        } catch (e: Exception) { }
        val raw = JSONArray(ctx.assets.open("ox.json").bufferedReader().readText())
        val exp = try {
            JSONObject(ctx.assets.open("exp.json").bufferedReader().readText())
        } catch (e: Exception) { JSONObject() }
        val out = ArrayList<Track>()
        for (ti in 0 until raw.length()) {
            val t = raw.getJSONObject(ti)
            val arr = t.getJSONArray("items")
            val items = ArrayList<Item>()
            for (i in 0 until arr.length()) {
                val x = arr.getJSONObject(i)
                items.add(Item(ti, i, x.getString("s"), x.getInt("o") == 1, x.optString("t"), exp.optString("${ti}_$i", ""), x.optString("ref")))
            }
            out.add(Track(t.getString("name"), t.getInt("sub"), items))
        }
        tracks = out
    }

    fun item(key: String): Item? {
        val p = key.split("_")
        if (p.size != 2) return null
        return tracks.getOrNull(p[0].toIntOrNull() ?: -1)?.items?.getOrNull(p[1].toIntOrNull() ?: -1)
    }
}

/** 링 리모컨 길게 누르기 4버튼과 고를 수 있는 동작 */
object Remote {
    val ACTIONS = listOf(
        "none" to "없음", "toggle" to "재생 / 정지",
        "stepBack" to "한 단계 뒤로 (지문·해설)",
        "stepFwd" to "한 단계 앞으로 (지문·해설)",
        "itemPrev" to "이전 지문 (문항 처음)", "itemNext" to "다음 문항",
        "bookmark" to "★ 북마크", "detail" to "🤖 더 자세히 (인터넷)"
    )
    /** 칸, 화면 이름, 기본 동작 */
    val SLOTS = listOf(
        Triple("l", "왼쪽 길게", "itemPrev"),
        Triple("c", "가운데 길게", "toggle"),
        Triple("r", "오른쪽 길게", "bookmark")
    )
    /** 미디어 키 번호 → 칸 (왼쪽 88·89, 오른쪽 87·90, 가운데 85·79·126·127) */
    val KEYS = mapOf(88 to "l", 89 to "l", 87 to "r", 90 to "r", 85 to "c", 79 to "c", 126 to "c", 127 to "c")
    fun label(a: String) = ACTIONS.firstOrNull { it.first == a }?.second ?: "없음"
}


/** 낯선 용어 쉬운 설명 (웹과 같은 web/glossary.json) */
object Gloss {
    var map: Map<String, String> = emptyMap(); private set
    private var re: Regex? = null
    fun load(ctx: Context) {
        if (map.isNotEmpty()) return
        try {
            val j = JSONObject(ctx.assets.open("web/glossary.json").bufferedReader().readText())
            map = j.keys().asSequence().associateWith { j.getString(it) }
            re = Regex(map.keys.sortedByDescending { it.length }.joinToString("|") { Regex.escape(it) })
        } catch (e: Exception) { }
    }
    /** 글 속 용어에 점선 같은 밑줄과 누르면 설명이 뜨는 링크를 붙임 */
    fun apply(b: android.text.SpannableStringBuilder, color: Int, onTap: (String, String) -> Unit): android.text.SpannableStringBuilder {
        val r = re ?: return b
        r.findAll(b).forEach { m ->
            val k = m.value
            b.setSpan(object : android.text.style.ClickableSpan() {
                override fun onClick(w: android.view.View) { onTap(k, map[k] ?: "") }
                override fun updateDrawState(ds: android.text.TextPaint) { ds.isUnderlineText = true; ds.color = color }
            }, m.range.first, m.range.last + 1, android.text.Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
        return b
    }
}

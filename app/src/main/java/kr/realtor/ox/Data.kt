package kr.realtor.ox

import android.content.Context
import org.json.JSONObject
import org.json.JSONArray

class Item(val ti: Int, val i: Int, val s: String, val o: Boolean, val theme: String, val exp: String) {
    val key get() = "${ti}_$i"
}

class Track(val name: String, val sub: Int, val items: List<Item>)

object Store {
    var tracks: List<Track> = emptyList()
    val SUBS = listOf("학개론", "민법", "중개사법", "공법", "공시법", "세법")

    fun load(ctx: Context) {
        if (tracks.isNotEmpty()) return
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
                items.add(Item(ti, i, x.getString("s"), x.getInt("o") == 1, x.optString("t"), exp.optString("${ti}_$i", "")))
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
    /** 신호 맞추기 순서: 칸, 버튼 이름 */
    val BUTTONS = listOf("l" to "뒤로(왼쪽) 버튼", "c" to "가운데 버튼", "r" to "앞으로(오른쪽) 버튼")
    /** 키 신호 → 칸 (기본값, '버튼 신호 맞추기'로 바꿀 수 있음) */
    val DEFAULT_KEYS = mapOf(88 to "l", 89 to "l", 87 to "r", 90 to "r", 85 to "c", 79 to "c", 126 to "c", 127 to "c")
    fun label(a: String) = ACTIONS.firstOrNull { it.first == a }?.second ?: "없음"
}

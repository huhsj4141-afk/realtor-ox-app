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

/** 리모컨 입력 칸과 고를 수 있는 동작 (녹음한 링 리모컨 신호 기준) */
object Remote {
    val ACTIONS = listOf(
        "none" to "없음", "toggle" to "재생 / 정지", "restart" to "처음부터 (지문·해설)",
        "next" to "다음 (해설 → 다음 지문)", "prev" to "이전 지문", "nextItem" to "다음 지문",
        "exp" to "해설 바로 듣기", "bookmark" to "★ 북마크", "detail" to "🤖 더 자세히 (인터넷)"
    )
    /** 칸 이름, 화면에 보일 이름, 기본 동작 */
    val SLOTS = listOf(
        Triple("c1", "가운데 길게", "toggle"),
        Triple("c2", "가운데 길게 두 번", "bookmark"),
        Triple("l1", "왼쪽 길게", "restart"),
        Triple("l2", "왼쪽 길게 두 번", "prev"),
        Triple("r1", "오른쪽 길게", "next"),
        Triple("r2", "오른쪽 길게 두 번", "none"),
        Triple("kl", "왼쪽 짧게 · 검은 화면", "restart"),
        Triple("kr", "오른쪽 짧게 · 검은 화면", "next"),
        Triple("ku", "위 짧게 · 검은 화면", "bookmark"),
        Triple("kd", "아래 짧게 · 검은 화면", "none"),
        Triple("kc", "가운데·2번 짧게 · 검은 화면", "toggle")
    )
    fun label(a: String) = ACTIONS.firstOrNull { it.first == a }?.second ?: "없음"
}

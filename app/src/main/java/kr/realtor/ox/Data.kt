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

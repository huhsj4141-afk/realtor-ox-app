package kr.realtor.ox

import android.content.Context
import android.util.Base64
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/** 인터넷이 필요한 기능: Gemini 답변, 구글 클라우드 Achernar 읽기 (키는 앱 설정에 직접 넣은 것) */
object Net {
    const val VOICE = "ko-KR-Chirp3-HD-Achernar"
    fun key(ctx: Context, name: String) = ctx.getSharedPreferences("ox", Context.MODE_PRIVATE).getString("key_$name", "") ?: ""

    fun post(url: String, body: String): String {
        val c = URL(url).openConnection() as HttpURLConnection
        c.requestMethod = "POST"; c.doOutput = true; c.connectTimeout = 15000; c.readTimeout = 120000
        c.setRequestProperty("Content-Type", "application/json")
        c.outputStream.use { it.write(body.toByteArray()) }
        val code = c.responseCode
        val text = (if (code in 200..299) c.inputStream else c.errorStream)?.bufferedReader()?.readText() ?: ""
        if (code !in 200..299) throw RuntimeException("HTTP $code ${text.take(200)}")
        return text
    }

    /** Gemini 글 생성 (본문 그대로 반환) */
    fun gemini(ctx: Context, model: String, body: String): String {
        val k = key(ctx, "gemini"); if (k.isBlank()) throw RuntimeException("Gemini 키가 없어요")
        return post("https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=$k", body)
    }

    fun geminiText(ctx: Context, prompt: String): String {
        val body = JSONObject().put("contents", org.json.JSONArray().put(JSONObject().put("parts",
            org.json.JSONArray().put(JSONObject().put("text", prompt))))).toString()
        var last: Exception? = null
        for (m in listOf("gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite")) {
            try { return parseText(gemini(ctx, m, body)) } catch (e: Exception) {
                last = e; val msg = e.message ?: ""
                if (msg.contains("키가 없어요") || msg.contains("API_KEY_INVALID") || msg.contains("HTTP 400") || msg.contains("HTTP 403")) throw e
            }
        }
        throw last ?: RuntimeException("Gemini 응답 없음")
    }

    private fun parseText(raw: String): String {
        val r = JSONObject(raw)
        val parts = r.getJSONArray("candidates").getJSONObject(0).getJSONObject("content").getJSONArray("parts")
        return (0 until parts.length()).joinToString("") { parts.getJSONObject(it).optString("text") }.trim()
    }

    /** 글을 Achernar 음성 파일들로 (긴 글은 문장 단위로 나눔, 같은 글은 저장해 둔 걸 다시 씀) */
    fun speech(ctx: Context, text: String): List<File> {
        val k = key(ctx, "tts"); if (k.isBlank()) throw RuntimeException("구글 클라우드 음성 키가 없어요")
        val dir = File(ctx.cacheDir, "speak").apply { mkdirs() }
        return chunks(text).map { t ->
            val f = File(dir, md5(t) + ".ogg")
            if (!f.exists()) {
                val body = JSONObject()
                    .put("input", JSONObject().put("text", t))
                    .put("voice", JSONObject().put("languageCode", "ko-KR").put("name", VOICE))
                    .put("audioConfig", JSONObject().put("audioEncoding", "OGG_OPUS")).toString()
                val r = JSONObject(post("https://texttospeech.googleapis.com/v1/text:synthesize?key=$k", body))
                f.writeBytes(Base64.decode(r.getString("audioContent"), Base64.DEFAULT))
            }
            f
        }
    }

    private fun chunks(text: String): List<String> {
        val out = ArrayList<String>(); val sb = StringBuilder()
        Regex("[^.!?。\\n]+[.!?。]?\\s*").findAll(text).map { it.value }.forEach { s ->
            if (sb.length + s.length > 400 && sb.isNotEmpty()) { out.add(sb.toString().trim()); sb.clear() }
            sb.append(s)
        }
        if (sb.isNotBlank()) out.add(sb.toString().trim())
        return out.filter { it.isNotBlank() }
    }

    private fun md5(s: String) = MessageDigest.getInstance("MD5").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }

    /** 지문을 더 자세히 설명하는 글 */
    fun detail(ctx: Context, it: Item): String = geminiText(ctx,
        "너는 공인중개사 시험 강사야. 아래 OX 지문을 더 자세히, 쉬운 말로 설명해 줘. 왜 맞거나 틀린지, 관련 개념과 헷갈리는 비슷한 내용, 암기 요령까지. " +
        "해요체로 6문장 안팎. 소리 내어 읽을 거라 괄호, 한자, 기호, 목록 표시는 쓰지 마.\n" +
        "[지문] ${it.s}\n[정답] ${if (it.o) "O, 맞는 말" else "X, 틀린 말"}\n[기본 해설] ${it.exp}")
}

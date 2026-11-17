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
    val CHAIN = listOf("gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.5-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash-lite")
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
        val out = post("https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=$k", body)
        val tok = try { JSONObject(out).optJSONObject("usageMetadata")?.optLong("totalTokenCount") ?: 0L } catch (e: Exception) { 0L }
        Usage.addGemini(ctx, tok)
        return out
    }

    fun geminiText(ctx: Context, prompt: String): String {
        val body = JSONObject().put("contents", org.json.JSONArray().put(JSONObject().put("parts",
            org.json.JSONArray().put(JSONObject().put("text", prompt))))).toString()
        // 무료 등급은 모델마다 하루 한도가 따로 → 한도 초과(429)한 모델은 그날 건너뛰고 다음 모델로
        val sp = ctx.getSharedPreferences("ox", Context.MODE_PRIVATE); val day = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).apply { timeZone = java.util.TimeZone.getTimeZone("America/Los_Angeles") }.format(java.util.Date())   // 무료 한도 초기화 기준(한국 오후 5시)
        for (m in CHAIN) {
            if (sp.getString("gem_skip_$m", "") == day) continue
            try { return parseText(gemini(ctx, m, body)) } catch (e: Exception) {
                val msg = e.message ?: ""
                when {
                    msg.contains("HTTP 429") -> sp.edit().putString("gem_skip_$m", day).apply()
                    msg.contains("HTTP 404") || msg.contains("HTTP 500") || msg.contains("HTTP 503") -> {}
                    else -> throw e
                }
            }
        }
        throw RuntimeException("오늘 무료 AI 사용량을 다 썼어요. 내일 다시 쓸 수 있어요.")
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
                Usage.addTts(ctx, t.length.toLong())
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


/** 이 앱이 쓴 양을 직접 세서 요금을 추정 (구글 청구서와 몇 % 차이 날 수 있음) */
object Usage {
    const val TTS_FREE = 1_000_000L          // Chirp 3 HD 월 무료 글자 수
    const val TTS_USD_PER_CHAR = 0.00003     // 무료 초과 시 글자당 $0.00003
    const val KRW = 1470.0
    private fun p(ctx: Context) = ctx.getSharedPreferences("usage", Context.MODE_PRIVATE)
    private fun month() = java.text.SimpleDateFormat("yyyyMM", java.util.Locale.KOREA).format(java.util.Date())
    private fun day() = java.text.SimpleDateFormat("yyyyMMdd", java.util.Locale.KOREA).format(java.util.Date())
    @Synchronized fun addTts(ctx: Context, n: Long) { val k = "tts_" + month(); p(ctx).edit().putLong(k, p(ctx).getLong(k, 0) + n).apply() }
    @Synchronized fun addGemini(ctx: Context, tok: Long) {
        val d = day(); val m = month(); val sp = p(ctx)
        sp.edit().putLong("gc_$d", sp.getLong("gc_$d", 0) + 1).putLong("gt_$m", sp.getLong("gt_$m", 0) + tok)
            .putLong("gcm_$m", sp.getLong("gcm_$m", 0) + 1).apply()
    }
    fun summary(ctx: Context): String {
        val sp = p(ctx); val m = month()
        val tts = sp.getLong("tts_$m", 0)
        val over = (tts - TTS_FREE).coerceAtLeast(0)
        val won = over * TTS_USD_PER_CHAR * KRW
        val pct = tts * 100.0 / TTS_FREE
        return "🗣 음성(Achernar) ${"%,d".format(tts)}자 / 무료 100만자 (${"%.2f".format(pct)}%)\n" +
            "   예상 요금 ₩${"%,d".format(won.toLong())}" + (if (over > 0) " ⚠ 무료 초과" else " · 무료 안") + "\n" +
            "🤖 제미나이 오늘 ${sp.getLong("gc_" + day(), 0)}회 · 이번 달 ${sp.getLong("gcm_$m", 0)}회 (${"%,d".format(sp.getLong("gt_$m", 0))}토큰)\n" +
            "   무료 등급이라 요금 ₩0\n" +
            "이 폰에서 쓴 양을 앱이 직접 센 값이에요. 매달 1일에 0부터 다시 세요."
    }
}

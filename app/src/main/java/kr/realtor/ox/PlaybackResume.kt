package kr.realtor.ox

/** Restore order against today's eligible items, never resurrect removed items. */
internal object PlaybackResume {
    fun <T> order(eligible: List<T>, saved: List<String>, current: String, appendNew: Boolean, key: (T) -> String): List<T> {
        val byKey = eligible.associateBy(key)
        val old = saved.mapNotNull { byKey[it] }.distinctBy(key)
        if (old.none { key(it) == current }) return eligible
        return if (appendNew) old + eligible.filter { key(it) !in saved } else old
    }

    fun matches(saved: String?, ref: String, statement: String, explanation: String): Boolean =
        saved == identity(ref, statement, explanation)

    fun identity(ref: String, statement: String, explanation: String) = "$ref\n$statement\n$explanation"
}

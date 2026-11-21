package kr.realtor.ox

/** Ignore delayed work after another command has replaced it. */
internal class LatestRequest {
    private val generation = java.util.concurrent.atomic.AtomicInteger()
    fun next(): Int = generation.incrementAndGet()
    fun current(token: Int): Boolean = token == generation.get()
    fun cancel() { generation.incrementAndGet() }
}

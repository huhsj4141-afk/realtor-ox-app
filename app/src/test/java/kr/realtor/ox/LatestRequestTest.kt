package kr.realtor.ox

import org.junit.Assert.*
import org.junit.Test

class LatestRequestTest {
    @Test fun newerCommandDiscardsOlderCompletion() {
        val requests = LatestRequest()
        val first = requests.next()
        val second = requests.next()
        assertFalse(requests.current(first))
        assertTrue(requests.current(second))
    }
    @Test fun stoppingDiscardsEveryPendingCompletion() {
        val requests = LatestRequest()
        val token = requests.next()
        requests.cancel()
        assertFalse(requests.current(token))
        assertTrue(requests.current(requests.next()))
    }
}

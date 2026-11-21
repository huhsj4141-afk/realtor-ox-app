package kr.realtor.ox

import org.junit.Assert.*
import org.junit.Test

class PlaybackResumeTest {
    @Test fun removedBookmarksStayRemovedAndNewOnesAppear() {
        assertEquals(listOf("b", "c"), PlaybackResume.order(listOf("b", "c"), listOf("a", "b"), "b", true) { it })
    }
    @Test fun removedCurrentItemUsesFreshList() {
        assertEquals(listOf("c", "b"), PlaybackResume.order(listOf("c", "b"), listOf("a", "b"), "a", true) { it })
    }
    @Test fun shuffledSnapshotKeepsItsOrderWithoutAddingAllSubjects() {
        assertEquals(listOf("b", "a"), PlaybackResume.order(listOf("a", "b", "c"), listOf("b", "a", "b"), "a", false) { it })
    }
    @Test fun changedContentAndLegacyCheckpointsDoNotRestoreSeconds() {
        val saved = PlaybackResume.identity("q1", "statement", "explanation")
        assertTrue(PlaybackResume.matches(saved, "q1", "statement", "explanation"))
        assertFalse(PlaybackResume.matches(saved, "q2", "statement", "explanation"))
        assertFalse(PlaybackResume.matches(saved, "q1", "updated", "explanation"))
        assertFalse(PlaybackResume.matches(null, "q1", "statement", "explanation"))
    }
}

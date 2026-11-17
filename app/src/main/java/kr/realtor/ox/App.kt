package kr.realtor.ox

import android.app.Application
import java.io.File

/** 비정상 종료 시 원인을 파일로 남겨 다음 실행 때 보여줌 */
class App : Application() {
    override fun onCreate() {
        super.onCreate()
        val prev = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { t, e ->
            try { File(filesDir, "crash.txt").appendText("----\n" + android.util.Log.getStackTraceString(e).take(3000) + "\n") } catch (x: Throwable) { }
            prev?.uncaughtException(t, e)
        }
    }
}

/** 상태 표시줄·내비게이션 바·키보드에 내용이 가리지 않게 안쪽 여백을 줌 (안드로이드 15는 화면 끝까지 그림) */
fun safeArea(v: android.view.View, bg: Int): android.view.View {
    val box = android.widget.FrameLayout(v.context).apply { setBackgroundColor(bg); addView(v) }
    androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(box) { b, ins ->
        val t = androidx.core.view.WindowInsetsCompat.Type.systemBars() or androidx.core.view.WindowInsetsCompat.Type.displayCutout()
        val s = ins.getInsets(t); val k = ins.getInsets(androidx.core.view.WindowInsetsCompat.Type.ime())
        b.setPadding(s.left, s.top, s.right, maxOf(s.bottom, k.bottom))
        androidx.core.view.WindowInsetsCompat.CONSUMED
    }
    return box
}

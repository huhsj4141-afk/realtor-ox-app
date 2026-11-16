package kr.realtor.ox

import android.app.Application
import java.io.File

/** 비정상 종료 시 원인을 파일로 남겨 다음 실행 때 보여줌 */
class App : Application() {
    override fun onCreate() {
        super.onCreate()
        val prev = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { t, e ->
            try { File(filesDir, "crash.txt").writeText(android.util.Log.getStackTraceString(e).take(4000)) } catch (x: Throwable) { }
            prev?.uncaughtException(t, e)
        }
    }
}

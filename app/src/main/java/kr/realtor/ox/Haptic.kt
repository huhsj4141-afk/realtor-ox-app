package kr.realtor.ox

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/** 버튼 눌렀을 때 짧은 진동 (설정 ⚙ → 📳 터치 진동, 기본 켬) */
object Haptic {
    fun on(ctx: Context) = ctx.getSharedPreferences("ox", Context.MODE_PRIVATE).getBoolean("haptic", true)
    fun set(ctx: Context, v: Boolean) = ctx.getSharedPreferences("ox", Context.MODE_PRIVATE).edit().putBoolean("haptic", v).apply()
    fun tap(ctx: Context, strong: Boolean = false) {
        if (!on(ctx)) return
        try {
            val v: Vibrator = if (Build.VERSION.SDK_INT >= 31) (ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
                              else @Suppress("DEPRECATION") (ctx.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator)
            if (Build.VERSION.SDK_INT >= 29) v.vibrate(VibrationEffect.createPredefined(if (strong) VibrationEffect.EFFECT_HEAVY_CLICK else VibrationEffect.EFFECT_CLICK))
            else if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(if (strong) 30 else 15, VibrationEffect.DEFAULT_AMPLITUDE))
            else @Suppress("DEPRECATION") v.vibrate(15)
        } catch (e: Exception) { }
    }
}
